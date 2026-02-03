import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;
    const { id: requestId } = req.query;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    if (!requestId || typeof requestId !== 'string') {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify the request exists and user has access
    const { data: request, error: requestError } = await supabaseAdmin
      .from('requests')
      .select(`
        id, 
        creator_id, 
        metadata,
        request_steps (
          id,
          approver_user_id,
          status
        )
      `)
      .eq('id', requestId)
      .eq('organization_id', organizationId)
      .single();

    if (requestError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // SEQUENTIAL APPROVAL VISIBILITY CHECK
    // User can view if they are: creator, watcher, or approver with non-waiting step
    const isCreator = request.creator_id === userId;
    
    const watcherIds = request.metadata?.watchers || [];
    const isWatcher = Array.isArray(watcherIds) && watcherIds.some((w: any) => 
      typeof w === 'string' ? w === userId : w?.id === userId
    );
    
    // Approvers can only view when their step is pending/approved/rejected (not waiting)
    const userStep = request.request_steps?.find((step: any) => step.approver_user_id === userId);
    const canApproverView = userStep && userStep.status !== 'waiting';

    if (!isCreator && !isWatcher && !canApproverView) {
      if (userStep && userStep.status === 'waiting') {
        return res.status(403).json({ 
          error: 'This request is not yet ready for your review.',
          code: 'APPROVAL_NOT_YOUR_TURN'
        });
      }
      return res.status(403).json({ error: 'You do not have access to view this request' });
    }

    // Get modifications for this request
    const { data: modifications, error: modError } = await supabaseAdmin
      .from('request_modifications')
      .select(`
        id,
        modification_type,
        field_name,
        old_value,
        new_value,
        document_filename,
        created_at,
        modified_by
      `)
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    if (modError) {
      console.error('Error fetching modifications:', modError);
      return res.status(200).json({ modifications: [] });
    }

    // Fetch user details for each modification
    const modifiedByIds = Array.from(new Set((modifications || []).map((m: any) => m.modified_by)));
    let usersMap: Record<string, any> = {};
    
    if (modifiedByIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('app_users')
        .select('id, display_name, email, profile_picture_url')
        .in('id', modifiedByIds);
      
      if (users) {
        usersMap = users.reduce((acc: Record<string, any>, user: any) => {
          acc[user.id] = user;
          return acc;
        }, {});
      }
    }

    // Combine modifications with user data
    const modificationsWithUsers = (modifications || []).map((mod: any) => ({
      ...mod,
      modified_by: usersMap[mod.modified_by] || { id: mod.modified_by, display_name: 'Unknown User' }
    }));

    return res.status(200).json({ modifications: modificationsWithUsers });
  } catch (error: any) {
    console.error('Modifications API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch modifications' });
  }
}
