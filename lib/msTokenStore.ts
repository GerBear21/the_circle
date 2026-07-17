import { supabaseAdmin } from './supabaseAdmin';

/**
 * Server-side store for Microsoft Graph delegated OAuth tokens.
 *
 * These tokens used to live in the next-auth JWT (and therefore the session
 * cookie), bloating it past 4 KB and forcing cookie chunking. They now live in
 * the `ms_oauth_tokens` table, keyed by app_users.id, and are read only here on
 * the server. The next-auth session cookie no longer carries them.
 */

// The delegated Graph scope requested at sign-in and on refresh. `User.Read.All`
// (directory search for approvers/watchers) is admin-consent-required, so it is
// only requested once directory search is switched on via USER_DIRECTORY_SOURCE.
// Requesting it before an admin has consented would fail every sign-in with
// "needs admin approval", so keep this gated on the same flag that enables the
// feature — flip the flag only AFTER admin consent is granted.
const DIRECTORY_SCOPE =
  process.env.USER_DIRECTORY_SOURCE === 'azure' ? ' User.Read.All' : '';
export const MS_SCOPE = `openid profile email offline_access User.Read Mail.Send${DIRECTORY_SCOPE}`;

interface MsTokenInput {
  accessToken?: string | null;
  refreshToken?: string | null;
  /** Expiry as epoch milliseconds. */
  expiresAt?: number | null;
}

/** Upsert the current tokens for a user. Best-effort — never throws. */
export async function saveMsTokens(userId: string, tokens: MsTokenInput): Promise<void> {
  if (!userId || !supabaseAdmin) return;
  try {
    const payload: Record<string, any> = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    if (tokens.accessToken !== undefined) payload.access_token = tokens.accessToken;
    if (tokens.expiresAt !== undefined) payload.expires_at = tokens.expiresAt;
    // Only overwrite the refresh token when we actually got one, so a refresh
    // response that omits it never wipes the stored value.
    if (tokens.refreshToken) payload.refresh_token = tokens.refreshToken;

    await supabaseAdmin.from('ms_oauth_tokens').upsert(payload, { onConflict: 'user_id' });
  } catch (err) {
    console.error('saveMsTokens failed:', err);
  }
}

/**
 * Return a currently-valid Graph access token for the user, refreshing it via
 * the stored refresh token when it has expired (or is about to). Returns null
 * when there is no usable token (user must sign in again to grant Mail.Send).
 */
export async function getValidMsAccessToken(userId: string): Promise<string | null> {
  if (!userId || !supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from('ms_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('getValidMsAccessToken read failed:', error.message);
    return null;
  }
  if (!data) return null;

  const accessToken = (data.access_token as string | null) || null;
  const refreshToken = (data.refresh_token as string | null) || null;
  const expiresAt =
    data.expires_at == null ? null : Number(data.expires_at);

  const stillValid = accessToken && expiresAt && Date.now() < expiresAt - 60 * 1000;
  if (stillValid) return accessToken;
  if (!refreshToken) return accessToken; // nothing to refresh with — return as-is

  try {
    const tenant = process.env.AZURE_TENANT || 'common';
    const params = new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID || '',
      client_secret: process.env.AZURE_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: MS_SCOPE,
    });
    const resp = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      }
    );
    if (!resp.ok) {
      console.error('MS token refresh failed:', await resp.text());
      return accessToken; // fall back to the (possibly stale) token
    }
    const refreshed = await resp.json();
    const newAccess = refreshed.access_token as string;
    const newExpires = Date.now() + (refreshed.expires_in as number) * 1000;
    const newRefresh = (refreshed.refresh_token as string) || refreshToken;
    await saveMsTokens(userId, {
      accessToken: newAccess,
      refreshToken: newRefresh,
      expiresAt: newExpires,
    });
    return newAccess;
  } catch (err) {
    console.error('MS token refresh error:', err);
    return accessToken;
  }
}
