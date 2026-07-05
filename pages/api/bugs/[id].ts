/**
 * PATCH /api/bugs/[id]  — admin triage: update status / severity / notes.
 *
 * Restricted to system/super admins (admin.system_config). Whenever the
 * status changes, the reporter gets an in-app notification so they know
 * their issue was reviewed, is being worked on, or has been resolved.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getUserRBACProfile, hasPermission, PERMISSIONS } from '@/lib/rbac';
import { audit } from '@/lib/auditLog';
import { validateBody, z } from '@/lib/validate';

const UpdateBugSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  adminNotes: z.string().max(5000).optional(),
}).strip();

const STATUS_LABELS: Record<string, string> = {
  open: 'reopened',
  in_progress: 'being worked on',
  resolved: 'resolved',
  closed: 'reviewed and closed',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const user = session.user as any;
  const userId = user.id as string;

  const { id } = req.query;
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'Bug id is required' });
  }

  const rbac = await getUserRBACProfile(userId);
  if (!hasPermission(rbac, PERMISSIONS.ADMIN_SYSTEM_CONFIG)) {
    return res.status(403).json({ error: 'You do not have permission to manage bug reports.' });
  }

  const body = validateBody(req, res, UpdateBugSchema);
  if (!body) return;

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('bug_reports')
    .select('id, title, status, reporter_id, organization_id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return res.status(404).json({ error: 'Bug report not found' });
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body.severity) updates.severity = body.severity;
  if (typeof body.adminNotes === 'string') updates.admin_notes = body.adminNotes;

  const statusChanged = !!body.status && body.status !== existing.status;
  if (body.status) {
    updates.status = body.status;
    if (statusChanged && (body.status === 'resolved' || body.status === 'closed')) {
      updates.resolved_by = userId;
      updates.resolved_at = new Date().toISOString();
    }
    if (statusChanged && body.status === 'open') {
      updates.resolved_by = null;
      updates.resolved_at = null;
    }
  }

  const { data: bug, error: updateError } = await supabaseAdmin
    .from('bug_reports')
    .update(updates)
    .eq('id', id)
    .select('id, title, description, severity, status, admin_notes, resolved_at, updated_at')
    .single();

  if (updateError || !bug) {
    console.error('Failed to update bug report:', updateError);
    return res.status(500).json({ error: 'Failed to update bug report' });
  }

  await audit(req, session.user, {
    category: 'system',
    action: statusChanged && (bug.status === 'resolved' || bug.status === 'closed')
      ? 'system.bug_resolved'
      : 'system.bug_updated',
    severity: 'info',
    targetType: 'bug_report',
    targetId: bug.id,
    targetLabel: bug.title,
    details: { status: bug.status, severity: bug.severity, statusChanged },
  });

  // Tell the reporter their issue moved. Best-effort — never fails the update.
  if (statusChanged && existing.reporter_id && existing.reporter_id !== userId) {
    try {
      await supabaseAdmin.from('notifications').insert({
        organization_id: existing.organization_id,
        recipient_id: existing.reporter_id,
        sender_id: userId,
        // 'task' is an allowed notification type AND is counted by the unread
        // bell badge, so the reporter actually sees the update land.
        type: 'task',
        title: `Your bug report is ${STATUS_LABELS[bug.status] || bug.status}`,
        message: bug.admin_notes
          ? `"${bug.title}" — ${bug.admin_notes}`.slice(0, 500)
          : `"${bug.title}" has been updated by the system administrator.`,
        metadata: { bug_id: bug.id, action_url: '/bugs', status: bug.status },
        is_read: false,
      });
    } catch (notifyErr) {
      console.error('Failed to notify reporter of bug update:', notifyErr);
    }
  }

  return res.status(200).json({ bug });
}
