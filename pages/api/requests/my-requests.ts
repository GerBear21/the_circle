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

    if (!userId) {
      return res.status(400).json({ error: 'User ID not found' });
    }

    if (req.method === 'GET') {
      const { status: statusFilter, limit = 50 } = req.query;
      
      // Fetch requests created by the current user
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
        .eq('creator_id', userId)
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'pending') {
          // Include both pending and in_review for the pending filter
          query = query.in('status', ['pending', 'in_review', 'draft']);
        } else {
          query = query.eq('status', statusFilter);
        }
      }

      const { data: requests, error } = await query;

      if (error) throw error;

      // Fetch request steps to get current_step and total_steps for each request
      const requestIds = requests?.map(r => r.id) || [];
      
      let stepsData: any[] = [];
      if (requestIds.length > 0) {
        const { data: steps, error: stepsError } = await supabaseAdmin
          .from('request_steps')
          .select(`
            id,
            request_id,
            step_index,
            status,
            approver_user_id,
            approver:app_users!request_steps_approver_user_id_fkey (
              id,
              display_name,
              email
            )
          `)
          .in('request_id', requestIds)
          .order('step_index', { ascending: true });

        if (stepsError) throw stepsError;
        stepsData = steps || [];
      }

      // Fetch document counts for attachments
      let documentCounts: Record<string, number> = {};
      if (requestIds.length > 0) {
        const { data: docs, error: docsError } = await supabaseAdmin
          .from('documents')
          .select('request_id')
          .in('request_id', requestIds);

        if (!docsError && docs) {
          docs.forEach(doc => {
            documentCounts[doc.request_id] = (documentCounts[doc.request_id] || 0) + 1;
          });
        }
      }

      // Enrich requests with step information
      const enrichedRequests = requests?.map(request => {
        const requestSteps = stepsData.filter(s => s.request_id === request.id);
        const totalSteps = requestSteps.length || 1;
        
        // Find current step (first pending step, or last step if all completed)
        const pendingStep = requestSteps.find(s => s.status === 'pending');
        const currentStepIndex = pendingStep 
          ? pendingStep.step_index 
          : (requestSteps.length > 0 ? requestSteps[requestSteps.length - 1].step_index : 1);
        
        // Get current approver
        const currentApprover = pendingStep?.approver;

        // Extract priority and category from metadata if available
        const metadata = request.metadata || {};
        
        return {
          id: request.id,
          title: request.title,
          description: request.description,
          status: request.status,
          priority: metadata.priority || 'normal',
          category: metadata.category || 'General',
          type: metadata.request_type || 'approval',
          created_at: request.created_at,
          updated_at: request.updated_at,
          current_step: currentStepIndex,
          total_steps: totalSteps,
          current_approver: currentApprover ? {
            id: currentApprover.id,
            name: currentApprover.display_name || currentApprover.email,
            email: currentApprover.email,
          } : null,
          attachments_count: documentCounts[request.id] || 0,
        };
      }) || [];

      // Calculate stats
      const stats = {
        total: enrichedRequests.length,
        pending: enrichedRequests.filter(r => 
          r.status === 'pending' || r.status === 'in_review' || r.status === 'draft'
        ).length,
        approved: enrichedRequests.filter(r => r.status === 'approved').length,
        rejected: enrichedRequests.filter(r => r.status === 'rejected').length,
      };

      return res.status(200).json({ 
        requests: enrichedRequests,
        stats 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('My Requests API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch requests' });
  }
}
