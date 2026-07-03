/**
 * /api/bugs
 *
 * POST — any authenticated user files a bug report. System/super admins get
 *        an in-app notification so new issues are triaged quickly.
 * GET  — ?scope=all (admins only) lists every report in the organization;
 *        otherwise returns the caller's own reports.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getUserRBACProfile, hasPermission, PERMISSIONS, ROLE_SLUGS } from '@/lib/rbac';
import { audit } from '@/lib/auditLog';
import { validateBody, z } from '@/lib/validate';

const CreateBugSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(3).max(5000),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  pageUrl: z.string().max(1000).optional().or(z.literal('')),
}).strip();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const user = session.user as any;
  const userId = user.id as string;
  const orgId = user.org_id || null;

  if (req.method === 'POST') {
    const body = validateBody(req, res, CreateBugSchema);
    if (!body) return;

    const { data: bug, error } = await supabaseAdmin
      .from('bug_reports')
      .insert({
        organization_id: orgId,
        reporter_id: userId,
        title: body.title.trim(),
        description: body.description.trim(),
        severity: body.severity || 'medium',
        page_url: body.pageUrl || null,
        user_agent: (req.headers['user-agent'] as string || '').slice(0, 512) || null,
      })
      .select('id, title, severity, status, created_at')
      .single();

    if (error || !bug) {
      console.error('Failed to create bug report:', error);
      return res.status(500).json({ error: 'Failed to create bug report' });
    }

    await audit(req, session.user, {
      category: 'system',
      action: 'system.bug_reported',
      severity: 'notice',
      targetType: 'bug_report',
      targetId: bug.id,
      targetLabel: bug.title,
      details: { severity: bug.severity, pageUrl: body.pageUrl || null },
    });

    // Notify every system/super admin so the report gets triaged. Best-effort:
    // a notification failure must not fail the report itself.
    try {
      const { data: adminRoles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, role:roles!inner(slug)')
        .eq('is_active', true)
        .in('role.slug', [ROLE_SLUGS.SYSTEM_ADMIN, ROLE_SLUGS.SUPER_ADMIN]);

      const adminIds = Array.from(
        new Set((adminRoles || []).map((r: any) => r.user_id).filter((id: string) => id && id !== userId))
      );

      if (adminIds.length > 0) {
        await supabaseAdmin.from('notifications').insert(
          adminIds.map((adminId) => ({
            organization_id: orgId,
            recipient_id: adminId,
            sender_id: userId,
            type: 'task',
            title: `New bug report: ${bug.title}`,
            message: `${user.name || user.email || 'A user'} reported a ${bug.severity} severity issue.`,
            metadata: { bug_id: bug.id, action_url: '/bugs' },
            is_read: false,
          }))
        );
      }
    } catch (notifyErr) {
      console.error('Failed to notify admins of new bug report:', notifyErr);
    }

    return res.status(201).json({ bug });
  }

  if (req.method === 'GET') {
    const scope = req.query.scope === 'all' ? 'all' : 'own';

    if (scope === 'all') {
      const rbac = await getUserRBACProfile(userId);
      if (!hasPermission(rbac, PERMISSIONS.ADMIN_SYSTEM_CONFIG)) {
        return res.status(403).json({ error: 'You do not have permission to view all bug reports.' });
      }
    }

    let query = supabaseAdmin
      .from('bug_reports')
      .select(`
        id, title, description, severity, status, page_url, admin_notes,
        resolved_at, created_at, updated_at,
        reporter:app_users!bug_reports_reporter_id_fkey ( id, display_name, email ),
        resolver:app_users!bug_reports_resolved_by_fkey ( id, display_name )
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (scope === 'own') {
      query = query.eq('reporter_id', userId);
    } else if (orgId) {
      query = query.eq('organization_id', orgId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to list bug reports:', error);
      return res.status(500).json({ error: 'Failed to list bug reports' });
    }

    return res.status(200).json({ bugs: data || [] });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
