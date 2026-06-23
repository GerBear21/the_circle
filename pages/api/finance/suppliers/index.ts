import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

// GET /api/finance/suppliers?q=<search>
// Returns the organization's known suppliers (auto-populated from CAPEX
// requests) for the supplier autocomplete on the CAPEX form. Any
// authenticated member of the organization may read the directory — it only
// exposes supplier names/products, no financials.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured.' });

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

    const organizationId = (session.user as any).org_id;
    if (!organizationId) return res.status(400).json({ error: 'Organization ID not found' });

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    let query = supabaseAdmin
      .from('suppliers')
      .select('id, supplier_code, name, products, currency, times_used')
      .eq('organization_id', organizationId)
      .order('times_used', { ascending: false })
      .order('name', { ascending: true })
      .limit(200);

    if (q) {
      // Escape LIKE wildcards so a user typing "%" doesn't match everything.
      const safe = q.replace(/[%_]/g, m => `\\${m}`);
      query = query.ilike('name', `%${safe}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('suppliers list failed:', error);
      return res.status(500).json({ error: `Suppliers query failed: ${error.message}` });
    }

    const suppliers = (data || []).map((s: any) => ({
      id: s.id,
      supplierCode: s.supplier_code || null,
      name: s.name,
      products: s.products || null,
      currency: s.currency || 'USD',
      timesUsed: s.times_used ?? 0,
    }));

    return res.status(200).json({ suppliers });
  } catch (error: any) {
    console.error('suppliers handler error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to load suppliers' });
  }
}
