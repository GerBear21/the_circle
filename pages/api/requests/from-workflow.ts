import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
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

    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const { 
      workflowDefinitionId, 
      title, 
      description, 
      formData,
      submitImmediately = false 
    } = req.body;

    if (!workflowDefinitionId) {
      return res.status(400).json({ error: 'Workflow definition ID is required' });
    }

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Create the request using the ApprovalEngine
    const result = await ApprovalEngine.createRequest(
      workflowDefinitionId,
      organizationId,
      userId,
      title,
      description || null,
      formData || {},
      submitImmediately ? 'pending' : 'draft'
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(201).json({ 
      success: true,
      requestId: result.requestId,
      message: submitImmediately 
        ? 'Request submitted for approval' 
        : 'Request saved as draft'
    });

  } catch (error: any) {
    console.error('Create request from workflow error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create request' });
  }
}
