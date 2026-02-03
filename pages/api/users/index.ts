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

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    // Fetch all users in the organization (potential approvers)
    const { data: users, error } = await supabaseAdmin
      .from('app_users')
      .select('id, display_name, email, role, profile_picture_url')
      .eq('organization_id', organizationId)
      .order('display_name', { ascending: true });

    if (error) throw error;

    return res.status(200).json({ users: users || [] });
  } catch (error: any) {
    console.error('Users API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch users' });
  }
}
