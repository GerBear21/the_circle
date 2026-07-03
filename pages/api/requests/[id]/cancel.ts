import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { ApprovalEngine } from '@/lib/approvalEngine';
import { withAudit } from '@/lib/withAudit';
import { validateBody, z } from '@/lib/validate';

const CancelSchema = z
  .object({
    reason: z.string().min(1).max(5000),
  })
  .strip();

/**
 * POST /api/requests/[id]/cancel
 *
 * Cancels a request with a mandatory reason. Either the requester OR any
 * approver on the request may cancel, at any stage — including after the
 * request has been fully approved. The record is preserved; the engine flips
 * the status to 'cancelled' and stores a cancellation snapshot in metadata.
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

    const parsed = validateBody(req, res, CancelSchema);
    if (!parsed) return;

    const result = await ApprovalEngine.cancelRequest(id, userId, parsed.reason);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({ success: true, message: 'Request cancelled' });
  } catch (error: any) {
    console.error('Cancel request error:', error);
    return res.status(500).json({ error: error.message || 'Failed to cancel request' });
  }
}

// Audit logging is attached automatically at the route boundary.
export default withAudit(handler, {
  category: 'workflow',
  action: 'request.cancelled',
  severity: 'notice',
  targetType: 'request',
  details: ({ req, ok, responseBody }) => ({
    reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined,
    ...(ok ? {} : { error: responseBody?.error }),
  }),
});
