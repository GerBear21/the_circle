import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { ApprovalEngine } from '@/lib/approvalEngine';
import { withAudit } from '@/lib/withAudit';

/**
 * POST /api/requests/[id]/unsubmit
 *
 * Pulls a pending request back to an editable draft so the requester can amend
 * and resubmit it — allowed only while no approver has acted. Distinct from
 * withdraw (which is terminal). After unsubmitting, the requester edits the
 * form (?edit=<id>) and republishes.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
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

    const result = await ApprovalEngine.unsubmitRequest(id, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({ success: true, message: 'Request unsubmitted for editing' });
  } catch (error: any) {
    console.error('Unsubmit request error:', error);
    return res.status(500).json({ error: error.message || 'Failed to unsubmit request' });
  }
}

// Audit logging is attached automatically at the route boundary.
export default withAudit(handler, {
  category: 'workflow',
  action: 'request.unsubmitted',
  severity: 'notice',
  targetType: 'request',
  details: ({ ok, responseBody }) => (ok ? {} : { error: responseBody?.error }),
});
