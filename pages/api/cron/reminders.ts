import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getPreferencesForUsers, UserPreferences, ReminderFrequency } from '@/lib/userPreferences';
import { sendUserNotificationEmail, escapeHtml } from '@/lib/notificationEmail';

/**
 * GET/POST /api/cron/reminders — daily approval + draft reminders.
 *
 * Reminds approvers about requests sitting on them, and requesters about their
 * own stale drafts, honouring each org's SLA timing settings and each user's
 * per-user reminder preferences (channel + frequency). Delivers in-app and/or
 * email. Best-effort throughout — a delivery failure never aborts the run.
 *
 * Invoked by the Vercel cron (vercel.json). Vercel sends
 * `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is set.
 */
export function isAuthorizedCron(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Without a shared secret only allow local development invocations.
    return process.env.NODE_ENV !== 'production';
  }
  return req.headers.authorization === `Bearer ${secret}`;
}

const HOUR_MS = 60 * 60 * 1000;

// Per-user frequency → minimum hours between reminders.
const FREQUENCY_GAP_HOURS: Record<ReminderFrequency, number | null> = {
  daily: 24,
  every_2_days: 48,
  weekly: 168,
  off: null,
};

// Request type → SLA setting key (falls back to default_approval_hours).
function slaKeyForType(type?: string | null): string {
  switch (type) {
    case 'capex':
      return 'capex_sla_hours';
    case 'travel_authorization':
    case 'international_travel_authorization':
      return 'travel_sla_hours';
    case 'hotel_booking':
    case 'external_hotel_booking':
      return 'hotel_booking_sla_hours';
    case 'voucher_request':
      return 'voucher_sla_hours';
    case 'template':
    case 'custom':
      return 'template_form_sla_hours';
    default:
      return 'default_approval_hours';
  }
}

type SlaSettings = Record<string, any>;

function slaHoursForType(sla: SlaSettings, type?: string | null): number {
  const key = slaKeyForType(type);
  const val = Number(sla[key]);
  if (Number.isFinite(val) && val > 0) return val;
  const dflt = Number(sla['default_approval_hours']);
  return Number.isFinite(dflt) && dflt > 0 ? dflt : 24;
}

/** Whether a reminder is due now for a piece of work, given its age + cadence. */
function reminderDue(params: {
  ageMs: number;            // how long the work has been sitting
  slaHours: number;
  beforeBreachHours: number;
  repeatHours: number;
  maxCount: number;
  lastRemindedAt: string | null;
  frequency: ReminderFrequency;
  now: number;
}): boolean {
  const { ageMs, slaHours, beforeBreachHours, repeatHours, maxCount, lastRemindedAt, frequency, now } = params;
  const freqGap = FREQUENCY_GAP_HOURS[frequency];
  if (freqGap == null) return false; // frequency 'off'

  // First reminder fires this many ms before the SLA breach.
  const firstReminderAtMs = (slaHours - beforeBreachHours) * HOUR_MS;
  if (ageMs < firstReminderAtMs) return false;

  // Cap: stop once the number of repeats due would exceed maxCount.
  const repeat = Math.max(repeatHours, 1) * HOUR_MS;
  const reminderIndex = Math.floor((ageMs - firstReminderAtMs) / repeat); // 0-based
  if (reminderIndex + 1 > Math.max(maxCount, 1)) return false;

  // Respect both the org repeat interval and the user's frequency gap.
  const minGapMs = Math.max(repeat, freqGap * HOUR_MS);
  if (lastRemindedAt) {
    if (now - new Date(lastRemindedAt).getTime() < minGapMs) return false;
  }
  return true;
}

interface PendingTask {
  stepId: string;
  requestId: string;
  title: string;
  referenceCode: string | null;
  dueAt: string | null;
  overdue: boolean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = Date.now();

