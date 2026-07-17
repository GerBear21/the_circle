import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { sendUserNotificationEmail } from '@/lib/notificationEmail';

/**
 * Self-serve email delivery test.
 *
 * POST (or GET) while signed in and this sends a branded sample notification to
 * YOUR OWN address through the exact same path real notifications use
 * (`sendUserNotificationEmail`). Use it to confirm email transport is working in
 * any environment. It only ever emails the caller, so it is safe to leave in.
 *
 * The response reports which transport delivered it (or why it didn't), so you
 * can see at a glance whether the service mailbox, Resend, or the delegated
 * Graph fallback handled the send.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const user = session.user as any;

  const result = await sendUserNotificationEmail({
    userId: user.id,
    actorUserId: user.id,
    kind: 'approval_tasks',
    subject: 'Test email — The Circle',
    heading: 'Your email delivery is working',
    bodyHtml:
      '<p>This is a test notification from The Circle. If you can read this in your inbox, ' +
      'approval-task, request-update and reminder emails will reach you the same way.</p>',
    actionUrl: '/dashboard',
    actionLabel: 'Open The Circle',
  });

  return res.status(200).json({
    ok: result.sent,
    sent: result.sent,
    reason: result.reason || null,
    to: user.email,
    hint: result.sent
      ? 'Check your inbox (and spam). Note: if only the delegated fallback is available, the message is sent from your own mailbox.'
      : 'No transport delivered it. In production set GRAPH_MAIL_SENDER (+ application Mail.Send admin consent) or RESEND_API_KEY. In dev, ensure you have a valid Microsoft session (sign in again if needed).',
  });
}
