/**
 * Microsoft Graph directory search (application / client-credentials).
 *
 * Lets the app search the organisation's Azure AD (Entra ID) directory for
 * people — used when picking approvers / watchers in production so the pool is
 * the live RTG directory rather than only users who have already signed in.
 *
 * Reuses the app-only token from `graphAppMail` (same Azure AD app used for
 * sign-in and system mail). Requires the Graph **application** permission
 * `User.Read.All` granted with admin consent. `GRAPH_MAIL_SENDER` is NOT
 * required here — only the three Azure credentials.
 *
 * Degrades gracefully: returns `null` when not configured or on any Graph
 * error, so callers can fall back to the local `app_users` list.
 */

import { getAppToken } from './graphAppMail';

export function isGraphDirectoryConfigured(): boolean {
  return !!(
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_TENANT
  );
}

export interface DirectoryUser {
  /** Azure AD object id (oid) — stored as app_users.azure_oid. */
  azureOid: string;
  displayName: string;
  email: string;
  jobTitle: string | null;
}

/**
 * Search directory users by name or email. Returns up to `top` matches, or
 * `null` if Graph is unavailable (caller should fall back to app_users).
 */
export async function searchDirectoryUsers(query: string, top = 20): Promise<DirectoryUser[] | null> {
  const token = await getAppToken();
  if (!token) return null;

  // Strip quotes to keep the $search expression well-formed.
  const safe = query.replace(/"/g, '').trim();
  if (!safe) return [];

  const params = new URLSearchParams();
  params.set('$search', `"displayName:${safe}" OR "mail:${safe}" OR "userPrincipalName:${safe}"`);
  params.set('$select', 'id,displayName,mail,userPrincipalName,jobTitle,accountEnabled');
  params.set('$top', String(top));

  const resp = await fetch(`https://graph.microsoft.com/v1.0/users?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      // $search on the users collection requires advanced query capabilities.
      ConsistencyLevel: 'eventual',
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    console.error('graphDirectory: user search failed:', resp.status, text);
    return null;
  }

  const json: any = await resp.json();
  return (json.value || [])
    .filter((u: any) => u.accountEnabled !== false)
    .map((u: any) => ({
      azureOid: u.id,
      displayName: u.displayName || u.userPrincipalName || u.mail || 'Unknown',
      email: u.mail || u.userPrincipalName || '',
      jobTitle: u.jobTitle || null,
    }));
}
