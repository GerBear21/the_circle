import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { createHash, randomInt } from 'crypto';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { sendAppGraphMail } from '../../../../lib/graphAppMail';

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const hashOtp = (otp: string) => createHash('sha256').update(otp).digest('hex');

function money(n: number, currency = 'USD'): string {
  try { return n.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }); }
  catch { return `${currency} ${n}`; }
}

// /api/requests/[id]/cash-receipt
//   GET  — current confirmation status for the request
//   POST — requestor initiates: generates an OTP and sends it to the clerk
//   PUT  — requestor verifies the OTP the clerk read out to them
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured.' });

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;
    const { id: requestId } = req.query;

    if (!organizationId || !requestId || typeof requestId !== 'string') {
      return res.status(400).json({ error: 'Missing organization or request id' });
    }

    const { data: request, error: reqErr } = await supabaseAdmin
      .from('requests')
      .select('id, creator_id, organization_id, status, title, metadata')
      .eq('id', requestId)
      .eq('organization_id', organizationId)
      .single();
    if (reqErr || !request) return res.status(404).json({ error: 'Request not found' });

    const metadata: any = request.metadata || {};
    const isPettyCash = metadata.type === 'petty_cash' || metadata.requestType === 'petty_cash';

    // Latest confirmation for this request (most recent first).
    const { data: latest } = await supabaseAdmin
      .from('cash_receipt_confirmations')
      .select('id, clerk_email, clerk_user_id, status, amount, currency, confirmed_at, otp_expires_at, attempts, created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Public-safe view of a confirmation (never leaks the OTP hash).
    const publicView = latest
      ? {
          id: latest.id,
          clerkEmail: latest.clerk_email,
          status: latest.status,
          amount: latest.amount,
          currency: latest.currency,
          confirmedAt: latest.confirmed_at,
          expiresAt: latest.otp_expires_at,
          expired: latest.status === 'pending' && new Date(latest.otp_expires_at).getTime() < Date.now(),
        }
      : null;

    if (req.method === 'GET') {
      return res.status(200).json({ confirmation: publicView, isPettyCash });
    }

    // Mutations below require: petty cash + fully approved + the creator.
    if (!isPettyCash) return res.status(400).json({ error: 'Cash receipt confirmation only applies to petty cash.' });
    if (request.status !== 'approved') return res.status(400).json({ error: 'The request must be fully approved first.' });
    if (request.creator_id !== userId) return res.status(403).json({ error: 'Only the requestor can confirm cash receipt.' });
    if (latest?.status === 'confirmed') return res.status(400).json({ error: 'Cash receipt is already confirmed.' });

    if (req.method === 'POST') {
      const clerkEmailRaw = (req.body?.clerkEmail || '').toString().trim().toLowerCase();
      if (!clerkEmailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clerkEmailRaw)) {
        return res.status(400).json({ error: 'A valid accounts clerk email is required.' });
      }
      if (clerkEmailRaw === (user.email || '').toLowerCase()) {
        return res.status(400).json({ error: 'The clerk must be a different person from the requestor.' });
      }

      // Resolve the clerk to an in-app user (same org). The one-time code is
      // delivered to the clerk's in-app notifications, so the clerk MUST be a
      // registered system user — the UI presents a picker of existing users
      // for exactly this reason. (Email is an optional extra channel below.)
      const { data: clerkUser } = await supabaseAdmin
        .from('app_users')
        .select('id, display_name, email')
        .eq('organization_id', organizationId)
        .ilike('email', clerkEmailRaw)
        .maybeSingle();

      if (!clerkUser?.id) {
        return res.status(400).json({
          error: 'The accounts clerk must be a registered system user. Please pick them from the list of users.',
        });
      }

      const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
      const amount = Number(String(metadata.totalAmount ?? metadata.amount ?? '0').replace(/[^0-9.]/g, '')) || null;
      const currency = metadata.currency || 'USD';

      // Cancel any prior pending confirmation so only one OTP is ever live.
      await supabaseAdmin
        .from('cash_receipt_confirmations')
        .update({ status: 'cancelled' })
        .eq('request_id', requestId)
        .eq('status', 'pending');

      const { data: created, error: insErr } = await supabaseAdmin
        .from('cash_receipt_confirmations')
        .insert({
          request_id: requestId,
          organization_id: organizationId,
          requestor_id: userId,
          clerk_email: clerkEmailRaw,
          clerk_user_id: clerkUser?.id || null,
          otp_hash: hashOtp(otp),
          otp_expires_at: expiresAt,
          amount,
          currency,
          status: 'pending',
        })
        .select('id')
        .single();
      if (insErr) {
        console.error('cash-receipt initiate insert failed:', insErr);
        return res.status(500).json({ error: 'Failed to start cash confirmation.' });
      }

      const requestorName = user.name || 'A colleague';
      const amountLabel = amount ? money(amount, currency) : 'the petty cash';
      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
          <h2 style="color:#3F2D19">Petty Cash Receipt — One-Time Code</h2>
          <p>${requestorName} is collecting ${amountLabel} for petty cash voucher
             "<strong>${request.title}</strong>".</p>
          <p>Share this one-time code with the requestor <strong>only when you hand over the cash</strong>:</p>
          <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#9A7545">${otp}</p>
          <p style="color:#666;font-size:13px">This code expires in ${OTP_TTL_MINUTES} minutes. If you did not expect this, ignore this email.</p>
        </div>`;

      // Email the clerk via Microsoft Graph. The OTP must ONLY ever reach the
      // clerk — NEVER the requestor. We therefore send strictly from the
      // app-only service mailbox and NEVER via the requestor's delegated token
      // (a delegated send drops a copy, OTP and all, into the requestor's Sent
      // Items). The OTP is also kept OUT of the subject line for the same
      // reason; it lives only in the email body and the clerk's in-app
      // notification.
      let emailSent = false;
      let emailError: string | undefined;
      const subject = 'Petty cash one-time code';
      try {
        const r = await sendAppGraphMail({ to: clerkEmailRaw, subject, html: emailHtml });
        emailSent = !!r?.success;
        if (!emailSent) emailError = r?.error;
      } catch (e: any) {
        emailError = e?.message || 'Email failed';
        console.error('cash-receipt email failed:', e);
      }

      // In-app notification to the clerk — this is the primary delivery
      // channel. The clerk reads the code from their in-app notifications.
      let inAppSent = false;
      try {
        const { error: notifErr } = await supabaseAdmin.from('notifications').insert({
          organization_id: organizationId,
          recipient_id: clerkUser.id,
          sender_id: userId,
          type: 'info',
          title: 'Petty Cash One-Time Code',
          message: `${requestorName} is collecting ${amountLabel}. Your one-time code is ${otp}. Share it only when handing over the cash. Expires in ${OTP_TTL_MINUTES} min.`,
          metadata: { request_id: requestId, request_type: 'petty_cash', cash_receipt_confirmation_id: created.id },
          is_read: false,
        });
        inAppSent = !notifErr;
        if (notifErr) console.error('cash-receipt in-app notification failed:', notifErr);
      } catch (e) {
        console.error('cash-receipt in-app notification failed:', e);
      }

      // If the code could not be delivered by ANY channel, don't leave a live
      // pending confirmation behind (that's what made the UI prompt the
      // requestor to "Confirm cash received" after a delivery failure). Roll
      // the record back and report the failure.
      if (!inAppSent && !emailSent) {
        await supabaseAdmin
          .from('cash_receipt_confirmations')
          .update({ status: 'cancelled' })
          .eq('id', created.id);
        return res.status(502).json({
          error: `Could not deliver the one-time code to ${clerkUser.display_name || clerkEmailRaw}.${emailError ? ` (${emailError})` : ''} Please try again.`,
        });
      }

      return res.status(201).json({
        confirmationId: created.id,
        clerkEmail: clerkEmailRaw,
        clerkName: clerkUser.display_name || null,
        clerkFound: true,
        inAppSent,
        emailSent,
        emailError: emailSent ? undefined : emailError,
        expiresAt,
      });
    }

    if (req.method === 'PUT') {
      const otp = (req.body?.otp || '').toString().trim();
      if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'Enter the 6-digit code.' });

      if (!latest || latest.status !== 'pending') {
        return res.status(400).json({ error: 'No active confirmation. Send a new code to the clerk.' });
      }
      if (new Date(latest.otp_expires_at).getTime() < Date.now()) {
        await supabaseAdmin.from('cash_receipt_confirmations').update({ status: 'expired' }).eq('id', latest.id);
        return res.status(400).json({ error: 'The code has expired. Send a new one.' });
      }
      if (latest.attempts >= MAX_ATTEMPTS) {
        await supabaseAdmin.from('cash_receipt_confirmations').update({ status: 'cancelled' }).eq('id', latest.id);
        return res.status(400).json({ error: 'Too many incorrect attempts. Send a new code.' });
      }

      // Re-read the hash (kept out of the list select above).
      const { data: secret } = await supabaseAdmin
        .from('cash_receipt_confirmations')
        .select('otp_hash')
        .eq('id', latest.id)
        .single();

      if (!secret || secret.otp_hash !== hashOtp(otp)) {
        await supabaseAdmin
          .from('cash_receipt_confirmations')
          .update({ attempts: (latest.attempts || 0) + 1 })
          .eq('id', latest.id);
        return res.status(400).json({ error: 'Incorrect code. Please check with the clerk and try again.' });
      }

      const { data: confirmed, error: confErr } = await supabaseAdmin
        .from('cash_receipt_confirmations')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', latest.id)
        .select('id, clerk_email, confirmed_at, amount, currency')
        .single();
      if (confErr) {
        console.error('cash-receipt confirm failed:', confErr);
        return res.status(500).json({ error: 'Failed to confirm receipt.' });
      }

      return res.status(200).json({ confirmed: true, confirmation: confirmed });
    }

    if (req.method === 'DELETE') {
      // Cancel any live pending confirmation so the requestor can start over
      // (e.g. wrong clerk email).
      await supabaseAdmin
        .from('cash_receipt_confirmations')
        .update({ status: 'cancelled' })
        .eq('request_id', requestId)
        .eq('status', 'pending');
      return res.status(200).json({ cancelled: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('cash-receipt handler error:', error);
    return res.status(500).json({ error: error?.message || 'Cash receipt request failed' });
  }
}
