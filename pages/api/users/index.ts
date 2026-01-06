import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const orgId = (session.user as any)?.org_id;

  if (req.method === 'GET') {
    try {
      const query = supabaseAdmin
        .from('app_users')
        .select('id, display_name, email, department_id, departments(name)');

      const { data: users, error } = await query.order('display_name', { ascending: true });
      
      // Transform the response to include department name as 'department' for backwards compatibility
      const transformedUsers = users?.map(user => ({
        id: user.id,
        display_name: user.display_name,
        email: user.email,
        department: (user.departments as any)?.name || null
      })) || [];

      if (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ error: 'Failed to fetch users' });
      }

      console.log('Users API - orgId:', orgId, 'users count:', transformedUsers.length);

      return res.status(200).json({ users: transformedUsers });
    } catch (error) {
      console.error('Error in users API:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
