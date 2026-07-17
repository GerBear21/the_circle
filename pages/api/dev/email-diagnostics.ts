import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getValidMsAccessToken } from '@/lib/msTokenStore';
import { sendGraphMail } from '@/lib/graphMail';
import { isGraphAppMailConfigured, sendAppGraphMail } from '@/lib/graphAppMail';
import { sendUserNotificationEmail } from '@/lib/notificationEmail';

/**
 * Email delivery diagnostics. Signed-in only; only ever emails the caller.
 *
 * Reports, for the current user and environment, exactly why notification email
 * would or wouldn't send: which transports are configured, whether the caller
 * has a usable delegated Graph token, and the concrete result/error of each
 * transport when it actually tries to email the caller. Hit this in production
 * and share the JSON — it pinpoints the failure without needing server logs.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const user = session.user as any;
  const userId: string = user.id;
  const email: string | null = user.email || null;

  const out: Record<string, any> = {
    user: { id: userId, email },
    env: {
      graphAppMailConfigured: isGraphAppMailConfigured(),
      GRAPH_MAIL_SENDER_set: !!process.env.GRAPH_MAIL_SENDER,
      AZURE_CLIENT_ID_set: !!process.env.AZURE_CLIENT_ID,
      AZURE_CLIENT_SECRET_set: !!process.env.AZURE_CLIENT_SECRET,
      AZURE_TENANT_set: !!process.env.AZURE_TENANT,
      RESEND_API_KEY_set: !!process.env.RESEND_API_KEY,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || null,
    },
    token: {},
    transports: {},
    finalNotificationEmail: {},
  };

  // 1. Delegated token status for the caller.
  try {
    const { data: row } = await supabaseAdmin
      .from('ms_oauth_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .maybeSingle();
    const now = Date.now();
    out.token = {
      hasRow: !!row,
      hasAccessToken: !!row?.access_token,
      hasRefreshToken: !!row?.refresh_token,
      expiresAt: row?.expires_at ? new Date(Number(row.expires_at)).toISOString() : null,
      isExpired: row?.expires_at ? now >= Number(row.expires_at) : null,
    };
  } catch (e: any) {
    out.token = { error: e?.message || String(e) };
  }

  let resolvedToken: string | null = null;
  try {
    resolvedToken = await getValidMsAccessToken(userId);
    out.token.getValidMsAccessToken = resolvedToken ? 'resolved (non-null)' : 'null';
  } catch (e: any) {
    out.token.getValidMsAccessTokenError = e?.message || String(e);
  }

  if (!email) {
    out.note = 'No email on session — cannot run send tests.';
    return res.status(200).json(out);
  }

  // 2. Delegated Graph send (the transport e-sign uses, and the primary path
  //    for notifications now).
  if (resolvedToken) {
    try {
      await sendGraphMail({
        accessToken: resolvedToken,
        to: { email },
        subject: 'Diagnostics: delegated Graph mail — The Circle',
        html: '<p>Delegated Graph mail works. (Sent via /api/dev/email-diagnostics)</p>',
        saveToSentItems: false,
      });
      out.transports.delegatedGraph = { attempted: true, ok: true };
    } catch (e: any) {
      out.transports.delegatedGraph = { attempted: true, ok: false, error: e?.message || String(e) };
    }
  } else {
    out.transports.delegatedGraph = { attempted: false, reason: 'no delegated token for this user' };
  }

  // 3. Application (service mailbox) Graph send.
  if (isGraphAppMailConfigured()) {
    try {
      const r = await sendAppGraphMail({
        to: email,
        subject: 'Diagnostics: app (service mailbox) Graph mail — The Circle',
        html: '<p>Application Graph mail works. (Sent via /api/dev/email-diagnostics)</p>',
      });
      out.transports.appGraph = { attempted: true, ok: r.success, error: r.error || null };
    } catch (e: any) {
      out.transports.appGraph = { attempted: true, ok: false, error: e?.message || String(e) };
    }
  } else {
    out.transports.appGraph = { attempted: false, reason: 'not configured (need AZURE_* + GRAPH_MAIL_SENDER)' };
  }

  // 4. The real notification path end-to-end (preference-gated).
  try {
    const r = await sendUserNotificationEmail({
      userId,
      actorUserId: userId,
      kind: 'approval_tasks',
      subject: 'Diagnostics: notification path — The Circle',
      heading: 'Notification path test',
      bodyHtml: '<p>This came through the real sendUserNotificationEmail path.</p>',
      actionUrl: '/dashboard',
      actionLabel: 'Open The Circle',
    });
    out.finalNotificationEmail = r;
  } catch (e: any) {
    out.finalNotificationEmail = { sent: false, error: e?.message || String(e) };
  }

  return res.status(200).json(out);
}
