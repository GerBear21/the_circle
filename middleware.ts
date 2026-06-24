/**
 * Edge middleware — runs on every `/api/*` request.
 *
 * Two security responsibilities:
 *
 *  1. Rate limiting (Supabase-backed, see lib/rateLimit.ts + the
 *     create_rate_limit_counters migration):
 *       - a coarse per-IP flood cap on the whole API surface,
 *       - a strict brute-force cap on the credentials login callback.
 *     Counters live in Postgres so the limit holds across all serverless
 *     instances. The check fails OPEN (Supabase down ⇒ request allowed) so the
 *     limiter can never take the API offline.
 *
 *  2. Absolute session timeout: even a continuously active user is forced to
 *     re-authenticate ABSOLUTE_TIMEOUT after login. The idle timeout is handled
 *     by the JWT `maxAge`; here we reject any request whose token was minted
 *     more than ABSOLUTE_TIMEOUT ago and clear the cookie.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { ABSOLUTE_TIMEOUT_MS } from './lib/sessionTimeout';

const SESSION_COOKIE = 'next-auth.session-token';

interface LimitConfig {
  name: string;
  max: number;
  windowSeconds: number;
}

/** Pick the rate-limit policy for a path, or null to skip. */
function limitFor(pathname: string): LimitConfig | null {
  // Brute-force protection for demo credential logins.
  if (pathname === '/api/auth/callback/credentials') {
    return { name: 'login', max: 10, windowSeconds: 300 }; // 10 attempts / 5 min / IP
  }
  // Leave the rest of next-auth (session polling, csrf, providers, oauth
  // callbacks) un-throttled so legitimate session refreshes are never blocked.
  if (pathname.startsWith('/api/auth')) return null;
  // Coarse global flood cap for the application API. Keyed per-user when
  // authenticated (see middleware below) so many people behind one office /
  // NAT IP don't share — and exhaust — a single bucket.
  return { name: 'global', max: 600, windowSeconds: 60 }; // 600 req / min / identity
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '0.0.0.0';
}

/** Call the Postgres fixed-window limiter over PostgREST. Fails open. */
async function edgeRateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number; retryAfter: number }> {
  const open = { allowed: true, remaining: max, resetAt: Date.now() + windowSeconds * 1000, retryAfter: 0 };
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return open;

  try {
    const resp = await fetch(`${url}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ p_key: key, p_max_requests: max, p_window_seconds: windowSeconds }),
    });
    if (!resp.ok) return open;
    const data = await resp.json();
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return open;
    return {
      allowed: row.allowed === true,
      remaining: typeof row.remaining === 'number' ? row.remaining : 0,
      resetAt: row.reset_at ? new Date(row.reset_at).getTime() : open.resetAt,
      retryAfter: typeof row.retry_after === 'number' ? row.retry_after : 0,
    };
  } catch {
    return open; // fail open
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAuthRoute = pathname.startsWith('/api/auth');

  // Resolve the session token once for non-next-auth routes. Used both to key
  // the rate limit per-user and to enforce the absolute timeout below.
  const token = isAuthRoute
    ? null
    : await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName: SESSION_COOKIE,
      });

  // --- 1. Rate limiting -------------------------------------------------
  const policy = limitFor(pathname);
  if (policy) {
    // Authenticated app traffic is keyed on the user id so concurrent users
    // sharing one public IP (corporate NAT) get independent buckets. Pre-auth
    // and login traffic falls back to the IP. The `u:`/`ip:` prefixes keep the
    // two namespaces from colliding.
    const userId = token && (token as any).user_id ? String((token as any).user_id) : null;
    const identity = userId ? `u:${userId}` : `ip:${clientIp(req)}`;
    const key = `${policy.name}:${identity}`;
    const rl = await edgeRateLimit(key, policy.max, policy.windowSeconds);
    if (!rl.allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please slow down and try again shortly.', retryAfter: rl.retryAfter }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rl.retryAfter),
            'RateLimit-Limit': String(policy.max),
            'RateLimit-Remaining': '0',
            'RateLimit-Reset': String(Math.max(0, Math.ceil((rl.resetAt - Date.now()) / 1000))),
          },
        }
      );
    }
  }

  // --- 2. Absolute session timeout (skip next-auth's own endpoints) -----
  if (!isAuthRoute) {
    const loginAt = token && typeof (token as any).loginAt === 'number' ? (token as any).loginAt : null;
    if (loginAt !== null && Date.now() - loginAt > ABSOLUTE_TIMEOUT_MS) {
      const res = new NextResponse(
        JSON.stringify({ error: 'Session expired. Please sign in again.', code: 'session_expired' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
      // Clear the session cookie so the client falls back to the login screen.
      res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
