/**
 * Elevated session cookie.
 *
 * After a user passes a step-up ceremony (Microsoft MFA or WebAuthn biometric)
 * we mint an *unbound* step-up token (no requestId / stepId) and store it in
 * an httpOnly cookie. While the cookie is valid the user can submit additional
 * approvals at the same risk level (or lower) without re-running the ceremony.
 *
 * This is layered on top of `stepUpToken.ts` so that
 *  - the same signing key & verification path apply,
 *  - `verifyStepUpForApproval` already accepts unbound tokens within their TTL,
 *  - the elevation cookie is interchangeable with a freshly issued step-up
 *    token at the approval endpoint — neither path is privileged over the other.
 *
 * Default TTL is 15 minutes; admins can override via the `preferences.
 * elevation_session_minutes` system_settings value.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import type { AuthenticationMethod } from './approvalRisk';
import { signStepUpToken, verifyStepUpToken, type StepUpPayload } from './stepUpToken';
import { supabaseAdmin } from './supabaseAdmin';

export const ELEVATION_COOKIE = 'elevation_session';
export const DEFAULT_ELEVATION_MINUTES = 15;
const MIN_ELEVATION_MINUTES = 1;
const MAX_ELEVATION_MINUTES = 240; // 4 hours hard ceiling — even if an admin sets something silly.

/** Resolve the elevation TTL for a user, falling back to the default. */
export async function getElevationTtlMinutes(userId: string): Promise<number> {
  try {
    const { data: user } = await supabaseAdmin
      .from('app_users')
      .select('org_id')
      .eq('id', userId)
      .maybeSingle();
    const orgId = (user as any)?.org_id;
    if (!orgId) return DEFAULT_ELEVATION_MINUTES;

    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('organization_id', orgId)
      .eq('category', 'preferences')
      .eq('key', 'elevation_session_minutes')
      .maybeSingle();

    const raw = (data as any)?.value;
    const num = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(num)) return DEFAULT_ELEVATION_MINUTES;
    return Math.min(MAX_ELEVATION_MINUTES, Math.max(MIN_ELEVATION_MINUTES, num));
  } catch {
    return DEFAULT_ELEVATION_MINUTES;
  }
}

/** Issue an unbound step-up token and set it as an httpOnly cookie. */
export async function setElevationCookie(
  res: NextApiResponse,
  input: {
    userId: string;
    method: AuthenticationMethod;
    credentialId?: string | null;
    ttlMinutes?: number;
  }
): Promise<{ token: string; expiresAt: number; ttlMinutes: number }> {
  const ttlMinutes = input.ttlMinutes ?? (await getElevationTtlMinutes(input.userId));
  const ttlSeconds = ttlMinutes * 60;
  const token = signStepUpToken({
    userId: input.userId,
    method: input.method,
    credentialId: input.credentialId ?? null,
    requestId: null,
    stepId: null,
    ttlSeconds,
  });

  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${ELEVATION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${ttlSeconds}`,
  ];
  if (isProd) parts.push('Secure');

  // Preserve any existing Set-Cookie headers (NextAuth, etc.).
  const existing = res.getHeader('Set-Cookie');
  const cookieValue = parts.join('; ');
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieValue]);
  } else if (typeof existing === 'string' && existing.length > 0) {
    res.setHeader('Set-Cookie', [existing, cookieValue]);
  } else {
    res.setHeader('Set-Cookie', cookieValue);
  }

  return { token, expiresAt: Date.now() + ttlSeconds * 1000, ttlMinutes };
}

/** Clear the elevation cookie (on expiry detection or sign-out). */
export function clearElevationCookie(res: NextApiResponse) {
  const parts = [
    `${ELEVATION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  const existing = res.getHeader('Set-Cookie');
  const cookieValue = parts.join('; ');
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieValue]);
  } else if (typeof existing === 'string' && existing.length > 0) {
    res.setHeader('Set-Cookie', [existing, cookieValue]);
  } else {
    res.setHeader('Set-Cookie', cookieValue);
  }
}

/** Read the raw elevation token from the request cookies. */
export function readElevationToken(req: NextApiRequest): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const cookies = raw.split(';').map(c => c.trim());
  for (const c of cookies) {
    if (c.startsWith(`${ELEVATION_COOKIE}=`)) {
      return decodeURIComponent(c.slice(ELEVATION_COOKIE.length + 1));
    }
  }
  return null;
}

/** Verify the elevation cookie and return its payload, or null. */
export function verifyElevationCookie(req: NextApiRequest, expectedUserId?: string): StepUpPayload | null {
  const token = readElevationToken(req);
  const payload = verifyStepUpToken(token);
  if (!payload) return null;
  if (expectedUserId && payload.userId !== expectedUserId) return null;
  // An elevation cookie must be unbound — defense-in-depth.
  if (payload.requestId || payload.stepId) return null;
  return payload;
}
