/**
 * Immutable audit logging — the single write path into `audit_events`.
 *
 * Every entry is sealed into a SHA-256 hash chain by a database trigger
 * (see database/migrations/create_audit_events_table.sql), so rows are
 * tamper-evident and append-only (ISO/IEC 27001:2022 A.8.15 / A.8.16).
 *
 * Logging is strictly best-effort: a failure to record an event must never
 * break the business action being audited, so this module never throws.
 */

import type { NextApiRequest } from 'next';
import { supabaseAdmin } from './supabaseAdmin';

export type AuditCategory =
  | 'security'      // auth, sessions, permissions, step-up, biometrics
  | 'system'        // configuration, settings, integrations
  | 'activity'      // general user actions (views, exports, downloads)
  | 'transaction'   // request/financial lifecycle (create, submit, approve…)
  | 'workflow'      // workflow definition & execution
  | 'data'          // bulk data changes, migrations, backfills
  | 'compliance';   // audit-log access, report exports, integrity checks

export type AuditSeverity = 'info' | 'notice' | 'warning' | 'critical';
export type AuditOutcome = 'success' | 'failure' | 'denied';

export interface AuditActor {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  roles?: string | null;
}

export interface AuditEventInput {
  organizationId?: string | null;
  category: AuditCategory;
  /** Dot-namespaced action, e.g. 'auth.login', 'request.approved'. */
  action: string;
  severity?: AuditSeverity;
  outcome?: AuditOutcome;
  actor?: AuditActor;
  ipAddress?: string | null;
  userAgent?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  requestId?: string | null;
  details?: Record<string, any>;
}

/** Extract the originating client IP, honouring reverse-proxy headers. */
export function getRequestIp(req?: NextApiRequest): string | null {
  if (!req) return null;
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0].split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

/** Build actor + origin fields from an API request and next-auth session. */
export function auditContext(req?: NextApiRequest, sessionUser?: any): Partial<AuditEventInput> {
  return {
    organizationId: sessionUser?.org_id || null,
    actor: sessionUser
      ? {
          id: sessionUser.id || null,
          email: sessionUser.email || null,
          name: sessionUser.name || null,
          roles: sessionUser.role || null,
        }
      : undefined,
    ipAddress: getRequestIp(req),
    userAgent: req ? (req.headers['user-agent'] as string) || null : null,
  };
}

/**
 * Append an event to the immutable audit log. Never throws — failures are
 * logged to the server console only.
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('audit_events').insert({
      organization_id: input.organizationId || null,
      category: input.category,
      action: input.action,
      severity: input.severity || 'info',
      outcome: input.outcome || 'success',
      actor_id: input.actor?.id || null,
      actor_email: input.actor?.email || null,
      actor_name: input.actor?.name || null,
      actor_roles: input.actor?.roles || null,
      ip_address: input.ipAddress || null,
      user_agent: input.userAgent ? String(input.userAgent).slice(0, 512) : null,
      target_type: input.targetType || null,
      target_id: input.targetId != null ? String(input.targetId) : null,
      target_label: input.targetLabel || null,
      request_id: input.requestId || null,
      details: input.details || {},
    });
    if (error) {
      console.error('auditLog: failed to record event', input.action, error.message);
    }
  } catch (e) {
    console.error('auditLog: unexpected error recording event', input.action, e);
  }
}

/**
 * Record an unexpected server-side failure as a critical system audit event.
 * Safe to call from a catch block where the session/org may be out of scope —
 * it only needs the request (for IP / user-agent) and never throws.
 */
export async function auditApiError(
  req: NextApiRequest | undefined,
  action: string,
  error: any,
  extra?: Partial<AuditEventInput>
): Promise<void> {
  await recordAuditEvent({
    category: 'system',
    action,
    severity: 'critical',
    outcome: 'failure',
    ipAddress: getRequestIp(req),
    userAgent: req ? (req.headers['user-agent'] as string) || null : null,
    ...extra,
    details: { ...(extra?.details || {}), error: error?.message || String(error) },
  });
}

/**
 * Convenience wrapper: record an event with request/session context merged in.
 * Usage: await audit(req, user, { category: 'transaction', action: 'request.approved', ... })
 */
export async function audit(
  req: NextApiRequest | undefined,
  sessionUser: any,
  event: Omit<AuditEventInput, 'actor' | 'ipAddress' | 'userAgent' | 'organizationId'> &
    Partial<Pick<AuditEventInput, 'organizationId' | 'actor'>>
): Promise<void> {
  const ctx = auditContext(req, sessionUser);
  await recordAuditEvent({
    ...ctx,
    ...event,
    organizationId: event.organizationId ?? ctx.organizationId,
    actor: event.actor ?? ctx.actor,
  });
}
