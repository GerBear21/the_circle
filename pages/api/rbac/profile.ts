import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { getUserRBACProfile } from '@/lib/rbac';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const profile = await getUserRBACProfile(session.user.id);
    return res.status(200).json(profile);
  } catch (err) {
    console.error('Error fetching RBAC profile:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
