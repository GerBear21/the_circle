/**
 * Application-level Microsoft Graph mail (client-credentials).
 *
 * Sends system-generated email (e.g. OTP codes) from a dedicated service
 * mailbox using the app's own identity — NOT the signed-in user. This keeps
 * the message out of any user's Sent Items, which matters for OTPs the sender
 * must not be able to read.
 *
 * Requirements (all Microsoft-native, no third party):
 *   - Azure AD app (already used for sign-in): AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_TENANT
 *   - Graph **application** permission `Mail.Send` granted with admin consent
 *   - GRAPH_MAIL_SENDER = the UPN/email of the mailbox to send from
 *
 * Degrades gracefully: if not configured it returns { success:false } instead
 * of throwing, so callers (OTP flow) never 500.
 */

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}
let cached: CachedToken | null = null;

export function isGraphAppMailConfigured(): boolean {
  return !!(
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_TENANT &&
    process.env.GRAPH_MAIL_SENDER
  );
}

export async function getAppToken(): Promise<string | null> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET || !process.env.AZURE_TENANT) {
    return null;
  }

  const tenant = process.env.AZURE_TENANT;
  const body = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const resp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    console.error('graphAppMail: token request failed:', resp.status, text);
    return null;
  }
  const json: any = await resp.json();
  if (!json.access_token) return null;
  cached = {
    token: json.access_token,
    expiresAt: Date.now() + (Number(json.expires_in || 3600) * 1000),
  };
  return cached.token;
}

export interface SendAppMailOptions {
  to: string;
  subject: string;
  html: string;
  /** Override the sender mailbox (defaults to GRAPH_MAIL_SENDER). */
  sender?: string;
}

export async function sendAppGraphMail(
  opts: SendAppMailOptions
): Promise<{ success: boolean; error?: string }> {
  const sender = opts.sender || process.env.GRAPH_MAIL_SENDER;
  if (!sender) {
    console.warn('graphAppMail: GRAPH_MAIL_SENDER not configured. Email not sent.');
    return { success: false, error: 'Graph mail sender not configured' };
  }

  const token = await getAppToken();
  if (!token) return { success: false, error: 'Could not acquire Graph app token' };

  const message = {
    subject: opts.subject,
    body: { contentType: 'HTML', content: opts.html },
    toRecipients: [{ emailAddress: { address: opts.to } }],
  };

  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      // System mail — don't keep a copy in the service mailbox's Sent Items.
      body: JSON.stringify({ message, saveToSentItems: false }),
    }
  );

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    console.error('graphAppMail: sendMail failed:', resp.status, text);
    return { success: false, error: `Graph sendMail failed (${resp.status})` };
  }
  return { success: true };
}
