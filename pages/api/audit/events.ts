import { NextApiRequest, NextApiResponse } from 'next';
import { guardAuditApi, parseAuditFilters, buildAuditQuery } from '@/lib/auditAccess';

/**
 * GET /api/audit/events — paginated, filterable, sortable view of the
 * immutable audit log. Auditor / Super Admin only.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const guard = await guardAuditApi(req, res);
  if (!guard) return;

  try {
    const filters = parseAuditFilters(req.query);
    const fromIdx = (filters.page! - 1) * filters.pageSize!;
    const toIdx = fromIdx + filters.pageSize! - 1;

    const { data, error, count } = await buildAuditQuery(filters, guard.user.org_id).range(fromIdx, toIdx);

    if (error) throw error;

    return res.status(200).json({
      events: data || [],
      total: count || 0,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil((count || 0) / filters.pageSize!)),
    });
  } catch (error: any) {
    console.error('Audit events API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch audit events' });
  }
}
