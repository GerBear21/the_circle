import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = session.user.id;
    const userOrgId = (session.user as any).org_id;
    const { requestId, stepId, newApproverId, reason, jobTitle } = req.body;

    if (!requestId || !stepId || !newApproverId) {
      return res.status(400).json({ error: 'requestId, stepId, and newApproverId are required' });
    }

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(requestId) || !uuidRegex.test(stepId) || !uuidRegex.test(newApproverId)) {
      return res.status(400).json({ error: 'Invalid UUID format' });
    }

    // Fetch the request and step
    const { data: request, error: requestError } = await supabaseAdmin
      .from('requests')
      .select('id, status, creator_id, organization_id, title')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Verify user belongs to same organization
    if (request.organization_id !== userOrgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only allow redirection for pending requests
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Can only redirect approvals for pending requests' });
    }

    // Fetch the step
    const { data: step, error: stepError } = await supabaseAdmin
      .from('request_steps')
      .select('id, request_id, approver_user_id, status, is_redirected, original_approver_id')
      .eq('id', stepId)
      .eq('request_id', requestId)
      .single();

    if (stepError || !step) {
      return res.status(404).json({ error: 'Approval step not found' });
    }

    // Only allow redirection for pending or waiting steps
    if (step.status !== 'pending' && step.status !== 'waiting') {
      return res.status(400).json({ error: 'Can only redirect pending or waiting approval steps' });
    }

    // Check if user is authorized to redirect (creator or current approver)
    const isCreator = request.creator_id === userId;
    const isCurrentApprover = step.approver_user_id === userId;
    
    // Also check if user is any approver on this request
    const { data: userSteps } = await supabaseAdmin
      .from('request_steps')
      .select('id')
      .eq('request_id', requestId)
      .eq('approver_user_id', userId);
    
    const isAnyApprover = userSteps && userSteps.length > 0;

    if (!isCreator && !isCurrentApprover && !isAnyApprover) {
      return res.status(403).json({ error: 'Only the requestor or approvers can redirect approvals' });
    }

    // Verify new approver exists and is in same organization
    const { data: newApprover, error: newApproverError } = await supabaseAdmin
      .from('app_users')
      .select('id, display_name, email, organization_id')
      .eq('id', newApproverId)
      .single();

    if (newApproverError || !newApprover) {
      return res.status(404).json({ error: 'New approver not found' });
    }

    if (newApprover.organization_id !== request.organization_id) {
      return res.status(400).json({ error: 'New approver must be in the same organization' });
    }

    // Store original approver ID (use existing original if already redirected)
    const originalApproverId = step.is_redirected && step.original_approver_id 
      ? step.original_approver_id 
      : step.approver_user_id;

    // Update the step with new approver
    const { error: updateError } = await supabaseAdmin
      .from('request_steps')
      .update({
        approver_user_id: newApproverId,
        is_redirected: true,
        original_approver_id: originalApproverId,
        redirected_by_id: userId,
        redirected_at: new Date().toISOString(),
        redirect_reason: reason || null,
        redirect_job_title: jobTitle || null,
      })
      .eq('id', stepId);

    if (updateError) {
      console.error('Failed to update step:', updateError);
      return res.status(500).json({ error: 'Failed to redirect approval' });
    }

    // Create audit record
    const { error: auditError } = await supabaseAdmin
      .from('approval_redirections')
      .insert({
        request_id: requestId,
        step_id: stepId,
        original_approver_id: originalApproverId,
        new_approver_id: newApproverId,
        redirected_by_id: userId,
        redirect_reason: reason || null,
        redirect_job_title: jobTitle || null,
      });

    if (auditError) {
      console.error('Failed to create audit record:', auditError);
      // Don't fail the request, audit is secondary
    }

    // Get redirector name for notification
    const { data: redirector } = await supabaseAdmin
      .from('app_users')
      .select('display_name')
      .eq('id', userId)
      .single();

    // Notify the new approver
    await supabaseAdmin
      .from('notifications')
      .insert({
        organization_id: request.organization_id,
        recipient_id: newApproverId,
        sender_id: userId,
        type: 'task',
        title: 'Approval Redirected to You',
        message: `${redirector?.display_name || 'Someone'} has redirected an approval for "${request.title}" to you${reason ? ` (Reason: ${reason})` : ''}.`,
        metadata: {
          request_id: requestId,
          action_label: 'Review Request',
          action_url: `/requests/comp/${requestId}`,
          is_redirected: true,
        },
        is_read: false,
      });

    // Notify the original approver that their approval was redirected
    if (originalApproverId && originalApproverId !== userId) {
      await supabaseAdmin
        .from('notifications')
        .insert({
          organization_id: request.organization_id,
          recipient_id: originalApproverId,
          sender_id: userId,
          type: 'info',
          title: 'Your Approval Was Redirected',
          message: `Your approval for "${request.title}" has been redirected to ${newApprover.display_name}${reason ? ` (Reason: ${reason})` : ''}.`,
          metadata: {
            request_id: requestId,
            action_label: 'View Request',
            action_url: `/requests/comp/${requestId}`,
          },
          is_read: false,
        });
    }

    return res.status(200).json({
      success: true,
      message: `Approval redirected to ${newApprover.display_name}`,
      newApprover: {
        id: newApprover.id,
        display_name: newApprover.display_name,
        email: newApprover.email,
      },
    });
  } catch (error: any) {
    console.error('Approval redirect error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
