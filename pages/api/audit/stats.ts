import { NextApiRequest, NextApiResponse } from 'next';
import { guardAuditApi } from '@/lib/auditAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/audit/stats — aggregate statistics for the auditor dashboard:
 * totals by category / severity / outcome, a 30-day daily series, top
 * actors, and the most recent critical events.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const guard = await guardAuditApi(req, res);
  if (!guard) return;

  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString();
    const orgId = guard.user.org_id as string | undefined;

    // Pull the last 30 days of events (bounded) and aggregate in memory —
    // simple, and fine at this volume. Counts use head-only queries.
    let recentQ = supabaseAdmin
      .from('audit_events')
      .select('occurred_at, category, severity, outcome, actor_id, actor_name, action')
      .gte('occurred_at', sinceIso)
      .order('occurred_at', { ascending: false })
      .limit(10000);
    if (orgId) recentQ = recentQ.or(`organization_id.eq.${orgId},organization_id.is.null`);

    let totalQ = supabaseAdmin.from('audit_events').select('id', { count: 'exact', head: true });
    if (orgId) totalQ = totalQ.or(`organization_id.eq.${orgId},organization_id.is.null`);

    let criticalQ = supabaseAdmin
      .from('audit_events')
      .select('*')
      .in('severity', ['warning', 'critical'])
      .order('occurred_at', { ascending: false })
      .limit(8);
    if (orgId) criticalQ = criticalQ.or(`organization_id.eq.${orgId},organization_id.is.null`);

    const [{ data: recent, error: recentError }, { count: totalAllTime }, { data: criticalRecent }] =
      await Promise.all([recentQ, totalQ, criticalQ]);

    if (recentError) throw recentError;

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};
    const byDay: Record<string, Record<string, number>> = {};
    const actorCounts = new Map<string, { name: string; count: number }>();

    for (const e of recent || []) {
      byCategory[e.category] = (byCategory[e.category] || 0) + 1;
      bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
      byOutcome[e.outcome] = (byOutcome[e.outcome] || 0) + 1;

      const day = String(e.occurred_at).slice(0, 10);
      if (!byDay[day]) byDay[day] = {};
      byDay[day][e.category] = (byDay[day][e.category] || 0) + 1;

      const actorKey = e.actor_id || e.actor_name || 'system';
      const existing = actorCounts.get(actorKey);
      if (existing) existing.count += 1;
      else actorCounts.set(actorKey, { name: e.actor_name || 'System', count: 1 });
    }

    // Dense 30-day series (zero-filled) so charts don't skip days.
    const series: { date: string; [k: string]: any }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, ...(byDay[key] || {}) });
    }

    const topActors = Array.from(actorCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return res.status(200).json({
      totalAllTime: totalAllTime || 0,
      totalLast30Days: (recent || []).length,
      byCategory,
      bySeverity,
      byOutcome,
      dailySeries: series,
      topActors,
      recentAlerts: criticalRecent || [],
    });
  } catch (error: any) {
    console.error('Audit stats API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to compute audit statistics' });
  }
}
