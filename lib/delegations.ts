/**
 * Approval delegation lookup (approval_delegations table).
 *
 * A delegation routes ANY approval that would land on the delegator to the
 * delegate for a bounded window. The approval engine calls
 * getActiveDelegateFor() whenever it resolves/activates an approver so new
 * approvals auto-route during the window.
 *
 * Read only through the service role. Every reader is best-effort: a lookup
 * failure returns "no delegation" so a workflow action can never break.
 */

import { supabaseAdmin } from './supabaseAdmin';

export interface ActiveDelegation {
  id: string;
  delegator_id: string;
  delegate_id: string;
  reason: string;
  created_by: string | null;
  starts_at: string;
  ends_at: string;
}

/**
 * Return the delegate currently covering `delegatorId`, or null. A delegation
 * is in force when status='active' and now ∈ [starts_at, ends_at]. Only a
 * single hop is followed (if the delegate is themselves delegated we do not
 * chain) to keep routing predictable and loop-free.
 */
export async function getActiveDelegateFor(
  delegatorId: string | null | undefined,
  organizationId: string | null | undefined,
  at: Date = new Date()
): Promise<ActiveDelegation | null> {
  if (!delegatorId) return null;
  try {
    const nowIso = at.toISOString();
    let query = supabaseAdmin
      .from('approval_delegations')
      .select('id, delegator_id, delegate_id, reason, created_by, starts_at, ends_at')
      .eq('delegator_id', delegatorId)
      .eq('status', 'active')
      .lte('starts_at', nowIso)
      .gt('ends_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1);
    if (organizationId) query = query.eq('organization_id', organizationId);

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.warn('delegations: lookup failed, treating as none:', error.message);
      return null;
    }
    if (!data) return null;
    // Defensive: never route back to the same person.
    if (data.delegate_id === data.delegator_id) return null;
    return data as ActiveDelegation;
  } catch (e) {
    console.warn('delegations: lookup threw, treating as none:', e);
    return null;
  }
}
