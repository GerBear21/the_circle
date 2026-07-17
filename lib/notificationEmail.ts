/**
 * Preference-gated email delivery for workflow notifications.
 *
 * One entry point — sendUserNotificationEmail — that:
 *   1. Looks up the recipient's user_preferences and drops the email when the
 *      matching toggle is off.
 *   2. Sends via Microsoft Graph app mail (service mailbox) when configured,
 *      falling back to Resend, and logs (never throws) when neither transport
 *      is available. Workflow actions must never fail because of email.
 */

import { supabaseAdmin } from './supabaseAdmin';
import { sendAppGraphMail, isGraphAppMailConfigured, AppMailAttachment } from './graphAppMail';
import { sendEmail as sendResendEmail } from './email';
import { sendGraphMail } from './graphMail';
import { getValidMsAccessToken } from './msTokenStore';
import { appBaseUrl, emailLogoUrl, brandedEmailShell } from './emailShell';
import { getUserPreferences, UserPreferences } from './userPreferences';

export type NotificationEmailKind =
  | 'request_updates'   // review progress on my own requests
  | 'approval_tasks'    // a request needs my approval
  | 'completion'        // final approval + signed PDF
  | 'reminder'          // pending approval nudges
  | 'digest';           // weekly summary

const KIND_TO_PREF: Record<NotificationEmailKind, keyof UserPreferences> = {
  request_updates: 'emailRequestUpdates',
  approval_tasks: 'emailApprovalTasks',
  completion: 'emailCompletionPdf',
  reminder: 'approvalReminders',
  digest: 'weeklyDigest',
};

// Re-export the shared shell helpers so existing importers of this module
// (approvalEngine, crons) keep working unchanged.
export { appBaseUrl, emailLogoUrl, brandedEmailShell };

/** Branded shell shared by all notification emails. */
export function notificationEmailHtml(params: {
  heading: string;
  bodyHtml: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
}): string {
  return brandedEmailShell(params);
}

async function resolveRecipient(userId?: string | null, email?: string | null): Promise<string | null> {
  if (email) return email;
  if (!userId) return null;
  const { data } = await supabaseAdmin
    .from('app_users')
    .select('email')
    .eq('id', userId)
    .single();
  return data?.email || null;
}

/**
 * Send a workflow notification email, honouring the recipient's preferences.
 * Returns { sent:false } (never throws) when the toggle is off or no email
 * transport is configured.
 */
export async function sendUserNotificationEmail(params: {
  /** Recipient app_users id — used for the preference check and email lookup. */
  userId: string;
  /** Skip the app_users lookup when the caller already has the address. */
  email?: string | null;
  kind: NotificationEmailKind;
  subject: string;
  heading: string;
  /** Plain text or simple HTML body (rendered inside the branded shell). */
  bodyHtml: string;
  /** In-app path (e.g. /requests/abc) or absolute URL for the CTA button. */
  actionUrl?: string | null;
  actionLabel?: string | null;
  attachments?: AppMailAttachment[];
  /**
   * The user who triggered this notification (the approver who acted, the
   * requester who submitted, the admin who created a delegation…). Used as the
   * delegated sender when neither the service mailbox nor Resend is configured,
   * so notifications still deliver in environments that only have the same
   * delegated Graph access the e-sign flow uses. Falls back to the recipient's
   * own token (e.g. cron reminders, which have no actor).
   */
  actorUserId?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    const prefs = await getUserPreferences(params.userId);
    if (!prefs[KIND_TO_PREF[params.kind]]) {
      return { sent: false, reason: 'preference_off' };
    }

    const to = await resolveRecipient(params.userId, params.email);
    if (!to) return { sent: false, reason: 'no_email' };

    const actionUrl = params.actionUrl
      ? params.actionUrl.startsWith('http')
        ? params.actionUrl
        : `${appBaseUrl()}${params.actionUrl}`
      : null;

    const html = notificationEmailHtml({
      heading: params.heading,
      bodyHtml: params.bodyHtml,
      actionUrl,
      actionLabel: params.actionLabel,
    });

    // Transport chain, most-reliable-first.
    //
    // When a notification has an actor (the approver/requester/admin who
    // triggered it) we send via THEIR delegated Graph mailbox FIRST — the exact
    // transport the e-sign invites use, which works wherever sign-in works and
    // needs no separate application-level Mail.Send admin consent. This is the
    // key fix: application ("service mailbox") Graph mail requires a distinct
    // admin consent that is easy to miss, so relying on it alone silently drops
    // approval/update emails even when GRAPH_MAIL_SENDER is set. The service
    // mailbox and Resend remain — and are the primary path for actor-less mail
    // (cron reminders/digests) and for attachments. A final delegated attempt
    // from the recipient's own mailbox is the last resort for cron.
    type Attempt = { label: string; run: () => Promise<boolean> };
    const attempts: Attempt[] = [];

    const delegatedAttempt = (senderId: string, label: string): Attempt => ({
      label,
      run: async () => {
        const token = await getValidMsAccessToken(senderId);
        if (!token) return false;
        await sendGraphMail({
          accessToken: token,
          to: { email: to },
          subject: params.subject,
          html,
          // System notifications shouldn't clutter the sender's Sent Items.
          saveToSentItems: false,
        });
        return true;
      },
    });

    if (params.actorUserId) {
      attempts.push(delegatedAttempt(params.actorUserId, 'graph_delegated_actor'));
    }
    if (isGraphAppMailConfigured()) {
      attempts.push({
        label: 'graph_app_mail',
        run: async () =>
          (await sendAppGraphMail({ to, subject: params.subject, html, attachments: params.attachments })).success,
      });
    }
    if (process.env.RESEND_API_KEY) {
      attempts.push({
        label: 'resend',
        run: async () => !!(await sendResendEmail({ to, subject: params.subject, html })).success,
      });
    }
    if (params.userId && params.userId !== params.actorUserId) {
      attempts.push(delegatedAttempt(params.userId, 'graph_delegated_recipient'));
    }

    for (const attempt of attempts) {
      try {
        if (await attempt.run()) return { sent: true, reason: attempt.label };
        console.warn(`notificationEmail: transport ${attempt.label} did not deliver to ${to}`);
      } catch (e: any) {
        console.warn(`notificationEmail: transport ${attempt.label} threw for ${to}:`, e?.message || e);
      }
    }

    console.warn(
      `notificationEmail: all transports failed for ${to} (tried: ${attempts.map((a) => a.label).join(', ') || 'none'}). ` +
        'Need a delegated Graph token for the actor/recipient, GRAPH_MAIL_SENDER (+ application Mail.Send admin consent), or RESEND_API_KEY.'
    );
    return { sent: false, reason: 'not_configured' };
  } catch (e: any) {
    console.error('notificationEmail: send threw (non-fatal):', e);
    return { sent: false, reason: e?.message || 'error' };
  }
}

/** Escape user-supplied text before interpolating into email HTML. */
export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
