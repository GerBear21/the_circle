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

export function appBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/** Branded shell shared by all notification emails. */
export function notificationEmailHtml(params: {
  heading: string;
  bodyHtml: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
}): string {
  const button = params.actionUrl
    ? `<table role="presentation" style="margin:28px 0"><tr><td>
         <a href="${params.actionUrl}" style="display:inline-block;padding:12px 28px;background-color:#9A7545;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px">
           ${params.actionLabel || 'View in The Circle'}
         </a>
       </td></tr></table>`
    : '';
  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f4f5;padding:32px 16px">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
        <div style="background:#9A7545;padding:20px 32px">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.3px">The Circle</span>
        </div>
        <div style="padding:32px;color:#1f2937">
          <h2 style="margin:0 0 12px;font-size:18px;color:#111827">${params.heading}</h2>
          <div style="font-size:14px;line-height:1.6;color:#374151">${params.bodyHtml}</div>
          ${button}
        </div>
        <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#9ca3af;font-size:12px">
            Rainbow Tourism Group • The Circle Approval System.
            You can change which emails you receive under My Settings → Notifications.
          </p>
        </div>
      </div>
    </div>`;
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

    if (isGraphAppMailConfigured()) {
      const res = await sendAppGraphMail({
        to,
        subject: params.subject,
        html,
        attachments: params.attachments,
      });
      if (res.success) return { sent: true };
      console.warn('notificationEmail: Graph send failed, trying Resend:', res.error);
    }

    if (process.env.RESEND_API_KEY) {
      // Resend fallback (no attachment support wired here — the body carries
      // download links, which is enough when Graph mail is unavailable).
      const res = await sendResendEmail({ to, subject: params.subject, html });
      return { sent: !!res.success, reason: res.success ? undefined : res.error };
    }

    console.warn('notificationEmail: no email transport configured (GRAPH_MAIL_SENDER or RESEND_API_KEY). Email not sent.');
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
