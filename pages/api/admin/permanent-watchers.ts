import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getUserRBACProfile, hasAnyPermission, PERMISSIONS } from '@/lib/rbac';
import { audit } from '@/lib/auditLog';

/**
 * Admin management of permanent watchers for ARBITRARY owners.
 *
 * The self-service endpoint (pages/api/user/permanent-watchers.ts) forces the
 * owner to be the signed-in user. This admin variant lets a systems admin make
 * one user a permanent watcher of another (e.g. an assistant watching an
 * executive). Both write the same `permanent_watchers` table, so visibility
 * logic (lib/permanentWatchers.ts) is shared.
 *
 *   GET    ?watcherId= | ?ownerId= — list matching rows (joined to names).
 *   POST   { ownerId, watcherId } — add.
 *   DELETE ?id= | ?ownerId=&watcherId= — remove.
 *
 * Gated to systems admins / super users (admin.roles or users.assign_roles).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const user = session.user as any;
  const organizationId = user.org_id;
  if (!organizationId) return res.status(400).json({ error: 'No organization found' });

  const profile = await getUserRBACProfile(user.id);
  if (!hasAnyPermission(profile, [PERMISSIONS.ADMIN_ROLES, PERMISSIONS.USERS_ASSIGN_ROLES])) {
    return res.status(403).json({ error: 'You do not have permission to manage watchers' });
  }

  // ---- GET: list -----------------------------------------------------------
  if (req.method === 'GET') {
    let query = supabaseAdmin
      .from('permanent_watchers')
      .select(`
        id, created_at, owner_id, watcher_id, created_by,
        owner:app_users!permanent_watchers_owner_id_fkey ( id, display_name, email, job_title ),
        watcher:app_users!permanent_watchers_watcher_id_fkey ( id, display_name, email, job_title )
      `)
      .eq('organization_id', organizationId)
      // Only surface admin-managed watchers here; users' own watchers stay in
      // the self-service card.
      .eq('is_admin_managed', true)
      .order('created_at', { ascending: false });

    const watcherId = req.query.watcherId as string | undefined;
    const ownerId = req.query.ownerId as string | undefined;
    if (watcherId) query = query.eq('watcher_id', watcherId);
    if (ownerId) query = query.eq('owner_id', ownerId);

    const { data, error } = await query;
    if (error) {
      console.error('admin permanent-watchers list failed:', error);
      return res.status(500).json({ error: 'Failed to load watchers' });
    }
    return res.status(200).json({ watchers: data || [] });
  }

  // ---- POST: add -----------------------------------------------------------
  if (req.method === 'POST') {
    const ownerId = req.body?.ownerId;
    const watcherId = req.body?.watcherId;
    if (!ownerId || !watcherId || typeof ownerId !== 'string' || typeof watcherId !== 'string') {
      return res.status(400).json({ error: 'ownerId and watcherId are required' });
    }
    if (ownerId === watcherId) {
      return res.status(400).json({ error: 'A user cannot watch themselves' });
    }

    const { data: found } = await supabaseAdmin
      .from('app_users')
      .select('id')
      .eq('organization_id', organizationId)
      .in('id', [ownerId, watcherId]);
    if (!found || found.length !== 2) {
      return res.status(400).json({ error: 'Owner or watcher not found in your organization' });
    }

    const { data, error } = await supabaseAdmin
      .from('permanent_watchers')
      .upsert(
        { organization_id: organizationId, owner_id: ownerId, watcher_id: watcherId, created_by: user.id, is_admin_managed: true },
        { onConflict: 'owner_id,watcher_id' }
      )
      .select('id')
      .single();

    if (error) {
      console.error('admin permanent-watchers add failed:', error);
      return res.status(500).json({ error: 'Failed to add watcher' });
    }

    await audit(req, user, {
      category: 'security',
      action: 'permanent_watcher.added',
      targetType: 'user',
      targetId: watcherId,
      details: { ownerId, byAdmin: true },
    });

    return res.status(201).json({ id: data.id });
  }

  // ---- DELETE: remove ------------------------------------------------------
  if (req.method === 'DELETE') {
    const id = (req.query.id as string) || null;
    const ownerId = (req.query.ownerId as string) || null;
    const watcherId = (req.query.watcherId as string) || null;
    if (!id && !(ownerId && watcherId)) {
      return res.status(400).json({ error: 'id, or both ownerId and watcherId, are required' });
    }

    let query = supabaseAdmin
      .from('permanent_watchers')
      .delete()
      .eq('organization_id', organizationId);
    query = id
      ? query.eq('id', id)
      : query.eq('owner_id', ownerId as string).eq('watcher_id', watcherId as string);

    const { error } = await query;
    if (error) {
      console.error('admin permanent-watchers remove failed:', error);
      return res.status(500).json({ error: 'Failed to remove watcher' });
    }

    await audit(req, user, {
      category: 'security',
      action: 'permanent_watcher.removed',
      targetType: 'user',
      targetId: watcherId || id,
      details: { ownerId, byAdmin: true },
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
