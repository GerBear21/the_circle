import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendUserNotificationEmail, escapeHtml } from '@/lib/notificationEmail';
import { isAuthorizedCron } from './reminders';

/**
 * GET/POST /api/cron/weekly-digest — weekly activity summary email.
 *
 * Only users who opted in (weekly_digest = true in user_preferences) receive
 * it: a recap of their requests updated in the last 7 days plus anything
 * currently waiting on their approval. Scheduled weekly via vercel.json.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: optedIn, error: prefsError } = await supabaseAdmin
      .from('user_preferences')
      .select('user_id')
      .eq('weekly_digest', true);
    if (prefsError) throw prefsError;

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let sent = 0;

    for (const row of optedIn || []) {
      const userId = row.user_id;

      const [{ data: myRequests }, { data: myTasks }] = await Promise.all([
        supabaseAdmin
          .from('requests')
          .select('id, title, status, metadata, updated_at')
          .eq('creator_id', userId)
          .gte('updated_at', since)
          .order('updated_at', { ascending: false })
          .limit(20),
        supabaseAdmin
          .from('request_steps')
          .select('id, request:requests!inner ( id, title, status )')
          .eq('status', 'pending')
          .eq('request.status', 'pending')
          .eq('approver_user_id', userId),
      ]);

      const requests = myRequests || [];
      const tasks = myTasks || [];
      if (requests.length === 0 && tasks.length === 0) continue;

      const requestRows = requests
        .map((r: any) => `<li style="margin-bottom:4px"><strong>${escapeHtml(r.title || 'Untitled')}</strong> — ${escapeHtml(String(r.status))}</li>`)
        .join('');
      const taskRows = tasks
        .map((t: any) => `<li style="margin-bottom:4px"><strong>${escapeHtml(t.request?.title || 'Untitled')}</strong></li>`)
        .join('');

      const result = await sendUserNotificationEmail({
        userId,
        kind: 'digest',
        subject: 'Your weekly summary — The Circle',
        heading: 'Your week in The Circle',
        bodyHtml: `
          ${requests.length ? `<p><strong>Your requests with activity this week (${requests.length}):</strong></p><ul>${requestRows}</ul>` : ''}
          ${tasks.length ? `<p><strong>Waiting on your approval (${tasks.length}):</strong></p><ul>${taskRows}</ul>` : ''}`,
        actionUrl: '/dashboard',
        actionLabel: 'Open The Circle',
      });
      if (result.sent) sent++;
    }

    return res.status(200).json({ success: true, optedIn: (optedIn || []).length, emailsSent: sent });
  } catch (e: any) {
    console.error('cron/weekly-digest failed:', e);
    return res.status(500).json({ error: e.message || 'Digest run failed' });
  }
}
