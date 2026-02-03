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

    // Fetch all requests where user is a watcher (stored in metadata.watchers)
    const { data, error } = await supabaseAdmin
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
      .not('status', 'eq', 'draft')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching watching requests:', error);
      return res.status(500).json({ error: 'Failed to fetch watching requests' });
    }

    // Filter to only include requests where user is a watcher
    const watchingRequests = (data || []).filter((req: any) => {
      const watcherIds = req.metadata?.watchers || [];
      return Array.isArray(watcherIds) && watcherIds.some((w: any) => 
        typeof w === 'string' ? w === userId : w?.id === userId
      );
    });

    return res.status(200).json(watchingRequests);
  } catch (error: any) {
    console.error('Watching requests error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
