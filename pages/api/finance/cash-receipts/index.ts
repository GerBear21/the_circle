import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAnyPermission } from '../../../../lib/rbac';
import { getUserAccessScope, rowVisibleInScope, scopeForResponse } from '../../../../lib/accessScope';

// GET /api/finance/cash-receipts
// Petty-cash cash-receipt confirmations for the organization, visible to the
// finance department (finance.view_tracker). Never returns the OTP hash.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured.' });

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;
    if (!organizationId) return res.status(400).json({ error: 'Organization ID not found' });

    const { allowed, profile } = await requireAnyPermission(userId, ['finance.view_cash_receipts']);
    if (!allowed) return res.status(403).json({ error: 'You do not have permission to view cash receipts.' });

    const accessScope = await getUserAccessScope(userId, profile);

    const { data, error } = await supabaseAdmin
      .from('cash_receipt_confirmations')
      .select(`
        id, request_id, clerk_email, status, amount, currency, confirmed_at, created_at,
        requestor:app_users!cash_receipt_confirmations_requestor_id_fkey ( id, display_name, email ),
        clerk:app_users!cash_receipt_confirmations_clerk_user_id_fkey ( id, display_name, email ),
        request:requests!cash_receipt_confirmations_request_id_fkey ( id, title, metadata )
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('cash-receipts list failed:', error);
      return res.status(500).json({ error: `Cash receipts query failed: ${error.message}` });
    }

    // Data-access scope: match on the originating request's business unit;
    // the requestor always sees their own receipts.
    const scoped = (data || []).filter((r: any) =>
      rowVisibleInScope(
        {
          unit: r.request?.metadata?.unit || null,
          department: r.request?.metadata?.department || null,
          requestor_id: r.requestor?.id || null,
        },
        accessScope,
        userId,
        { businessUnit: 'unit', department: 'department', owners: ['requestor_id'] }
      )
    );

    const receipts = scoped.map((r: any) => ({
      id: r.id,
      requestId: r.request_id,
      clerkEmail: r.clerk_email,
      status: r.status,
      amount: r.amount,
      currency: r.currency,
      confirmedAt: r.confirmed_at,
      createdAt: r.created_at,
      requestorName: r.requestor?.display_name || r.requestor?.email || '—',
      clerkName: r.clerk?.display_name || null,
      requestTitle: r.request?.title || '—',
      referenceCode: r.request?.metadata?.referenceCode || null,
    }));

    return res.status(200).json({ receipts, scope: scopeForResponse(accessScope) });
  } catch (error: any) {
    console.error('cash-receipts handler error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to load cash receipts' });
  }
}
