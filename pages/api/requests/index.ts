import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    if (req.method === 'GET') {
      const { status: statusFilter, type, limit = 50 } = req.query;
      
      let query = supabaseAdmin
        .from('requests')
        .select(`
          id,
          title,
          description,
          status,
          metadata,
          created_at,
          updated_at,
          creator:app_users!requests_creator_id_fkey (
            id,
            display_name,
            email
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data: requests, error } = await query;

      if (error) throw error;

      // Transform data to match frontend Request interface
      const transformedRequests = (requests || []).map((req: any) => ({
        id: req.id,
        title: req.title,
        description: req.description || '',
        status: req.status,
        priority: req.metadata?.priority || 'normal',
        category: req.metadata?.category || req.metadata?.requestType || 'General',
        department: req.creator?.department || req.metadata?.department || 'Unknown',
        created_at: req.created_at,
        updated_at: req.updated_at,
        current_step: req.metadata?.current_step || 1,
        total_steps: req.metadata?.total_steps || 1,
        type: req.metadata?.requestType || 'approval',
        amount: req.metadata?.amount,
        currency: req.metadata?.currency || 'USD',
        requester: {
          id: req.creator?.id || '',
          name: req.creator?.display_name || 'Unknown User',
          email: req.creator?.email || '',
          department: req.creator?.department || req.metadata?.department || 'Unknown',
          position: req.creator?.position || req.metadata?.position || '',
        },
        current_approver: req.metadata?.current_approver,
        due_date: req.metadata?.due_date,
        reference_number: req.metadata?.reference_number || `REQ-${req.id?.substring(0, 8)?.toUpperCase() || ''}`,
        attachments_count: req.metadata?.attachments_count || 0,
        comments_count: req.metadata?.comments_count || 0,
      }));

      return res.status(200).json({ requests: transformedRequests });
    }

    if (req.method === 'POST') {
      const { 
        title, 
        description, 
        priority = 'medium', 
        requestType,
        metadata = {},
        status: requestStatus
      } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      // Allow draft or pending status, default to draft
      const validStatuses = ['draft', 'pending'];
      const finalStatus = validStatuses.includes(requestStatus) ? requestStatus : 'draft';

      // Store priority and requestType in metadata
      const finalMetadata = { 
        ...metadata, 
        priority,
        requestType: requestType || 'general'
      };

      const { data, error } = await supabaseAdmin
        .from('requests')
        .insert({
          organization_id: organizationId,
          creator_id: userId,
          title,
          description: description || null,
          metadata: finalMetadata,
          status: finalStatus,
        })
        .select()
        .single();

      if (error) throw error;

      // If this is a submission (not a draft) and there are approvers, create request_steps and notify
      if (finalStatus === 'pending' && metadata?.approvers?.length > 0) {
        const approvers = metadata.approvers as string[];
        
        // Create request_steps for each approver in order
        const requestSteps = approvers.map((approverId: string, index: number) => ({
          request_id: data.id,
          step_index: index + 1,
          step_type: 'approval',
          approver_user_id: approverId,
          status: index === 0 ? 'pending' : 'waiting', // First step is pending, rest are waiting
        }));

        const { error: stepsError } = await supabaseAdmin
          .from('request_steps')
          .insert(requestSteps);

        if (stepsError) {
          console.error('Failed to create request_steps:', stepsError);
        }

        // Get the requester's name for the notification
        const { data: requesterData } = await supabaseAdmin
          .from('app_users')
          .select('display_name')
          .eq('id', userId)
          .single();

        const requesterName = requesterData?.display_name || 'A user';
        const firstApproverId = approvers[0];

        // Create notification for the first approver
        try {
          await supabaseAdmin
            .from('notifications')
            .insert({
              organization_id: organizationId,
              recipient_id: firstApproverId,
              sender_id: userId,
              type: 'task',
              title: 'New Approval Request',
              message: `${requesterName} has submitted a ${requestType?.toUpperCase() || 'CAPEX'} request "${title}" for your approval.`,
              metadata: {
                request_id: data.id,
                request_type: requestType,
                action_label: 'Review Request',
                action_url: `/requests/${data.id}`,
              },
              is_read: false,
            });
        } catch (notifError) {
          console.error('Failed to create notification:', notifError);
        }

        // Trigger n8n approval workflow
        try {
          const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook-test/start-approval';
          await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestId: data.id,
              approvers,
              formData: {
                title,
                description,
                requestType,
                requesterName,
                requesterId: userId,
                organizationId,
                ...finalMetadata,
              },
            }),
          });
        } catch (n8nError) {
          console.error('Failed to trigger n8n approval workflow:', n8nError);
        }
      }

      return res.status(201).json({ request: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Requests API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}
