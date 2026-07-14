import { supabaseAdmin } from './supabaseAdmin';

/**
 * Permanent watchers.
 *
 * A user (the "owner") can nominate other users as their permanent watchers.
 * A permanent watcher gets READ-ONLY visibility of every request the owner
 * creates (posts) or is an approver on (receives) — but can never approve,
 * edit, or upload. This module resolves the relationship for the visibility
 * gates; the write paths never consult it.
 */

/** The owner ids that have named `watcherId` as a permanent watcher. */
export async function getWatchedOwnerIds(
  watcherId: string,
  organizationId: string
): Promise<string[]> {
  if (!watcherId || !organizationId) return [];
  const { data, error } = await supabaseAdmin
    .from('permanent_watchers')
    .select('owner_id')
    .eq('organization_id', organizationId)
    .eq('watcher_id', watcherId);
  if (error) {
    console.error('getWatchedOwnerIds failed:', error);
    return [];
  }
  return (data || []).map((r: any) => r.owner_id);
}

/**
 * Whether `watcherId` may view `request` by virtue of being a permanent watcher
 * of the creator or of any approver on it. `request` needs `creator_id` and
 * `request_steps` (with `approver_user_id`).
 */
export async function isPermanentWatcherOf(
  watcherId: string,
  organizationId: string,
  request: { creator_id?: string | null; request_steps?: Array<{ approver_user_id?: string | null }> | null }
): Promise<boolean> {
  const ownerIds = await getWatchedOwnerIds(watcherId, organizationId);
  if (ownerIds.length === 0) return false;
  const owners = new Set(ownerIds);
  if (request.creator_id && owners.has(request.creator_id)) return true;
  return (request.request_steps || []).some((s) => s.approver_user_id && owners.has(s.approver_user_id));
}