  try {
    // ---- Load pending approval steps + draft requests -----------------------
    const { data: steps, error: stepsError } = await supabaseAdmin
      .from('request_steps')
      .select(`
        id, approver_user_id, due_at, last_reminded_at,
        request:requests!inner ( id, title, status, metadata, organization_id, created_at )
      `)
      .eq('status', 'pending')
      .eq('request.status', 'pending')
      .not('approver_user_id', 'is', null);
    if (stepsError) throw stepsError;

    const { data: drafts, error: draftsError } = await supabaseAdmin
      .from('requests')
      .select('id, title, creator_id, organization_id, created_at, updated_at, metadata')
      .eq('status', 'draft')
      .not('creator_id', 'is', null);
    if (draftsError) throw draftsError;

    // ---- Load SLA settings for every involved org ---------------------------
    const orgIds = new Set<string>();
    for (const s of steps || []) { const r: any = (s as any).request; if (r?.organization_id) orgIds.add(r.organization_id); }
    for (const d of drafts || []) { if (d.organization_id) orgIds.add(d.organization_id); }

    const slaByOrg = await loadSlaByOrg(Array.from(orgIds));

    // ---- Load preferences for every involved user ---------------------------
    const userIds = new Set<string>();
    for (const s of steps || []) { if ((s as any).approver_user_id) userIds.add((s as any).approver_user_id); }
    for (const d of drafts || []) { if (d.creator_id) userIds.add(d.creator_id); }
    const prefsMap = await getPreferencesForUsers(Array.from(userIds));

    // ---- Approval reminders -------------------------------------------------
    // Group each approver's due steps so we send one summary per person.
    const dueByApprover = new Map<string, PendingTask[]>();
    const dueStepIds: string[] = [];

    for (const step of (steps || []) as any[]) {
      const request = step.request;
      if (!request) continue;
      const prefs = prefsMap.get(step.approver_user_id);
      if (!prefs || prefs.reminderChannel === 'none') continue;

      const sla = slaByOrg.get(request.organization_id) || {};
      const slaHours = slaHoursForType(sla, request.metadata?.type || request.metadata?.requestType);
      const ageMs = now - new Date(request.created_at).getTime();

      const due = reminderDue({
        ageMs,
        slaHours,
        beforeBreachHours: Number(sla['reminder_hours_before_breach']) || 4,
        repeatHours: Number(sla['reminder_repeat_hours']) || 8,
        maxCount: Number(sla['reminder_max_count']) || 5,
        lastRemindedAt: step.last_reminded_at || null,
        frequency: prefs.reminderFrequency,
        now,
      });
      if (!due) continue;

      const breachMs = new Date(request.created_at).getTime() + slaHours * HOUR_MS;
      const list = dueByApprover.get(step.approver_user_id) || [];
      list.push({
        stepId: step.id,
        requestId: request.id,
        title: request.title || 'Untitled request',
        referenceCode: request.metadata?.referenceCode || null,
        dueAt: step.due_at || null,
        overdue: now > breachMs,
      });
      dueByApprover.set(step.approver_user_id, list);
      dueStepIds.push(step.id);
    }

    let approvalEmails = 0;
    let approvalInApp = 0;
    for (const [approverId, tasks] of Array.from(dueByApprover.entries())) {
      const prefs = prefsMap.get(approverId)!;
      const wantsEmail = prefs.reminderChannel === 'email' || prefs.reminderChannel === 'both';
      const wantsInApp = prefs.reminderChannel === 'in_app' || prefs.reminderChannel === 'both';
      const overdueCount = tasks.filter((t) => t.overdue).length;

      if (wantsInApp) {
        const ok = await insertReminderNotification(approverId, tasks, overdueCount);
        if (ok) approvalInApp++;
      }
      if (wantsEmail) {
        const rows = tasks
          .map((t) => `<li style="margin-bottom:6px"><strong>${escapeHtml(t.title)}</strong>${t.referenceCode ? ` (${escapeHtml(t.referenceCode)})` : ''}${t.overdue ? ' — <span style="color:#b91c1c;font-weight:600">overdue</span>' : ''}</li>`)
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
        if (result.sent) approvalEmails++;
      }
    }

    // Stamp last_reminded_at on every step we reminded about (any channel).
    if (dueStepIds.length > 0) {
      await supabaseAdmin
        .from('request_steps')
        .update({ last_reminded_at: new Date(now).toISOString() })
        .in('id', dueStepIds);
    }

    // ---- Draft reminders ----------------------------------------------------
    let draftEmails = 0;
    let draftInApp = 0;
    for (const draft of (drafts || []) as any[]) {
      const prefs = prefsMap.get(draft.creator_id);
      if (!prefs || !prefs.draftReminders || prefs.reminderChannel === 'none') continue;
      const freqGap = FREQUENCY_GAP_HOURS[prefs.reminderFrequency];
      if (freqGap == null) continue;

      const sla = slaByOrg.get(draft.organization_id) || {};
      const draftHours = Number(sla['draft_reminder_hours']) || 48;
      const baseline = new Date(draft.updated_at || draft.created_at).getTime();
      const ageMs = now - baseline;
      if (ageMs < draftHours * HOUR_MS) continue;

      const lastReminded = draft.metadata?.last_draft_reminded_at
        ? new Date(draft.metadata.last_draft_reminded_at).getTime()
        : null;
      if (lastReminded && now - lastReminded < freqGap * HOUR_MS) continue;

      const wantsEmail = prefs.reminderChannel === 'email' || prefs.reminderChannel === 'both';
      const wantsInApp = prefs.reminderChannel === 'in_app' || prefs.reminderChannel === 'both';
      const ref = draft.metadata?.referenceCode ? ` (${draft.metadata.referenceCode})` : '';

      if (wantsInApp) {
        try {
          await supabaseAdmin.from('notifications').insert({
            organization_id: draft.organization_id,
            recipient_id: draft.creator_id,
            type: 'task',
            title: 'You have an unsubmitted draft',
            message: `Your draft "${draft.title || 'Untitled request'}"${ref} hasn't been submitted yet. Submit it to start the approval process, or discard it.`,
            metadata: { request_id: draft.id, action_label: 'Open draft', action_url: `/requests/${draft.id}` },
            is_read: false,
          });
          draftInApp++;
        } catch (e) {
          console.error('draft reminder in-app failed:', e);
        }
      }
      if (wantsEmail) {
        const result = await sendUserNotificationEmail({
          userId: draft.creator_id,
          kind: 'reminder',
          subject: `Reminder: your draft "${draft.title || 'Untitled request'}" is unsubmitted`,
          heading: 'You have an unsubmitted draft',
          bodyHtml: `<p>Your draft <strong>${escapeHtml(draft.title || 'Untitled request')}</strong>${ref ? escapeHtml(ref) : ''} has been sitting unsubmitted. Submit it to start its approval, or discard it if it&apos;s no longer needed.</p>`,
          actionUrl: `/requests/${draft.id}`,
          actionLabel: 'Open my draft',
        });
        if (result.sent) draftEmails++;
      }

      // Record when we last nudged this draft so frequency spacing works.
      try {
        await supabaseAdmin
          .from('requests')
          .update({ metadata: { ...(draft.metadata || {}), last_draft_reminded_at: new Date(now).toISOString() } })
          .eq('id', draft.id);
      } catch (e) {
        console.error('draft reminder timestamp update failed:', e);
      }
    }

    return res.status(200).json({
      success: true,
      approvals: { approversReminded: dueByApprover.size, emails: approvalEmails, inApp: approvalInApp, steps: dueStepIds.length },
      drafts: { emails: draftEmails, inApp: draftInApp },
    });
  } catch (e: any) {
    console.error('cron/reminders failed:', e);
    return res.status(500).json({ error: e.message || 'Reminder run failed' });
  }
}

