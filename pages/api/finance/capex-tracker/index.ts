import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAnyPermission } from '../../../../lib/rbac';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!supabaseAdmin) {
      console.error('capex-tracker: supabaseAdmin is null. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.');
      return res.status(500).json({ error: 'Server is misconfigured (Supabase admin client missing).' });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found on session.' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'User ID not found on session.' });
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { allowed } = await requireAnyPermission(userId, ['finance.view_tracker']);
      if (!allowed) {
        return res.status(403).json({ error: 'You do not have permission to view the CAPEX tracker.' });
      }
    } catch (permErr: any) {
      console.error('capex-tracker permission check threw:', permErr);
      return res.status(500).json({ error: `Permission check failed: ${permErr?.message || permErr}` });
    }

    const { department, status, from, to, supplier, financial_year } = req.query;

    // Champions are joined in a separate query (below) rather than via an embedded select.
    // capex_tracker has multiple FKs to app_users (champion_user_id, created_by, last_updated_by),
    // and embedded joins on multi-FK tables can fail depending on the PostgREST relationship cache.
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
        last_updated_by
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

    let data: any[] | null = null;
    try {
      const result = await query;
      if (result.error) {
        console.error('capex-tracker primary query failed:', {
          message: result.error.message,
          details: (result.error as any).details,
          hint: (result.error as any).hint,
          code: (result.error as any).code,
        });
        return res.status(500).json({
          error: `Tracker query failed: ${result.error.message || 'unknown error'}`,
          code: (result.error as any).code || null,
          hint: (result.error as any).hint || null,
        });
      }
      data = result.data;
    } catch (queryThrow: any) {
      console.error('capex-tracker primary query threw:', queryThrow);
      return res.status(500).json({ error: `Tracker query threw: ${queryThrow?.message || queryThrow}` });
    }

    const entries = data || [];

    // Enrich each entry with approval-step info so the UI can derive
    // "who's left to sign" without an extra round-trip per row.
    // Enrichment is best-effort — a failure here must not 500 the whole list.
    const requestIds = Array.from(
      new Set(entries.map((e: any) => e.request_id).filter((x: any): x is string => typeof x === 'string' && x.length > 0))
    );

    const stepsByRequest: Record<string, any[]> = {};
    const requestMetaById: Record<string, { creatorId: string | null; approverRoles: Record<string, string>; priority: string | null }> = {};

    if (requestIds.length > 0) {
      try {
        const { data: steps, error: stepsErr } = await supabaseAdmin
          .from('request_steps')
          .select(
            `
            id,
            request_id,
            step_index,
            status,
            approver_user_id,
            approver:app_users!request_steps_approver_user_id_fkey (
              id,
              display_name,
              email
            )
          `
          )
          .in('request_id', requestIds)
          .order('step_index', { ascending: true });

        if (stepsErr) {
          console.error('capex-tracker steps enrichment failed (non-fatal):', stepsErr);
        } else {
          for (const step of steps || []) {
            const rid = (step as any).request_id as string;
            if (!stepsByRequest[rid]) stepsByRequest[rid] = [];
            stepsByRequest[rid].push(step);
          }
        }
      } catch (stepsCatch) {
        console.error('capex-tracker steps enrichment threw (non-fatal):', stepsCatch);
      }

      try {
        const { data: requestRows, error: reqErr } = await supabaseAdmin
          .from('requests')
          .select('id, creator_id, metadata')
          .in('id', requestIds);

        if (reqErr) {
          console.error('capex-tracker request meta enrichment failed (non-fatal):', reqErr);
        } else {
          for (const r of requestRows || []) {
            const meta = ((r as any).metadata) || {};
            requestMetaById[(r as any).id] = {
              creatorId: (r as any).creator_id ?? null,
              approverRoles: meta.approverRoles || {},
              priority: meta.priority || null,
            };
          }
        }
      } catch (reqCatch) {
        console.error('capex-tracker request meta enrichment threw (non-fatal):', reqCatch);
      }
    }

    // Champion lookup — collect every unique champion_user_id and fetch in one round-trip.
    const championIds = Array.from(
      new Set(entries.map((e: any) => e.champion_user_id).filter((x: any): x is string => typeof x === 'string' && x.length > 0))
    );
    const championById: Record<string, { id: string; display_name: string | null; email: string | null; profile_picture_url: string | null }> = {};
    if (championIds.length > 0) {
      try {
        const { data: champs, error: champErr } = await supabaseAdmin
          .from('app_users')
          .select('id, display_name, email, profile_picture_url')
          .in('id', championIds);
        if (champErr) {
          console.error('capex-tracker champion enrichment failed (non-fatal):', champErr);
        } else {
          for (const c of champs || []) championById[(c as any).id] = c as any;
        }
      } catch (champCatch) {
        console.error('capex-tracker champion enrichment threw (non-fatal):', champCatch);
      }
    }

    const enriched = entries.map((e: any) => {
      const steps = e.request_id ? (stepsByRequest[e.request_id] || []) : [];
      const meta = e.request_id ? requestMetaById[e.request_id] : null;
      const champion = e.champion_user_id ? championById[e.champion_user_id] ?? null : null;
      return {
        ...e,
        champion,
        steps,
        creator_id: meta?.creatorId ?? null,
        approver_roles: meta?.approverRoles ?? {},
        request_priority: meta?.priority ?? null,
      };
    });

    return res.status(200).json({ entries: enriched });
  } catch (error: any) {
    console.error('capex-tracker outer catch:', {
      message: error?.message,
      stack: error?.stack?.split('\n').slice(0, 5).join('\n'),
      raw: error,
    });
    return res.status(500).json({
      error: error?.message || 'Failed to fetch tracker',
      where: 'outer-catch',
    });
  }
}
