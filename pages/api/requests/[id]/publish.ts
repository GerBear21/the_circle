import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;
    const { id } = req.query;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    // Fetch the request to verify ownership and status
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('requests')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Only the creator can publish their own request
    if (request.creator_id !== userId) {
      return res.status(403).json({ error: 'Only the request creator can publish this request' });
    }

    // Only draft requests can be published
    if (request.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft requests can be published' });
    }

    // Get approvers from metadata - handle both array and object formats
    let approverIds: string[] = [];
    const approversData = request.metadata?.approvers;
    
    if (Array.isArray(approversData)) {
      // Format: ['user-id-1', 'user-id-2', ...]
      approverIds = approversData.filter(Boolean);
    } else if (approversData && typeof approversData === 'object') {
      // Format: { hod: 'user-id', hr_director: 'user-id', ... }
      approverIds = Object.values(approversData).filter(Boolean) as string[];
    }

    if (approverIds.length === 0) {
      return res.status(400).json({ error: 'No approvers assigned. Please add approvers before publishing.' });
    }

    // Create request_steps for each approver
    // SEQUENTIAL APPROVAL: Only first step is 'pending', rest are 'waiting'
    const requestSteps = approverIds.map((approverId, index) => ({
      request_id: id,
      step_index: index + 1,
      step_type: 'approval',
      approver_role: `Approver ${index + 1}`,
      approver_user_id: approverId,
      status: index === 0 ? 'pending' : 'waiting',
    }));

    const { error: stepsError } = await supabaseAdmin
      .from('request_steps')
      .insert(requestSteps);

    if (stepsError) {
      console.error('Error creating request steps:', stepsError);
      throw stepsError;
    }

    // Update request status to pending
    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from('requests')
      .update({
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Get the requester's name for notifications
    const { data: requesterData } = await supabaseAdmin
      .from('app_users')
      .select('display_name')
      .eq('id', userId)
      .single();

    const requesterName = requesterData?.display_name || 'A user';
    const requestType = request.metadata?.requestType || 'CAPEX';
    const requestTitle = request.title;

    // Notify the first approver
    if (approverIds.length > 0) {
      try {
        await supabaseAdmin
          .from('notifications')
          .insert({
            organization_id: organizationId,
            recipient_id: approverIds[0],
            sender_id: userId,
            type: 'task',
            title: 'New Approval Request',
            message: `${requesterName} has submitted a ${requestType.toUpperCase()} request "${requestTitle}" for your approval.`,
            metadata: {
              request_id: id,
              request_type: requestType,
              action_label: 'Review Request',
              action_url: `/requests/${id}`,
            },
            is_read: false,
          });
      } catch (notifError) {
        console.error('Failed to create approver notification:', notifError);
      }
    }

    // Notify watchers if any
    const watcherIds: string[] = request.metadata?.watchers || [];
    if (watcherIds.length > 0) {
      const watcherNotifications = watcherIds.map((watcherId: string) => ({
        organization_id: organizationId,
        recipient_id: watcherId,
        sender_id: userId,
        type: 'info',
        title: 'Added as Watcher',
        message: `${requesterName} has added you as a watcher on their ${requestType.toUpperCase()} request "${requestTitle}".`,
        metadata: {
          request_id: id,
          request_type: requestType,
          action_label: 'View Request',
          action_url: `/requests/${id}`,
        },
        is_read: false,
      }));

      try {
        await supabaseAdmin
          .from('notifications')
          .insert(watcherNotifications);
      } catch (notifError) {
        console.error('Failed to create watcher notifications:', notifError);
      }
    }

    return res.status(200).json({
      success: true,
      request: updatedRequest,
      message: 'Request published successfully',
    });
  } catch (error: any) {
    console.error('Publish request error:', error);
    return res.status(500).json({ error: error.message || 'Failed to publish request' });
  }
}