/** Load system_settings category='sla' for the given orgs into org → {key:value}. */
async function loadSlaByOrg(orgIds: string[]): Promise<Map<string, SlaSettings>> {
  const map = new Map<string, SlaSettings>();
  if (orgIds.length === 0) return map;
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('organization_id, key, value')
    .eq('category', 'sla')
    .in('organization_id', orgIds);
  for (const row of data || []) {
    const bag = map.get(row.organization_id) || {};
    bag[row.key] = row.value;
    map.set(row.organization_id, bag);
  }
  return map;
}

/** Insert one grouped in-app reminder for an approver's due tasks. */
async function insertReminderNotification(approverId: string, tasks: PendingTask[], overdueCount: number): Promise<boolean> {
  try {
    const first = tasks[0];
    const orgId = await resolveOrgForUser(approverId);
    if (!orgId) return false;
    const suffix = overdueCount > 0 ? ` (${overdueCount} overdue)` : '';
    await supabaseAdmin.from('notifications').insert({
      organization_id: orgId,
      recipient_id: approverId,
      type: 'task',
      title: `${tasks.length} approval${tasks.length === 1 ? '' : 's'} awaiting you${suffix}`,
      message:
        tasks.length === 1
          ? `"${first.title}"${first.referenceCode ? ` (${first.referenceCode})` : ''} is waiting for your approval.`
          : `${tasks.length} requests are waiting for your approval in The Circle.`,
      metadata: { action_label: 'Review approvals', action_url: '/approvals' },
      is_read: false,
    });
    return true;
  } catch (e) {
    console.error('reminder in-app insert failed:', e);
    return false;
  }
}

const orgCache = new Map<string, string | null>();
async function resolveOrgForUser(userId: string): Promise<string | null> {
  if (orgCache.has(userId)) return orgCache.get(userId)!;
  const { data } = await supabaseAdmin.from('app_users').select('organization_id').eq('id', userId).single();
  const org = data?.organization_id || null;
  orgCache.set(userId, org);
  return org;
}
