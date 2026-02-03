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

    // Fetch requests where user was an approver and their step is completed (approved/rejected)
    const { data: completedSteps, error: stepsError } = await supabaseAdmin
      .from('request_steps')
      .select('request_id')
      .eq('approver_user_id', userId)
      .in('status', ['approved', 'rejected']);

    if (stepsError) {
      console.error('Error fetching completed steps:', stepsError);
      return res.status(500).json({ error: 'Failed to fetch approval history' });
    }

    if (!completedSteps || completedSteps.length === 0) {
      return res.status(200).json([]);
    }

    const requestIds = Array.from(new Set(completedSteps.map(s => s.request_id)));

    // Fetch the full request data
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
      .order('updated_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching approval history:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch approval history' });
    }

    // Add user's action info to each request by finding their step
    const historyWithAction = (data || []).map((req: any) => {
      const userStep = req.request_steps?.find(
        (step: any) => step.approver_user_id === userId && ['approved', 'rejected'].includes(step.status)
      );
      return {
        ...req,
        user_action: userStep?.status || null,
        user_action_date: req.updated_at || null,
        user_comment: null,
      };
    });

    return res.status(200).json(historyWithAction);
  } catch (error: any) {
    console.error('Approval history error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
