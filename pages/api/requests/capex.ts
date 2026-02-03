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
            const { data: requests, error } = await supabaseAdmin
                .from('requests')
                .select(`
          id,
          title,
          description,
          status,
          metadata,
          created_at,
          creator_id,
          request_steps (
            step_index,
            status,
            approver_user_id,
            approver:app_users!request_steps_approver_user_id_fkey (
              id,
              display_name,
              email
            )
          ),
          creator:app_users!requests_creator_id_fkey (
            id,
            display_name,
            email
          )
        `)
                .eq('organization_id', organizationId)
                .eq('request_type', 'capex')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // SEQUENTIAL APPROVAL VISIBILITY: Filter requests user can see
            const visibleRequests = (requests || []).filter((req: any) => {
                // Creator can always see
                if (req.creator_id === userId) return true;
                
                // Check if user is a watcher
                const watcherIds = req.metadata?.watchers || [];
                const isWatcher = Array.isArray(watcherIds) && watcherIds.some((w: any) => 
                    typeof w === 'string' ? w === userId : w?.id === userId
                );
                if (isWatcher) return true;
                
                // Check if user is an approver with non-waiting step
                const userStep = req.request_steps?.find(
                    (step: any) => step.approver_user_id === userId
                );
                if (userStep && userStep.status !== 'waiting') return true;
                
                return false;
            });

            // Process requests to find current approver
            const requestsWithApprover = visibleRequests.map((req: any) => {
                // Sort steps
                const steps = req.request_steps?.sort((a: any, b: any) => a.step_index - b.step_index) || [];
                // Find first pending step
                const currentStep = steps.find((step: any) => step.status === 'pending');

                return {
                    id: req.id,
                    title: req.title,
                    description: req.description,
                    status: req.status,
                    created_at: req.created_at,
                    amount: req.metadata?.capex?.amount || req.metadata?.amount, // Check both locations just in case
                    currency: req.metadata?.capex?.currency || req.metadata?.currency || 'USD',
                    metadata: req.metadata,
                    requester: req.creator,
                    current_approver: currentStep?.approver || null
                };
            });

            return res.status(200).json({ requests: requestsWithApprover });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error: any) {
        console.error('Capex API error:', error);
        return res.status(500).json({ error: error.message || 'Failed to process request' });
    }
}
