import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { fetchHrimsEmployees } from '@/lib/hrimsClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { business_unit_id } = req.query;

    const employees = await fetchHrimsEmployees(
      business_unit_id as string | undefined
    );

    return res.status(200).json({ employees, total: employees.length });
  } catch (error: any) {
    console.error('HRIMS Employees API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch HRIMS employees' });
  }
}
