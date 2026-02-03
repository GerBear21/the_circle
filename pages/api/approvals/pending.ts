import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = session.user.id;

    // SEQUENTIAL APPROVAL: Only fetch requests where user's specific step is 'pending'
    // First, get the step IDs where this user is the approver AND status is pending
    const { data: pendingSteps, error: stepsError } = await supabaseAdmin
      .from('request_steps')
      .select('request_id')
      .eq('approver_user_id', userId)
      .eq('status', 'pending');

    if (stepsError) {
      console.error('Error fetching pending steps:', stepsError);
      return res.status(500).json({ error: 'Failed to fetch pending approvals' });
    }

    if (!pendingSteps || pendingSteps.length === 0) {
      return res.status(200).json([]);
    }

    const requestIds = pendingSteps.map(s => s.request_id);

    // Now fetch the full request data for those specific requests
    const { data, error: fetchError } = await supabaseAdmin
      .from('requests')
      .select(`
        id,
        organization_id,
        workspace_id,
        creator_id,
        title,
        description,
        status,
        metadata,
        created_at,
        updated_at,
        creator:app_users!requests_creator_id_fkey (
          id,
          display_name,
          email,
          profile_picture_url
        ),
        request_steps (
          id,
          step_index,
          step_type,
          approver_role,
          approver_user_id,
          status,
          due_at
        )
      `)
      .in('id', requestIds)
      .in('status', ['pending', 'pending_approval'])
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching pending approvals:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch pending approvals' });
    }

    // Double-check: only return requests where user's step is actually pending
    const filteredData = (data || []).filter((req: any) => {
      const userStep = req.request_steps?.find(
        (step: any) => step.approver_user_id === userId && step.status === 'pending'
      );
      return !!userStep;
    });

    return res.status(200).json(filteredData);
  } catch (error: any) {
    console.error('Pending approvals error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
