import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { resolveApprovalChainFromOrganogram } from '@/lib/hrimsClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Employee email is required' });
    }

    const chain = await resolveApprovalChainFromOrganogram(email);

    return res.status(200).json({
      chain: chain.map(item => ({
        position_id: item.position.id,
        position_title: item.position.position_title,
        position_level: item.position.level,
        position_grade: item.position.grade,
        employee_id: item.employee.id,
        employee_name: `${item.employee.first_name} ${item.employee.last_name}`,
        employee_email: item.employee.email,
        employee_job_title: item.employee.job_title,
      })),
      total: chain.length,
    });
  } catch (error: any) {
    console.error('HRIMS Approval Chain API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to resolve approval chain' });
  }
}
