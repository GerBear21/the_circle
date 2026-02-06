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
          creator_id,
          creator:app_users!requests_creator_id_fkey (
            id,
            display_name,
            email,
            profile_picture_url
          ),
          request_steps (
            id,
            status,
            approver_user_id
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100); // Fetch more to filter down

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      } else {
        // By default, exclude drafts unless explicitly requested
        query = query.neq('status', 'draft');
      }

      const { data: requests, error } = await query;
      
      if (error) throw error;

      // APPROVAL VISIBILITY: Filter requests user can see
      // User can see if: creator, watcher, or approver with non-waiting step (or any step in parallel mode)
      const filteredRequests = (requests || []).filter((req: any) => {
        // Filter out drafts that don't belong to the current user
        if (req.status === 'draft') {
          return req.creator_id === userId;
        }
        
        // Creator can always see their own requests
        if (req.creator_id === userId) return true;
        
        // Check if user is a watcher
        const watcherIds = req.metadata?.watchers || [];
        const isWatcher = Array.isArray(watcherIds) && watcherIds.some((w: any) => 
          typeof w === 'string' ? w === userId : w?.id === userId
        );
        if (isWatcher) return true;
        
        // Check if user is an approver
        const userStep = req.request_steps?.find(
          (step: any) => step.approver_user_id === userId
        );
        
        if (userStep) {
          // PARALLEL MODE: All approvers can see the request immediately (all steps are pending)
          // SEQUENTIAL MODE: Only approvers with non-waiting steps can see
          const isParallelApproval = req.metadata?.useParallelApprovals === true;
          if (isParallelApproval || userStep.status !== 'waiting') return true;
        }
        
        return false;
      }).slice(0, Number(limit));

      // Helper function to compute actual status based on step statuses
      const computeActualStatus = (dbStatus: string, steps: any[]) => {
        if (!steps || steps.length === 0) return dbStatus;
        
        // If any step is rejected, the request is rejected
        if (steps.some((s: any) => s.status === 'rejected')) return 'rejected';
        
        // If all steps are approved, the request is approved
        if (steps.every((s: any) => s.status === 'approved')) return 'approved';
        
        // If there are pending or waiting steps, the request is still in progress
        if (steps.some((s: any) => s.status === 'pending' || s.status === 'waiting')) return 'pending';
        
        return dbStatus;
      };

      // Transform data to match frontend Request interface
      const transformedRequests = filteredRequests.map((req: any) => ({
        id: req.id,
        title: req.title,
        description: req.description || '',
        status: computeActualStatus(req.status, req.request_steps),
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
          avatar: req.creator?.profile_picture_url || null,
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
      // Handle both array format and object format (for backward compatibility)
      let approvers: string[] = [];
      if (metadata?.approvers) {
        if (Array.isArray(metadata.approvers)) {
          // Already an array (new format)
          approvers = metadata.approvers.filter((id: any) => typeof id === 'string' && id.length > 0);
        } else if (typeof metadata.approvers === 'object') {
          // Object format (legacy) - convert to array in a defined order
          const approverObj = metadata.approvers as Record<string, string>;
          // Combined ordered keys for all form types:
          // CAPEX: finance_manager -> general_manager -> procurement_manager -> corporate_hod -> projects_manager -> operations_director -> finance_director -> ceo
          // Hotel Booking: hod -> hr_director -> finance_director -> ceo
          const orderedKeys = [
            // CAPEX roles
            'finance_manager', 'general_manager', 'procurement_manager', 'corporate_hod', 
            'projects_manager', 'managing_director',
            // Hotel Booking roles (some overlap with CAPEX)
            'hod', 'hr_director', 'finance_director', 'ceo',
            // Generic fallback roles
            'manager', 'director'
          ];
          for (const key of orderedKeys) {
            if (approverObj[key] && !approvers.includes(approverObj[key])) {
              approvers.push(approverObj[key]);
            }
          }
          // Add any remaining keys not in the predefined order
          for (const [key, value] of Object.entries(approverObj)) {
            if (value && !orderedKeys.includes(key) && !approvers.includes(value)) {
              approvers.push(value);
            }
          }
        }
      }

      if (finalStatus === 'pending' && approvers.length > 0) {
        // Check if parallel approvals mode is enabled
        const useParallelApprovals = metadata?.useParallelApprovals === true;

        // Create request_steps for each approver in order
        // PARALLEL APPROVAL: All steps are 'pending' - all approvers can review immediately
        // SEQUENTIAL APPROVAL: First step is 'pending', all subsequent steps are 'waiting'
        const requestSteps = approvers.map((approverId: string, index: number) => ({
          request_id: data.id,
          step_index: index + 1,
          step_type: 'approval',
          approver_user_id: approverId,
          status: useParallelApprovals ? 'pending' : (index === 0 ? 'pending' : 'waiting'),
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

        if (useParallelApprovals) {
          // PARALLEL NOTIFICATION: Notify ALL approvers immediately
          const approverNotifications = approvers.map((approverId: string, index: number) => ({
            organization_id: organizationId,
            recipient_id: approverId,
            sender_id: userId,
            type: 'task',
            title: 'New Approval Request',
            message: `${requesterName} has submitted a ${requestType?.toUpperCase() || 'CAPEX'} request "${title}" for your approval. (Parallel approval - ${approvers.length} approvers)`,
            metadata: {
              request_id: data.id,
              request_type: requestType,
              action_label: 'Review Request',
              action_url: `/requests/${data.id}`,
              step_number: index + 1,
              total_steps: approvers.length,
              is_parallel: true,
            },
            is_read: false,
          }));

          try {
            await supabaseAdmin
              .from('notifications')
              .insert(approverNotifications);
          } catch (notifError) {
            console.error('Failed to create parallel notifications:', notifError);
          }
        } else {
          // SEQUENTIAL NOTIFICATION: Only notify the FIRST approver initially
          // Subsequent approvers will be notified when their step becomes pending (handled by ApprovalEngine)
          const firstApproverId = approvers[0];
          try {
            await supabaseAdmin
              .from('notifications')
              .insert({
                organization_id: organizationId,
                recipient_id: firstApproverId,
                sender_id: userId,
                type: 'task',
                title: 'New Approval Request',
                message: `${requesterName} has submitted a ${requestType?.toUpperCase() || 'CAPEX'} request "${title}" for your approval. (Step 1 of ${approvers.length})`,
                metadata: {
                  request_id: data.id,
                  request_type: requestType,
                  action_label: 'Review Request',
                  action_url: `/requests/${data.id}`,
                  step_number: 1,
                  total_steps: approvers.length,
                },
                is_read: false,
              });
          } catch (notifError) {
            console.error('Failed to create notification:', notifError);
          }
        }

        // Update request metadata with total_steps for tracking
        await supabaseAdmin
          .from('requests')
          .update({
            metadata: {
              ...finalMetadata,
              total_steps: approvers.length,
              current_step: useParallelApprovals ? null : 1, // null for parallel since all are active
              useParallelApprovals: useParallelApprovals,
            }
          })
          .eq('id', data.id);
      }

      // Notify watchers if any (for both draft and pending status, but mainly useful for pending)
      if (finalStatus === 'pending' && metadata?.watchers?.length > 0) {
        const watchers = metadata.watchers as string[];
        
        // Get the requester's name for the notification (if not already fetched)
        let requesterName = 'A user';
        const { data: requesterData } = await supabaseAdmin
          .from('app_users')
          .select('display_name')
          .eq('id', userId)
          .single();
        
        if (requesterData?.display_name) {
          requesterName = requesterData.display_name;
        }

        // Create notifications for all watchers
        const watcherNotifications = watchers.map((watcherId: string) => ({
          organization_id: organizationId,
          recipient_id: watcherId,
          sender_id: userId,
          type: 'info',
          title: 'Added as Watcher',
          message: `${requesterName} has added you as a watcher on their ${requestType?.toUpperCase() || 'CAPEX'} request "${title}".`,
          metadata: {
            request_id: data.id,
            request_type: requestType,
            action_label: 'View Request',
            action_url: `/requests/${data.id}`,
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

      return res.status(201).json({ request: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Requests API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}
