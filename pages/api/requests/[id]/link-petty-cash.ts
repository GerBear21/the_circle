import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

/**
 * POST /api/requests/[id]/link-petty-cash
 *
 * Writes a back-reference into the parent request's metadata so its detail
 * page can show the linked petty cash voucher. Only the original creator may
 * call this — the petty cash form invokes it after a successful submission.
 */
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
    const { id: parentRequestId } = req.query;
    const { pettyCashRequestId } = req.body || {};

    if (!organizationId) return res.status(400).json({ error: 'Organization ID not found' });
    if (!parentRequestId || typeof parentRequestId !== 'string') {
      return res.status(400).json({ error: 'Parent request ID is required' });
    }
    if (!pettyCashRequestId || typeof pettyCashRequestId !== 'string') {
      return res.status(400).json({ error: 'pettyCashRequestId is required' });
    }

    const { data: parent, error: parentError } = await supabaseAdmin
      .from('requests')
      .select('id, creator_id, metadata')
      .eq('id', parentRequestId)
      .eq('organization_id', organizationId)
      .single();

    if (parentError || !parent) {
      return res.status(404).json({ error: 'Parent request not found' });
    }

    if (parent.creator_id !== userId) {
      return res.status(403).json({ error: 'Only the request creator may link a petty cash voucher' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('requests')
      .update({
        metadata: {
          ...(parent.metadata || {}),
          linkedPettyCashId: pettyCashRequestId,
        },
      })
      .eq('id', parentRequestId);

    if (updateError) {
      console.error('Failed to write linkedPettyCashId on parent request:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('link-petty-cash error:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}
