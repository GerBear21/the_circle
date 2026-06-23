import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAnyPermission } from '../../../../lib/rbac';
import { CapexTrackerStatus } from '../../../../lib/capexTrackerHooks';

// GET  /api/finance/capex-payments  — list every supplier payment for the org,
//        joined to its tracker entry (supplier, description, cost).
// POST /api/finance/capex-payments  — record a payment to a supplier against a
//        tracker entry, then re-derive the entry's funded amount + status.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Server is misconfigured (Supabase admin client missing).' });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;
    if (!organizationId) return res.status(400).json({ error: 'Organization ID not found on session.' });

    if (req.method === 'GET') {
      const { allowed } = await requireAnyPermission(userId, ['finance.view_suppliers']);
      if (!allowed) return res.status(403).json({ error: 'You do not have permission to view supplier payments.' });

      const { data, error } = await supabaseAdmin
        .from('capex_payments')
        .select(`
          id, capex_tracker_id, amount, payment_date, period, reference, notes, created_at,
          tracker:capex_tracker!capex_payments_capex_tracker_id_fkey (
            id, supplier, description, cost, funded, balance, department, status_update, financial_year
          )
        `)
        .eq('organization_id', organizationId)
        .order('payment_date', { ascending: false });

      if (error) {
        console.error('capex-payments list failed:', error);
        return res.status(500).json({ error: `Payments query failed: ${error.message}` });
      }
      return res.status(200).json({ payments: data || [] });
    }

    if (req.method === 'POST') {
      const { allowed } = await requireAnyPermission(userId, ['finance.edit_tracker']);
      if (!allowed) return res.status(403).json({ error: 'You do not have permission to record supplier payments.' });

      const body = (req.body && typeof req.body === 'object') ? req.body : {};
      const trackerId = body.capex_tracker_id;
      const amount = Number(body.amount);
      const paymentDate = body.payment_date;

      if (!trackerId || typeof trackerId !== 'string') {
        return res.status(400).json({ error: 'capex_tracker_id is required' });
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'amount must be a positive number' });
      }
      if (!paymentDate || typeof paymentDate !== 'string') {
        return res.status(400).json({ error: 'payment_date is required' });
      }

      // Confirm the tracker entry belongs to this org and read its cost.
      const { data: tracker, error: trackerErr } = await supabaseAdmin
        .from('capex_tracker')
        .select('id, cost, organization_id')
        .eq('id', trackerId)
        .single();
      if (trackerErr || !tracker) return res.status(404).json({ error: 'Tracker entry not found' });
      if (tracker.organization_id !== organizationId) {
        return res.status(403).json({ error: 'Not authorized for this organization' });
      }

      const { data: payment, error: insertErr } = await supabaseAdmin
        .from('capex_payments')
        .insert({
          capex_tracker_id: trackerId,
          organization_id: organizationId,
          amount,
          payment_date: paymentDate,
          period: typeof body.period === 'string' && body.period.trim() ? body.period.trim() : null,
          reference: typeof body.reference === 'string' && body.reference.trim() ? body.reference.trim() : null,
          notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
          created_by: userId,
        })
        .select()
        .single();

      if (insertErr) {
        console.error('capex-payments insert failed:', insertErr);
        return res.status(500).json({ error: `Failed to record payment: ${insertErr.message}` });
      }

      // Re-derive funded from the sum of all payments, capped at cost, and move
      // the lifecycle status forward to match the new funding level.
      const { data: allPayments } = await supabaseAdmin
        .from('capex_payments')
        .select('amount')
        .eq('capex_tracker_id', trackerId);

      const totalPaid = (allPayments || []).reduce((sum, p: any) => sum + Number(p.amount || 0), 0);
      const cost = Number(tracker.cost || 0);
      const funded = Math.min(totalPaid, cost);

      let nextStatus: CapexTrackerStatus | undefined;
      if (cost > 0 && funded >= cost) nextStatus = 'Fully Funded';
      else if (funded > 0) nextStatus = 'Funding Partially Allocated';

      const update: Record<string, any> = {
        funded,
        last_updated_by: userId,
        last_updated_at: new Date().toISOString(),
      };
      if (nextStatus) update.status_update = nextStatus;

      const { error: updErr } = await supabaseAdmin
        .from('capex_tracker')
        .update(update)
        .eq('id', trackerId);
      if (updErr) console.error('capex-payments tracker funded update failed (non-fatal):', updErr);

      return res.status(201).json({ payment, funded, status_update: nextStatus });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('capex-payments handler error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to process supplier payments' });
  }
}
