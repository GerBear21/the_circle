import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured. Email not sent.');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'The Circle <noreply@rtg.co.zw>',
      to: [to],
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('Email send error:', err);
    return { success: false, error: err.message };
  }
}

export function getPinResetEmailHtml(resetUrl: string, userName?: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 32px 40px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 12px 12px 0 0;">
                  <table role="presentation" style="width: 100%;">
                    <tr>
                      <td>
                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                          🔐 Reset Your Approval PIN
                        </h1>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Body -->
              <tr>
                <td style="padding: 40px;">
                  <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                    Hi${userName ? ` ${userName}` : ''},
                  </p>
                  <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                    You requested to reset your approval PIN for <strong>The Circle</strong>. Click the button below to set a new PIN:
                  </p>
                  
                  <!-- CTA Button -->
                  <table role="presentation" style="width: 100%; margin: 32px 0;">
                    <tr>
                      <td align="center">
                        <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);">
                          Reset My PIN
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Warning -->
                  <table role="presentation" style="width: 100%; background-color: #fef3c7; border-radius: 8px; margin: 24px 0;">
                    <tr>
                      <td style="padding: 16px;">
                        <p style="margin: 0; color: #92400e; font-size: 14px;">
                          ⏰ <strong>This link will expire in 1 hour.</strong> If you didn't request this reset, please ignore this email or contact IT support.
                        </p>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Alternative Link -->
                  <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                    If the button doesn't work, copy and paste this link into your browser:
                  </p>
                  <p style="margin: 8px 0 0; word-break: break-all;">
                    <a href="${resetUrl}" style="color: #2563eb; font-size: 13px;">${resetUrl}</a>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                    Rainbow Tourism Group • The Circle Approval System
                  </p>
                  <p style="margin: 8px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
                    This is an automated message. Please do not reply to this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export function getPinResetEmailText(resetUrl: string, userName?: string) {
  return `
Hi${userName ? ` ${userName}` : ''},

You requested to reset your approval PIN for The Circle.

Click the link below to set a new PIN:
${resetUrl}

⏰ This link will expire in 1 hour.

If you didn't request this reset, please ignore this email or contact IT support.

---
Rainbow Tourism Group • The Circle Approval System
This is an automated message. Please do not reply to this email.
  `.trim();
}
