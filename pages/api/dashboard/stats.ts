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
    
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    // Fetch all requests for the organization
    const { data: requests, error: requestsError } = await supabaseAdmin
      .from('requests')
      .select('id, status, created_at')
      .eq('organization_id', organizationId);

    if (requestsError) throw requestsError;

    const allRequests = requests || [];
    
    // Calculate stats
    const pending = allRequests.filter(r => r.status === 'pending' || r.status === 'draft').length;
    const approved = allRequests.filter(r => r.status === 'approved').length;
    const rejected = allRequests.filter(r => r.status === 'rejected').length;
    const total = allRequests.length;

    // This month's requests
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const thisMonthRequests = allRequests.filter(
      r => new Date(r.created_at) >= startOfMonth
    ).length;

    // Completion rate (approved / (approved + rejected) * 100)
    const completed = approved + rejected;
    const completionRate = completed > 0 ? Math.round((approved / completed) * 100) : 0;

    // Fetch pending approvals for the current user
    let pendingForUser = 0;
    if (userId) {
      const { data: pendingSteps } = await supabaseAdmin
        .from('request_steps')
        .select('id')
        .eq('approver_user_id', userId)
        .eq('status', 'pending');
      
      pendingForUser = pendingSteps?.length || 0;
    }

    // Fetch recent activity with request_steps for visibility filtering
    const { data: recentRequests, error: recentError } = await supabaseAdmin
      .from('requests')
      .select(`
        id,
        title,
        status,
        created_at,
        metadata,
        creator_id,
        creator:app_users!requests_creator_id_fkey (
          display_name,
          email
        ),
        request_steps (
          approver_user_id,
          status
        )
      `)
      .eq('organization_id', organizationId)
      .neq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(50);

    if (recentError) throw recentError;

    // SEQUENTIAL APPROVAL VISIBILITY: Filter requests user can see
    const filteredRecentRequests = (recentRequests || []).filter((req: any) => {
      if (req.creator_id === userId) return true;
      
      const watcherIds = req.metadata?.watchers || [];
      const isWatcher = Array.isArray(watcherIds) && watcherIds.some((w: any) => 
        typeof w === 'string' ? w === userId : w?.id === userId
      );
      if (isWatcher) return true;
      
      const userStep = req.request_steps?.find(
        (step: any) => step.approver_user_id === userId
      );
      if (userStep && userStep.status !== 'waiting') return true;
      
      return false;
    }).slice(0, 10);

    // Fetch team members in the same organization
    const { data: members, error: membersError } = await supabaseAdmin
      .from('app_users')
      .select('id, display_name, email')
      .eq('organization_id', organizationId)
      .limit(10);

    if (membersError) throw membersError;

    return res.status(200).json({
      stats: {
        pending,
        approved,
        rejected,
        total,
        thisMonthRequests,
        completionRate,
      },
      recentActivity: filteredRecentRequests || [],
      teamMembers: members || [],
      pendingForUser,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
}
