import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { audit } from '@/lib/auditLog';

/**
 * Manage the current user's permanent watchers (people who may read-only view
 * everything this user posts or is an approver on).
 *
 *   GET    — list my watchers (with their names).
 *   POST   { watcherId } — add a watcher.
 *   DELETE ?id= | ?watcherId= — remove a watcher.
 *
 * The signed-in user is always the OWNER; you can only manage your own list.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const user = session.user as any;
  const ownerId = user.id;
  const organizationId = user.org_id;
  if (!organizationId) return res.status(400).json({ error: 'No organization found' });

  // ---- GET: list -----------------------------------------------------------
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('permanent_watchers')
      .select('id, created_at, watcher:app_users!permanent_watchers_watcher_id_fkey ( id, display_name, email, job_title )')
      .eq('organization_id', organizationId)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('permanent-watchers list failed:', error);
      return res.status(500).json({ error: 'Failed to load watchers' });
    }
    return res.status(200).json({ watchers: data || [] });
  }

  // ---- POST: add -----------------------------------------------------------
  if (req.method === 'POST') {
    const watcherId = req.body?.watcherId;
    if (!watcherId || typeof watcherId !== 'string') {
      return res.status(400).json({ error: 'watcherId is required' });
    }
    if (watcherId === ownerId) {
      return res.status(400).json({ error: 'You cannot add yourself as your own watcher' });
    }

    // Confirm the watcher is a real user in the same org.
    const { data: watcherUser } = await supabaseAdmin
      .from('app_users')
      .select('id, display_name')
      .eq('id', watcherId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (!watcherUser) {
      return res.status(400).json({ error: 'That user was not found in your organization' });
    }

    const { data, error } = await supabaseAdmin
      .from('permanent_watchers')
      .upsert(
        { organization_id: organizationId, owner_id: ownerId, watcher_id: watcherId, created_by: ownerId },
        { onConflict: 'owner_id,watcher_id' }
      )
      .select('id')
      .single();

    if (error) {
      console.error('permanent-watchers add failed:', error);
      return res.status(500).json({ error: 'Failed to add watcher' });
    }

    await audit(req, user, {
      category: 'security',
      action: 'permanent_watcher.added',
      targetType: 'user',
      targetId: watcherId,
      targetLabel: watcherUser.display_name || null,
    });

    return res.status(201).json({ id: data.id });
  }

  // ---- DELETE: remove ------------------------------------------------------
  if (req.method === 'DELETE') {
    const id = (req.query.id as string) || null;
    const watcherId = (req.query.watcherId as string) || null;
    if (!id && !watcherId) {
      return res.status(400).json({ error: 'id or watcherId is required' });
    }

    let query = supabaseAdmin
      .from('permanent_watchers')
      .delete()
      .eq('organization_id', organizationId)
      .eq('owner_id', ownerId);
    query = id ? query.eq('id', id) : query.eq('watcher_id', watcherId as string);

    const { error } = await query;
    if (error) {
      console.error('permanent-watchers remove failed:', error);
      return res.status(500).json({ error: 'Failed to remove watcher' });
    }

    await audit(req, user, {
      category: 'security',
      action: 'permanent_watcher.removed',
      targetType: 'user',
      targetId: watcherId || id,
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
