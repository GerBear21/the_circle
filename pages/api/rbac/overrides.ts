import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAnyPermission, logRBACAction } from '@/lib/rbac';

// Per-user permission overrides — grants/denies applied on top of roles.
// GET /api/rbac/overrides?user_id=X → { overrides: [{ code, granted }] }
// PUT /api/rbac/overrides            → replace a user's override set
//     body: { user_id, overrides: [{ code, granted }] }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const callerId = session.user.id;

  const { allowed } = await requireAnyPermission(callerId, ['users.manage_access', 'admin.permissions']);
  if (!allowed) return res.status(403).json({ error: 'Insufficient permissions' });

  if (req.method === 'GET') {
    try {
      const userId = typeof req.query.user_id === 'string' ? req.query.user_id : '';
      if (!userId) return res.status(400).json({ error: 'user_id is required' });

      const { data, error } = await supabaseAdmin
        .from('user_permission_overrides')
        .select('granted, permission:permissions ( code, name, category )')
        .eq('user_id', userId);

      if (error) {
        console.error('rbac/overrides GET failed:', error);
        return res.status(500).json({ error: error.message });
      }

      const overrides = (data || [])
        .map((r: any) => ({
          code: r.permission?.code,
          name: r.permission?.name,
          category: r.permission?.category,
          granted: r.granted,
        }))
        .filter(o => o.code);

      return res.status(200).json({ overrides });
    } catch (err: any) {
      console.error('rbac/overrides GET error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to load overrides' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { user_id, overrides } = req.body || {};
      if (!user_id || !Array.isArray(overrides)) {
        return res.status(400).json({ error: 'user_id and overrides[] are required' });
      }

      // Resolve permission ids in one round-trip
      const codes = overrides.map((o: any) => o.code).filter(Boolean);
      const { data: perms, error: permErr } = await supabaseAdmin
        .from('permissions')
        .select('id, code')
        .in('code', codes.length > 0 ? codes : ['__none__']);

      if (permErr) {
        console.error('rbac/overrides permission lookup failed:', permErr);
        return res.status(500).json({ error: permErr.message });
      }
      const idByCode = new Map((perms || []).map((p: any) => [p.code, p.id]));

      // Replace the full set — simplest correct semantics for a bulk editor.
      const { error: delErr } = await supabaseAdmin
        .from('user_permission_overrides')
        .delete()
        .eq('user_id', user_id);
      if (delErr) {
        console.error('rbac/overrides delete failed:', delErr);
        return res.status(500).json({ error: delErr.message });
      }

      const inserts = overrides
        .filter((o: any) => idByCode.has(o.code) && typeof o.granted === 'boolean')
        .map((o: any) => ({
          user_id,
          permission_id: idByCode.get(o.code),
          granted: o.granted,
          assigned_by: callerId,
        }));

      if (inserts.length > 0) {
        const { error: insErr } = await supabaseAdmin.from('user_permission_overrides').insert(inserts);
        if (insErr) {
          console.error('rbac/overrides insert failed:', insErr);
          return res.status(500).json({ error: insErr.message });
        }
      }

      await logRBACAction(callerId, 'permission_overrides_updated', 'user', user_id, {
        granted: overrides.filter((o: any) => o.granted).map((o: any) => o.code),
        denied: overrides.filter((o: any) => o.granted === false).map((o: any) => o.code),
      });

      return res.status(200).json({ success: true, count: inserts.length });
    } catch (err: any) {
      console.error('rbac/overrides PUT error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to save overrides' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
