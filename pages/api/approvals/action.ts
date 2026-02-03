import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ApprovalEngine } from '@/lib/approvalEngine';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = session.user.id;
    const { requestId, stepId, action, comment } = req.body;

    console.log('Approval action request:', { requestId, stepId, action, userId, types: { requestId: typeof requestId, stepId: typeof stepId } });

    if (!requestId || !stepId || !action) {
      return res.status(400).json({ error: 'requestId, stepId, and action are required' });
    }

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(requestId)) {
      return res.status(400).json({ error: `Invalid requestId format: ${requestId}` });
    }
    if (!uuidRegex.test(stepId)) {
      return res.status(400).json({ error: `Invalid stepId format: ${stepId}` });
    }

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: 'action must be "approve" or "reject"' });
    }

    // Get the user's signature URL if approving
    let signatureUrl: string | null = null;
    if (action === 'approve') {
      const { data } = supabaseAdmin.storage.from('signatures').getPublicUrl(`${userId}.png`);
      try {
        const checkRes = await fetch(data.publicUrl, { method: 'HEAD' });
        if (checkRes.ok) {
          signatureUrl = data.publicUrl;
        }
      } catch (err) {
        console.warn('Could not verify signature exists:', err);
      }
    }

    // Use the ApprovalEngine to process the action
    const result = await ApprovalEngine.processApprovalAction(
      requestId,
      stepId,
      userId,
      action,
      comment,
      signatureUrl || undefined
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({
      success: true,
      message: result.message || `Request ${action === 'approve' ? 'approved' : 'rejected'}`,
      decision: action === 'approve' ? 'approved' : 'rejected',
    });
  } catch (error: any) {
    console.error('Approval action error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
