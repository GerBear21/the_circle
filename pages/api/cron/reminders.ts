import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getPreferencesForUsers } from '@/lib/userPreferences';
import { sendUserNotificationEmail, escapeHtml } from '@/lib/notificationEmail';

/**
 * GET/POST /api/cron/reminders — daily approval-reminder emails.
 *
 * Finds every approval step currently sitting in 'pending' on an active
 * request, groups them by approver, and emails each approver one summary of
 * what is waiting on them. Gated per-user by the "approval reminders"
 * preference.
 *
 * Invoked by the Vercel cron (vercel.json). Vercel automatically sends
 * `Authorization: Bearer ${CRON_SECRET}` when the CRON_SECRET env var is set.
 */
export function isAuthorizedCron(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Without a shared secret only allow local development invocations.
    return process.env.NODE_ENV !== 'production';
  }
  return req.headers.authorization === `Bearer ${secret}`;
}

interface PendingTask {
  requestId: string;
  title: string;
  referenceCode: string | null;
  dueAt: string | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // All pending approval steps on requests that are still under review.
    const { data: steps, error } = await supabaseAdmin
      .from('request_steps')
      .select(`
        id, approver_user_id, due_at,
        request:requests!inner ( id, title, status, metadata )
      `)
      .eq('status', 'pending')
      .eq('request.status', 'pending')
      .not('approver_user_id', 'is', null);

    if (error) throw error;

    const byApprover = new Map<string, PendingTask[]>();
    for (const step of steps || []) {
      const request: any = (step as any).request;
      if (!request) continue;
      const list = byApprover.get(step.approver_user_id) || [];
      list.push({
        requestId: request.id,
        title: request.title || 'Untitled request',
        referenceCode: request.metadata?.referenceCode || null,
        dueAt: step.due_at || null,
      });
      byApprover.set(step.approver_user_id, list);
    }

    const approverIds = Array.from(byApprover.keys());
    const prefsMap = await getPreferencesForUsers(approverIds);

    let sent = 0;
    let skipped = 0;
    for (const [approverId, tasks] of Array.from(byApprover.entries())) {
      if (!prefsMap.get(approverId)?.approvalReminders) {
        skipped++;
        continue;
      }
      const now = Date.now();
      const rows = tasks
        .map((t) => {
          const overdue = t.dueAt && new Date(t.dueAt).getTime() < now;
          return `<li style="margin-bottom:6px">
            <strong>${escapeHtml(t.title)}</strong>${t.referenceCode ? ` (${escapeHtml(t.referenceCode)})` : ''}
            ${overdue ? ' — <span style="color:#b91c1c;font-weight:600">overdue</span>' : ''}
          </li>`;
        })
        .join('');
      const result = await sendUserNotificationEmail({
        userId: approverId,
        kind: 'reminder',
        subject: `Reminder: ${tasks.length} request${tasks.length === 1 ? '' : 's'} awaiting your approval`,
        heading: `${tasks.length} request${tasks.length === 1 ? ' is' : 's are'} waiting on you`,
        bodyHtml: `<p>The following request${tasks.length === 1 ? ' is' : 's are'} pending your review in The Circle:</p><ul>${rows}</ul>`,
        actionUrl: '/approvals',
        actionLabel: 'Open my approval tasks',
      });
      if (result.sent) sent++;
      else skipped++;
    }

    return res.status(200).json({ success: true, approversWithPending: approverIds.length, emailsSent: sent, skipped });
  } catch (e: any) {
    console.error('cron/reminders failed:', e);
    return res.status(500).json({ error: e.message || 'Reminder run failed' });
  }
}
