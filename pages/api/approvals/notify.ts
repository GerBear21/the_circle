import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { requestId, approverId } = req.body;

    console.log('[notify] Received body:', JSON.stringify(req.body));
    console.log('[notify] requestId:', requestId, 'type:', typeof requestId);
    console.log('[notify] approverId:', approverId, 'type:', typeof approverId);

    if (!requestId || !approverId) {
      return res.status(400).json({ error: 'requestId and approverId are required' });
    }

    // Look up approver by ID to get email, name, position
    const { data: approver, error: approverError } = await supabaseAdmin
      .from('app_users')
      .select('id, organization_id, display_name, email')
      .eq('id', approverId)
      .single();

    console.log('[notify] Approver query result:', JSON.stringify({ approver, approverError }));

    if (approverError || !approver) {
      return res.status(404).json({ 
        error: 'Approver not found',
        debug: {
          queriedApproverId: approverId,
          approverError: approverError?.message || approverError,
        }
      });
    }

    // Get the request to find the creator
    const { data: request, error: requestError } = await supabaseAdmin
      .from('requests')
      .select('id, creator_id, organization_id, title')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Update request status to pending_approval
    const { error: updateError } = await supabaseAdmin
      .from('requests')
      .update({ status: 'pending_approval' })
      .eq('id', requestId);

    if (updateError) {
      console.error('Failed to update request status:', updateError);
    }

    // IDEMPOTENCY GUARD: Check if a pending approval already exists for this (requestId, approver)
    // This protects against n8n retries, double submissions, and workflow restarts
    const { data: existingStep } = await supabaseAdmin
      .from('request_steps')
      .select('id, status')
      .eq('request_id', requestId)
      .eq('approver_user_id', approver.id)
      .eq('status', 'pending')
      .single();

    if (existingStep) {
      // Already exists - return 200 (idempotent), do NOT create another row
      return res.status(200).json({
        success: true,
        message: 'Approval already pending for this approver',
        approverId: approver.id,
        approverName: approver.display_name,
        existingStepId: existingStep.id,
        idempotent: true,
      });
    }

    // Get the max step_index for this request
    const { data: maxStepData } = await supabaseAdmin
      .from('request_steps')
      .select('step_index')
      .eq('request_id', requestId)
      .order('step_index', { ascending: false })
      .limit(1)
      .single();

    const nextStepIndex = (maxStepData?.step_index || 0) + 1;

    // Create a pending approval record in request_steps
    const { error: stepError } = await supabaseAdmin
      .from('request_steps')
      .insert({
        request_id: requestId,
        step_index: nextStepIndex,
        step_type: 'approval',
        approver_user_id: approver.id,
        status: 'pending',
      });

    if (stepError) {
      console.error('Failed to create approval step:', stepError);
      return res.status(500).json({ error: 'Failed to create approval record' });
    }

    // Create notification for the approver
    const { error: notifError } = await supabaseAdmin
      .from('notifications')
      .insert({
        organization_id: approver.organization_id,
        recipient_id: approver.id,
        sender_id: request.creator_id,
        type: 'task',
        title: 'Approval Required',
        message: `A request "${request.title}" requires your approval.`,
        metadata: {
          request_id: requestId,
          action_label: 'Review Request',
          action_url: `/requests/${requestId}`,
        },
        is_read: false,
      });

    if (notifError) {
      console.error('Failed to create notification:', notifError);
    }

    return res.status(200).json({
      success: true,
      message: 'Approval notification sent',
      approverId: approver.id,
      approverName: approver.display_name,
    });
  } catch (error: any) {
    console.error('Approvals notify error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process approval notification' });
  }
}
