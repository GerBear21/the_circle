import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAnyPermission, logRBACAction } from '@/lib/rbac';
import { getUserAccessScope, scopeForResponse, ScopeLevel } from '@/lib/accessScope';

const SCOPE_LEVELS: ScopeLevel[] = ['own', 'department', 'business_unit', 'custom', 'organization'];

// GET  /api/rbac/scope            → caller's resolved scope (for UI banners/filters)
// GET  /api/rbac/scope?user_id=X  → X's resolved scope + raw setting (admins only)
// PUT  /api/rbac/scope            → set a user's scope (admins only)
//      body: { user_id, scope_level, business_unit_ids?: string[] }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const callerId = session.user.id;
  const orgId = (session.user as any).org_id;
  if (!orgId) return res.status(400).json({ error: 'No organization found' });

  if (req.method === 'GET') {
    try {
      const targetId = typeof req.query.user_id === 'string' ? req.query.user_id : callerId;

      if (targetId !== callerId) {
        const { allowed } = await requireAnyPermission(callerId, ['users.manage_access', 'users.assign_roles']);
        if (!allowed) return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const scope = await getUserAccessScope(targetId);

      // Raw setting (for the admin editor — distinct from the resolved scope)
      const { data: scopeRow } = await supabaseAdmin
        .from('user_access_scopes')
        .select('id, scope_level')
        .eq('user_id', targetId)
        .maybeSingle();

      let businessUnitNames: string[] = [];
      if (scopeRow) {
        const { data: buRows } = await supabaseAdmin
          .from('user_scope_business_units')
          .select('business_unit_name')
          .eq('scope_id', scopeRow.id);
        businessUnitNames = (buRows || []).map((r: any) => r.business_unit_name).filter(Boolean);
      }

      return res.status(200).json({
        scope: scopeForResponse(scope),
        setting: {
          scope_level: scopeRow?.scope_level || 'business_unit',
          business_unit_names: businessUnitNames,
          is_explicit: !!scopeRow,
        },
      });
    } catch (err: any) {
      console.error('rbac/scope GET error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to resolve scope' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { allowed } = await requireAnyPermission(callerId, ['users.manage_access', 'users.assign_roles']);
      if (!allowed) return res.status(403).json({ error: 'Insufficient permissions' });

      const { user_id, scope_level, business_unit_names } = req.body || {};
      if (!user_id || !scope_level) {
        return res.status(400).json({ error: 'user_id and scope_level are required' });
      }
      if (!SCOPE_LEVELS.includes(scope_level)) {
        return res.status(400).json({ error: `scope_level must be one of: ${SCOPE_LEVELS.join(', ')}` });
      }
      if (scope_level === 'custom' && (!Array.isArray(business_unit_names) || business_unit_names.length === 0)) {
        return res.status(400).json({ error: 'custom scope requires at least one business unit' });
      }

      const { data: scopeRow, error: upsertErr } = await supabaseAdmin
        .from('user_access_scopes')
        .upsert(
          {
            user_id,
            organization_id: orgId,
            scope_level,
            updated_by: callerId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select('id')
        .single();

      if (upsertErr || !scopeRow) {
        console.error('rbac/scope upsert failed:', upsertErr);
        return res.status(500).json({ error: upsertErr?.message || 'Failed to save scope' });
      }

      // Replace the custom BU list (cleared for non-custom levels)
      await supabaseAdmin.from('user_scope_business_units').delete().eq('scope_id', scopeRow.id);
      if (scope_level === 'custom') {
        const uniqueNames = Array.from(
          new Set((business_unit_names as string[]).map(n => String(n).trim()).filter(Boolean))
        );
        const inserts = uniqueNames.map(name => ({
          scope_id: scopeRow.id,
          business_unit_name: name,
        }));
        const { error: buErr } = await supabaseAdmin.from('user_scope_business_units').insert(inserts);
        if (buErr) {
          console.error('rbac/scope BU insert failed:', buErr);
          return res.status(500).json({ error: buErr.message });
        }
      }

      await logRBACAction(callerId, 'access_scope_updated', 'user_access_scope', user_id, {
        scope_level,
        business_unit_names: scope_level === 'custom' ? business_unit_names : undefined,
      });

      const scope = await getUserAccessScope(user_id);
      return res.status(200).json({ success: true, scope: scopeForResponse(scope) });
    } catch (err: any) {
      console.error('rbac/scope PUT error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to save scope' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
