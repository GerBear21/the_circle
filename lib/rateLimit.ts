/**
 * Server-side rate limiting (Node runtime / API routes).
 *
 * Counters live in Postgres (see database/migrations/create_rate_limit_counters.sql)
 * so limits hold across every serverless instance. This module is the
 * counterpart to the edge middleware: middleware applies a coarse per-IP flood
 * cap to all of `/api/*`, while `withRateLimit` lets individual routes impose a
 * stricter, often per-user, limit (e.g. login, invite sending, account creation).
 *
 * Failure policy: the limiter fails OPEN. If Postgres is unreachable we allow
 * the request rather than take the whole API down — a rate limiter must never
 * be a single point of failure for availability.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from './supabaseAdmin';
import { getRequestIp } from './auditLog';

export interface RateLimitOptions {
  /** Logical bucket name, namespaced into the key (e.g. 'login', 'esign-invite'). */
  name: string;
  /** Max requests permitted per window. */
  max: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /**
   * Derive the identity portion of the key. Defaults to the client IP.
   * Return null to skip limiting for this request (e.g. trusted callers).
   */
  identify?: (req: NextApiRequest) => string | null;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms at which the window resets. */
  resetAt: number;
  /** Seconds the client should wait before retrying (0 when allowed). */
  retryAfter: number;
}

/** Run the Postgres fixed-window check. Fails open on any error. */
export async function checkRateLimit(opts: RateLimitOptions, identity: string): Promise<RateLimitResult> {
  const fallbackOpen: RateLimitResult = {
    allowed: true,
    limit: opts.max,
    remaining: opts.max,
    resetAt: Date.now() + opts.windowSeconds * 1000,
    retryAfter: 0,
  };

  if (!supabaseAdmin) return fallbackOpen;

  try {
    const key = `${opts.name}:${identity}`;
    const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: key,
      p_max_requests: opts.max,
      p_window_seconds: opts.windowSeconds,
    });

    if (error) {
      console.error('rateLimit: RPC error, failing open:', error.message);
      return fallbackOpen;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return fallbackOpen;

    return {
      allowed: row.allowed === true,
      limit: opts.max,
      remaining: typeof row.remaining === 'number' ? row.remaining : 0,
      resetAt: row.reset_at ? new Date(row.reset_at).getTime() : fallbackOpen.resetAt,
      retryAfter: typeof row.retry_after === 'number' ? row.retry_after : 0,
    };
  } catch (e) {
    console.error('rateLimit: unexpected error, failing open:', e);
    return fallbackOpen;
  }
}

/** Attach the standard RateLimit-* response headers. */
function setRateLimitHeaders(res: NextApiResponse, result: RateLimitResult) {
  res.setHeader('RateLimit-Limit', String(result.limit));
  res.setHeader('RateLimit-Remaining', String(Math.max(0, result.remaining)));
  res.setHeader('RateLimit-Reset', String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))));
}

/**
 * Enforce a rate limit inside a handler. Returns true if the request may
 * proceed; if false it has already sent a 429 response — the caller should
 * simply return.
 */
export async function enforceRateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  opts: RateLimitOptions
): Promise<boolean> {
  const identity = (opts.identify ? opts.identify(req) : getRequestIp(req)) || null;
  if (!identity) return true; // nothing to key on / explicitly skipped

  const result = await checkRateLimit(opts, identity);
  setRateLimitHeaders(res, result);

  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfter));
    res.status(429).json({
      error: 'Too many requests. Please slow down and try again shortly.',
      retryAfter: result.retryAfter,
    });
    return false;
  }
  return true;
}

/**
 * Wrap an API handler so the limit is checked before it runs.
 *
 *   export default withRateLimit({ name: 'login', max: 10, windowSeconds: 300 }, handler);
 */
export function withRateLimit(
  opts: RateLimitOptions,
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown | Promise<unknown>
) {
  return async function rateLimited(req: NextApiRequest, res: NextApiResponse) {
    const ok = await enforceRateLimit(req, res, opts);
    if (!ok) return;
    return handler(req, res);
  };
}
