import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { ApprovalEngine } from '@/lib/approvalEngine';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = (session.user as any).id;
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    const result = await ApprovalEngine.submitRequest(id, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Request submitted for approval'
    });

  } catch (error: any) {
    console.error('Submit request error:', error);
    return res.status(500).json({ error: error.message || 'Failed to submit request' });
  }
}
