/**
 * Shared guard + query builder for the audit APIs.
 *
 * Access is restricted to holders of the dedicated audit permissions
 * (Auditor role, Super Admin) or the legacy `admin.audit_logs` permission.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { requireAnyPermission, PERMISSIONS, type UserRBACProfile } from './rbac';
import { supabaseAdmin } from './supabaseAdmin';

export const AUDIT_VIEW_PERMISSIONS = ['audit.view_logs', PERMISSIONS.ADMIN_AUDIT_LOGS];

export interface AuditGuardResult {
  user: any;
  profile: UserRBACProfile;
}

/**
 * Authenticate + authorise an audit API call. Writes the error response and
 * returns null when the caller is not allowed.
 */
export async function guardAuditApi(
  req: NextApiRequest,
  res: NextApiResponse,
  extraPermissions: string[] = []
): Promise<AuditGuardResult | null> {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const { allowed, profile } = await requireAnyPermission(session.user.id, [
    ...AUDIT_VIEW_PERMISSIONS,
    ...extraPermissions,
  ]);
  if (!allowed) {
    res.status(403).json({ error: 'Audit access requires the Auditor role or audit permissions' });
    return null;
  }
  return { user: session.user, profile };
}

export interface AuditEventFilters {
  category?: string;
  severity?: string;
  outcome?: string;
  action?: string;
  actorId?: string;
  search?: string;
  requestId?: string;
  targetType?: string;
  from?: string;
  to?: string;
  sortBy?: 'occurred_at' | 'severity' | 'category' | 'action' | 'actor_name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export function parseAuditFilters(query: NextApiRequest['query']): AuditEventFilters {
  const str = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const sortable = ['occurred_at', 'severity', 'category', 'action', 'actor_name'];
  const sortBy = str(query.sortBy);
  return {
    category: str(query.category),
    severity: str(query.severity),
    outcome: str(query.outcome),
    action: str(query.action),
    actorId: str(query.actorId),
    search: str(query.search),
    requestId: str(query.requestId),
    targetType: str(query.targetType),
    from: str(query.from),
    to: str(query.to),
    sortBy: (sortable.includes(sortBy || '') ? sortBy : 'occurred_at') as AuditEventFilters['sortBy'],
    sortOrder: str(query.sortOrder) === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, parseInt(String(query.page || '1'), 10) || 1),
    pageSize: Math.min(500, Math.max(1, parseInt(String(query.pageSize || '50'), 10) || 50)),
  };
}

/** Build the filtered audit_events query (count: exact for pagination). */
export function buildAuditQuery(filters: AuditEventFilters, organizationId?: string | null) {
  let q = supabaseAdmin.from('audit_events').select('*', { count: 'exact' });

  if (organizationId) {
    // Org events plus global events (e.g. login attempts recorded before
    // the org was resolved).
    q = q.or(`organization_id.eq.${organizationId},organization_id.is.null`);
  }
  if (filters.category) q = q.eq('category', filters.category);
  if (filters.severity) q = q.eq('severity', filters.severity);
  if (filters.outcome) q = q.eq('outcome', filters.outcome);
  if (filters.action) q = q.ilike('action', `%${filters.action}%`);
  if (filters.actorId) q = q.eq('actor_id', filters.actorId);
  if (filters.requestId) q = q.eq('request_id', filters.requestId);
  if (filters.targetType) q = q.eq('target_type', filters.targetType);
  if (filters.from) q = q.gte('occurred_at', filters.from);
  if (filters.to) q = q.lte('occurred_at', filters.to);
  if (filters.search) {
    const s = filters.search.replace(/[%,()]/g, ' ').trim();
    if (s) {
      q = q.or(
        `action.ilike.%${s}%,actor_name.ilike.%${s}%,actor_email.ilike.%${s}%,target_label.ilike.%${s}%,target_id.ilike.%${s}%`
      );
    }
  }

  return q
    .order(filters.sortBy || 'occurred_at', { ascending: filters.sortOrder === 'asc' })
    .order('sequence_number', { ascending: filters.sortOrder === 'asc' });
}
