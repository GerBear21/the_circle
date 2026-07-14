import { supabaseAdmin } from './supabaseAdmin';
import { fetchExecutivePositions } from './hrimsClient';

/**
 * Server-only executive/CHCO resolution.
 *
 * Kept separate from lib/hrimsClient (which is also imported client-side) so the
 * service-role `supabaseAdmin` never enters a client bundle.
 */

export interface ExecutiveUser {
  userId: string;
  displayName: string;
  email: string;
  positionTitle: string;
}

/** Map an HRIMS employee email onto an app_users row within the given org. */
export async function findAppUserByEmail(
  organizationId: string,
  email: string
): Promise<{ id: string; display_name: string; email: string } | null> {
  if (!email) return null;
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('id, display_name, email')
    .eq('organization_id', organizationId)
    .ilike('email', email)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * Resolve the organisation's executives — the CEO plus every employee whose
 * position reports directly to the CEO position — mapped to app_users.
 *
 * Returns [] (never throws) when HRIMS isn't configured or the CEO/structure
 * can't be resolved, so callers can treat "no executives" as a normal empty state.
 */
export async function resolveExecutives(organizationId: string): Promise<ExecutiveUser[]> {
  try {
    const positions = await fetchExecutivePositions();
    const executives: ExecutiveUser[] = [];
    const seen = new Set<string>();

    for (const pos of positions) {
      const email = pos.employee?.email;
      if (!email) continue;
      const appUser = await findAppUserByEmail(organizationId, email);
      if (!appUser || seen.has(appUser.id)) continue;
      seen.add(appUser.id);
      executives.push({
        userId: appUser.id,
        displayName: appUser.display_name,
        email: appUser.email,
        positionTitle: pos.position_title,
      });
    }

    return executives;
  } catch (err) {
    console.error('resolveExecutives failed:', err);
    return [];
  }
}
