/**
 * Microsoft Graph mail helper.
 *
 * Sends email *as the signed-in user* using a delegated access token captured
 * by NextAuth (see pages/api/auth/[...nextauth].ts). The token must include
 * the Mail.Send scope. With this approach the message appears in the user's
 * own Outlook Sent Items and is delivered from their real M365 mailbox —
 * no shared "noreply" mailbox required.
 */

export interface GraphMailRecipient {
  email: string;
  name?: string;
}

export interface SendGraphMailOptions {
  accessToken: string;
  to: GraphMailRecipient | GraphMailRecipient[];
  cc?: GraphMailRecipient[];
  bcc?: GraphMailRecipient[];
  subject: string;
  html: string;
  /** Save a copy in the sender's Sent Items (default: true). */
  saveToSentItems?: boolean;
}

function toRecipientList(
  r: GraphMailRecipient | GraphMailRecipient[]
): Array<{ emailAddress: { address: string; name?: string } }> {
  const arr = Array.isArray(r) ? r : [r];
  return arr.map((x) => ({
    emailAddress: { address: x.email, name: x.name },
  }));
}

/**
 * Send an HTML email via Microsoft Graph /me/sendMail. Throws on failure.
 * Returns nothing on success (Graph returns 202 Accepted with no body).
 */
export async function sendGraphMail(opts: SendGraphMailOptions): Promise<void> {
  const {
    accessToken,
    to,
    cc,
    bcc,
    subject,
    html,
    saveToSentItems = true,
  } = opts;

  const message: Record<string, unknown> = {
    subject,
    body: { contentType: "HTML", content: html },
    toRecipients: toRecipientList(to),
  };
  if (cc?.length) message.ccRecipients = toRecipientList(cc);
  if (bcc?.length) message.bccRecipients = toRecipientList(bcc);

  const resp = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, saveToSentItems }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Microsoft Graph sendMail failed (${resp.status}): ${text || resp.statusText}`
    );
  }
}

/**
 * Branded HTML template for an "invitation to sign" email. The signing link
 * points at /esign/sign/[token] in the current deployment.
 */
export function getSignInviteEmailHtml(params: {
  signerName?: string;
  requesterName: string;
  documentName: string;
  signingUrl: string;
  message?: string;
  expiresInDays?: number;
}): string {
  const {
    signerName,
    requesterName,
    documentName,
    signingUrl,
    message,
    expiresInDays = 30,
  } = params;

  const greeting = signerName ? `Hi ${escapeHtml(signerName)},` : "Hello,";
  const messageBlock = message
    ? `
      <table role="presentation" style="width: 100%; background-color: #f3f4f6; border-left: 4px solid #2563eb; border-radius: 8px; margin: 24px 0;">
        <tr>
          <td style="padding: 16px 20px;">
            <p style="margin: 0 0 6px; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Personal message</p>
            <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(message)}</p>
          </td>
        </tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);overflow:hidden;">
          <tr>
            <td style="padding:32px 40px;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">
                ✍️ You have a document to sign
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">${greeting}</p>
              <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
                <strong>${escapeHtml(requesterName)}</strong> has invited you to electronically sign the document
                <strong>"${escapeHtml(documentName)}"</strong>.
              </p>
              ${messageBlock}
              <table role="presentation" style="width:100%;margin:32px 0;">
                <tr>
                  <td align="center">
                    <a href="${signingUrl}" style="display:inline-block;padding:14px 36px;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;border-radius:8px;box-shadow:0 2px 4px rgba(37,99,235,0.3);">
                      Review &amp; Sign Document
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" style="width:100%;background-color:#fef3c7;border-radius:8px;margin:24px 0;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;color:#92400e;font-size:13px;">
                      ⏰ This signing link expires in ${expiresInDays} days.
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:8px 0 0;word-break:break-all;">
                <a href="${signingUrl}" style="color:#2563eb;font-size:12px;">${signingUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                Sent via The Circle on behalf of ${escapeHtml(requesterName)}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
