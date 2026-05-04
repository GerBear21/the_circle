import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAnyPermission } from '../../../../lib/rbac';

const STORAGE_BUCKET = 'capex-budgets';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { allowed } = await requireAnyPermission(userId, ['finance.view_budget']);
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have permission to view the CAPEX budget.' });
    }

    const financialYearParam = req.query.financial_year;
    const requestedYear = typeof financialYearParam === 'string' ? Number(financialYearParam) : null;

    let query = supabaseAdmin
      .from('capex_budgets')
      .select('*')
      .eq('organization_id', organizationId);

    if (requestedYear && Number.isFinite(requestedYear)) {
      query = query.eq('financial_year', requestedYear);
    } else {
      query = query.order('financial_year', { ascending: false }).limit(1);
    }

    const { data: budgets, error } = await query;
    if (error) throw error;

    const budget = Array.isArray(budgets) ? budgets[0] : budgets;
    if (!budget) {
      return res.status(200).json({ budget: null, download_url: null });
    }

    let downloadUrl: string | null = null;
    if (!budget.is_placeholder) {
      const { data: signed } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(budget.budget_document_path, 3600);
      downloadUrl = signed?.signedUrl || null;
    }

    return res.status(200).json({ budget, download_url: downloadUrl });
  } catch (error: any) {
    console.error('capex budget fetch error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch budget' });
  }
}
