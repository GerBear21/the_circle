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

    const { ids } = req.query;

    if (!ids || typeof ids !== 'string') {
      return res.status(400).json({ error: 'User IDs are required' });
    }

    const userIds = ids.split(',').filter(id => id.trim());

    if (userIds.length === 0) {
      return res.status(200).json({ users: [] });
    }

    const { data: users, error } = await supabaseAdmin
      .from('app_users')
      .select('id, display_name, email, profile_picture_url')
      .in('id', userIds);

    if (error) {
      throw error;
    }

    return res.status(200).json({ users: users || [] });
  } catch (error: any) {
    console.error('Users by IDs API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch users' });
  }
}
