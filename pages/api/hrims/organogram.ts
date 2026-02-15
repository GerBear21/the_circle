import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import {
  fetchOrganogramPositions,
  buildOrganogramTree,
} from '@/lib/hrimsClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { business_unit_id, tree } = req.query;

    const positions = await fetchOrganogramPositions(
      business_unit_id as string | undefined
    );

    if (tree === 'true') {
      const treeData = buildOrganogramTree(positions);
      return res.status(200).json({ organogram: treeData, total: positions.length });
    }

    return res.status(200).json({ positions, total: positions.length });
  } catch (error: any) {
    console.error('HRIMS Organogram API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch organogram data' });
  }
}
