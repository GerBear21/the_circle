import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { fetchHrimsEmployeeByEmail } from '@/lib/hrimsClient';

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

    // Use the provided email or fall back to the session user's email
    const targetEmail = (email as string) || session.user.email;

    if (!targetEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await fetchHrimsEmployeeByEmail(targetEmail);

    if (!result) {
      return res.status(404).json({ 
        found: false, 
        message: 'Employee not found in HRIMS database' 
      });
    }

    return res.status(200).json({
      found: true,
      employee: result.employee,
      department: result.department,
      businessUnit: result.businessUnit,
      position: result.position,
    });
  } catch (error: any) {
    console.error('HRIMS Employee by Email API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch employee from HRIMS' });
  }
}
