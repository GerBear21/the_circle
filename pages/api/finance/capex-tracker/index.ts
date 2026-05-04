import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAnyPermission } from '../../../../lib/rbac';

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

    const { allowed } = await requireAnyPermission(userId, ['finance.view_tracker']);
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have permission to view the CAPEX tracker.' });
    }

    const { department, status, from, to, supplier, financial_year } = req.query;

    let query = supabaseAdmin
      .from('capex_tracker')
      .select(
        `
        id,
        request_id,
        ranking,
        supplier,
        description,
        capex_date,
        cost,
        funded,
        balance,
        champion_user_id,
        status_update,
        department,
        financial_year,
        is_budgeted,
        created_at,
        last_updated_at,
        last_updated_by,
        champion:app_users!capex_tracker_champion_user_id_fkey (
          id,
          display_name,
          email,
          profile_picture_url
        )
      `
      )
      .eq('organization_id', organizationId)
      .order('ranking', { ascending: true, nullsFirst: false })
      .order('capex_date', { ascending: false });

    if (typeof department === 'string' && department.length > 0) {
      query = query.eq('department', department);
    }
    if (typeof status === 'string' && status.length > 0) {
      query = query.eq('status_update', status);
    }
    if (typeof from === 'string' && from.length > 0) {
      query = query.gte('capex_date', from);
    }
    if (typeof to === 'string' && to.length > 0) {
      query = query.lte('capex_date', to);
    }
    if (typeof supplier === 'string' && supplier.length > 0) {
      query = query.ilike('supplier', `%${supplier}%`);
    }
    if (typeof financial_year === 'string' && financial_year.length > 0) {
      const fy = Number(financial_year);
      if (Number.isFinite(fy)) query = query.eq('financial_year', fy);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({ entries: data || [] });
  } catch (error: any) {
    console.error('capex-tracker list error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch tracker' });
  }
}
