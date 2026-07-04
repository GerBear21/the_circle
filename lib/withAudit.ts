/**
 * withAudit — automatic audit logging for API route handlers.
 *
 * Wrapping a handler with `withAudit` records an immutable audit event for
 * every mutating call (POST/PUT/PATCH/DELETE by default) WITHOUT the handler
 * having to call `audit()` itself. The wrapper captures, automatically:
 *   - WHO  — the authenticated actor (resolved once, before the response),
 *   - WHAT — the configured category + action,
 *   - WHERE— client IP + user-agent,
 *   - OUTCOME — derived from the HTTP status the handler returned
 *              (2xx → success, 401/403 → denied, else → failure),
 *   - WHEN — the server clock (DB default).
 *
 * This is the recommended way to add audit coverage to NEW endpoints: write the
 * handler, then `export default withAudit(handler, { category, action, ... })`.
 * Because logging is attached at the route boundary it can't be forgotten in
 * the handler body, and it stays consistent across features.
 *
 * Logging is strictly best-effort — a failure here never affects the response.
 *
 * @example
 *   async function handler(req, res) { ... res.status(200).json({ ok: true }) }
 *   export default withAudit(handler, {
 *     category: 'workflow',
 *     action: 'request.cancelled',
 *     severity: 'notice',
 *     targetType: 'request',                 // targetId defaults to req.query.id
 *     details: ({ req }) => ({ reason: req.body?.reason }),
 *   });
 */

import type { NextApiRequest, NextApiResponse, NextApiHandler } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { audit, type AuditCategory, type AuditSeverity, type AuditOutcome } from './auditLog';

export interface AuditedResponseContext {
  req: NextApiRequest;
  /** The HTTP status code the handler set (falls back to res.statusCode). */
  statusCode: number;
  /** The JSON body the handler sent, if any. */
  responseBody: any;
  /** Convenience: true when statusCode < 300. */
  ok: boolean;
}

export interface WithAuditConfig {
  category: AuditCategory;
  /** Dot-namespaced action, e.g. 'request.cancelled'. */
  action: string;
  severity?: AuditSeverity;
  /** Entity type, e.g. 'request' | 'user' | 'setting'. */
  targetType?: string;
  /** Which HTTP methods to audit. Defaults to all mutating methods. */
  methods?: string[];
  /** Resolve the target id. Defaults to `req.query.id`. */
  targetId?: (req: NextApiRequest) => string | undefined;
  /**
   * Whether `targetId` identifies a request (links the `request_id` column).
   * Defaults to true when `targetType === 'request'`.
   */
  isRequestTarget?: boolean;
  /** Human label for the target (e.g. a reference code). */
  targetLabel?: (ctx: AuditedResponseContext) => string | null | undefined;
  /** Structured details payload. Receives the captured response context. */
  details?: (ctx: AuditedResponseContext) => Record<string, any>;
  /**
   * Optionally skip recording for a given call (e.g. a validation no-op).
   * Return true to skip.
   */
  skip?: (ctx: AuditedResponseContext) => boolean;
  /**
   * Record events for unauthenticated calls too (no resolved actor). Off by
   * default so anonymous probes don't create null-actor / null-org noise;
   * authenticated-but-forbidden (403) calls are always recorded.
   */
  auditAnonymous?: boolean;
}

const DEFAULT_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

function outcomeForStatus(code: number): AuditOutcome {
  if (code < 300) return 'success';
  if (code === 401 || code === 403) return 'denied';
  return 'failure';
}

export function withAudit(handler: NextApiHandler, config: WithAuditConfig): NextApiHandler {
  const methods = (config.methods || DEFAULT_METHODS).map((m) => m.toUpperCase());

  return async (req: NextApiRequest, res: NextApiResponse) => {
    const shouldAudit = methods.includes((req.method || 'GET').toUpperCase());

    if (!shouldAudit) {
      return handler(req, res);
    }

    // Resolve the actor up-front — before the handler sends its response — so
    // the event can be attributed even though we record it afterwards.
    let sessionUser: any = null;
    try {
      const session = await getServerSession(req, res, authOptions);
      sessionUser = session?.user || null;
    } catch {
      /* unauthenticated or session error — recorded with no actor */
    }

    // Capture the handler's outcome by intercepting the status/body setters.
    let statusCode = 0;
    let responseBody: any = undefined;
    const origStatus = res.status.bind(res);
    const origJson = res.json.bind(res);
    (res as any).status = (code: number) => {
      statusCode = code;
      return origStatus(code);
    };
    (res as any).json = (body: any) => {
      responseBody = body;
      return origJson(body);
    };

    try {
      await handler(req, res);
    } catch (err) {
      // Handler threw without sending its own response: treat as a 500.
      if (!statusCode) statusCode = res.statusCode >= 400 ? res.statusCode : 500;
      throw err;
    } finally {
      const code = statusCode || res.statusCode || 200;
      const ctx: AuditedResponseContext = {
        req,
        statusCode: code,
        responseBody,
        ok: code < 300,
      };

      // Anonymous (unauthenticated) calls are skipped by default — nothing to
      // attribute, and they would otherwise create null-org noise.
      const skipAnonymous = !sessionUser && !config.auditAnonymous;

      if (!skipAnonymous && (!config.skip || !config.skip(ctx))) {
        const targetId = config.targetId
          ? config.targetId(req)
          : typeof req.query.id === 'string'
            ? req.query.id
            : undefined;
        const isReqTarget = config.isRequestTarget ?? config.targetType === 'request';

        try {
          await audit(req, sessionUser, {
            category: config.category,
            action: config.action,
            severity: config.severity,
            outcome: outcomeForStatus(code),
            targetType: config.targetType,
            targetId,
            requestId: isReqTarget ? targetId : undefined,
            targetLabel: config.targetLabel ? config.targetLabel(ctx) || undefined : undefined,
            details: config.details ? config.details(ctx) : {},
          });
        } catch (e) {
          console.error('[withAudit] failed to record event', config.action, e);
        }
      }
    }
  };
}
