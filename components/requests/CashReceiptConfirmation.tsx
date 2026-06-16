import { useEffect, useState } from 'react';
import { Button } from '../ui';
import { useToast } from '../ui/ToastProvider';

interface ConfirmationView {
  id: string;
  clerkEmail: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
  amount: number | null;
  currency: string | null;
  confirmedAt: string | null;
  expiresAt: string | null;
  expired: boolean;
}

interface Props {
  requestId: string;
  isCreator: boolean;
  /** Whether the request is fully approved. Section is hidden otherwise. */
  approved: boolean;
}

function fmt(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime())
    ? '—'
    : dt.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Cash-receipt OTP sign-off for fully-approved petty-cash requests. The
// requestor enters the accounts clerk's email; the clerk receives a one-time
// code (in-app + email); the requestor types it back here to confirm the
// hand-over. Confirmed records appear under Finance → Cash Receipts.
export default function CashReceiptConfirmation({ requestId, isCreator, approved }: Props) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isPettyCash, setIsPettyCash] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationView | null>(null);

  const [clerkEmail, setClerkEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [remaining, setRemaining] = useState<number>(0); // seconds until OTP expiry

  const load = async () => {
    try {
      const res = await fetch(`/api/requests/${requestId}/cash-receipt`);
      if (!res.ok) return;
      const data = await res.json();
      setIsPettyCash(!!data.isPettyCash);
      setConfirmation(data.confirmation || null);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  // Tick a 1-second countdown to the OTP expiry while a code is live.
  useEffect(() => {
    if (confirmation?.status !== 'pending' || !confirmation?.expiresAt) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const secs = Math.max(0, Math.round((new Date(confirmation.expiresAt as string).getTime() - Date.now()) / 1000));
      setRemaining(secs);
    };
    tick();
    const h = setInterval(tick, 1000);
    return () => clearInterval(h);
  }, [confirmation?.status, confirmation?.expiresAt]);

  if (loading || !approved || !isPettyCash) return null;

  // Treat the OTP as live only while the countdown hasn't reached zero.
  const isPendingLive = confirmation?.status === 'pending' && !confirmation?.expired && remaining > 0;
  const isConfirmed = confirmation?.status === 'confirmed';
  const mmss = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;

  // Anyone viewing a confirmed receipt sees the green confirmation.
  if (isConfirmed) {
    return (
      <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <svg className="mt-0.5 h-6 w-6 flex-shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-bold text-emerald-900">Cash receipt confirmed</h3>
            <p className="mt-1 text-sm text-emerald-800">
              Confirmed with clerk <strong>{confirmation?.clerkEmail}</strong> on {fmt(confirmation?.confirmedAt || null)}.
              {confirmation?.amount ? ` Amount: ${confirmation.currency || 'USD'} ${Number(confirmation.amount).toLocaleString()}.` : ''}
            </p>
            <p className="mt-1 text-xs text-emerald-700">This record is visible to the finance department.</p>
          </div>
        </div>
      </div>
    );
  }

  // Non-creators only see a subtle pending hint (no controls).
  if (!isCreator) {
    if (isPendingLive) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Awaiting cash-receipt confirmation from the requestor (code sent to {confirmation?.clerkEmail}).
        </div>
      );
    }
    return null;
  }

  // Generate + send a code to the given clerk email. Used by both the initial
  // "Send Code" (email from the input) and "Resend" (reuse the saved clerk
  // email — the bug was resend reading the now-hidden email input).
  const send = async (email: string) => {
    const target = (email || '').trim();
    if (!target) { addToast({ type: 'error', title: 'Clerk email required', message: 'Enter the accounts clerk email.' }); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/cash-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkEmail: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code');
      if (data.emailSent) {
        addToast({
          type: 'success',
          title: 'Code sent to clerk',
          message: data.clerkFound
            ? `A one-time code was sent to ${data.clerkEmail} (in-app notification + email).`
            : `A one-time code was emailed to ${data.clerkEmail}.`,
        });
      } else if (data.clerkFound) {
        // Email didn't go out, but the clerk is a system user and got the
        // code via their in-app notifications.
        addToast({
          type: 'info',
          title: 'Code sent in-app',
          message: `Email could not be delivered, but ${data.clerkEmail} received the code in their in-app notifications.`,
        });
      } else {
        addToast({
          type: 'error',
          title: 'Email not delivered',
          message: `Could not email ${data.clerkEmail}${data.emailError ? ` (${data.emailError})` : ''}. Ask an admin to configure Microsoft email, or use a clerk who has a system account.`,
        });
      }
      setOtp('');
      await load();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Could not send code', message: e?.message || 'Unknown error' });
    } finally {
      setSending(false);
    }
  };

  const sendCode = () => send(clerkEmail);
  const resend = () => send(confirmation?.clerkEmail || clerkEmail);

  const cancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/cash-receipt`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to cancel');
      setOtp('');
      setClerkEmail('');
      addToast({ type: 'info', title: 'Cancelled', message: 'The code was cancelled. You can start again.' });
      await load();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Could not cancel', message: e?.message || 'Unknown error' });
    } finally {
      setCancelling(false);
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(otp.trim())) { addToast({ type: 'error', title: 'Enter the 6-digit code', message: 'Ask the clerk for the code they received.' }); return; }
    setVerifying(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/cash-receipt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      addToast({ type: 'success', title: 'Cash receipt confirmed', message: 'The hand-over has been recorded for finance.' });
      await load();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Incorrect code', message: e?.message || 'Please try again.' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-[#C9B896] bg-gradient-to-r from-[#F3EADC] to-[#F7F0E2] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[#C9B896] bg-white">
          <svg className="h-6 w-6 text-[#9A7545]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-[#3F2D19]">Confirm cash received</h3>
          <p className="mt-1 text-sm text-[#5E4426]">
            Sign off with the accounts clerk that you have received the cash. The clerk gets a one-time code; enter it
            here to record the hand-over for the finance department.
          </p>

          {isPendingLive ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-[#5E4426]">
                <span>A one-time code was sent to <strong>{confirmation?.clerkEmail}</strong>. Ask the clerk for it and enter it below.</span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs font-semibold ${remaining <= 60 ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-[#C9B896] bg-white text-[#5E4426]'}`}>
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Expires in {mmss}
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <input
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full sm:w-48 rounded-xl border border-[#C9B896] bg-white px-4 py-2.5 text-center text-lg tracking-[6px] font-semibold text-[#3F2D19] focus:outline-none focus:ring-2 focus:ring-[#9A7545]"
                  placeholder="------"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
                <Button variant="primary" onClick={verify} isLoading={verifying} disabled={verifying}>Confirm Receipt</Button>
                <button
                  type="button"
                  onClick={resend}
                  disabled={sending}
                  className="rounded-xl border border-[#C9B896] bg-white px-4 py-2 text-sm font-medium text-[#5E4426] hover:bg-[#F3EADC] disabled:opacity-50"
                >
                  {sending ? 'Resending…' : 'Resend code'}
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  disabled={cancelling}
                  className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling…' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : confirmation?.status === 'pending' ? (
            // Pending but the countdown reached zero — offer resend / change clerk.
            <div className="mt-4 space-y-3">
              <p className="text-sm text-rose-700">
                The code sent to <strong>{confirmation?.clerkEmail}</strong> has expired. Resend a new code or cancel to use a different clerk.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button variant="primary" onClick={resend} isLoading={sending} disabled={sending}>Resend Code</Button>
                <button
                  type="button"
                  onClick={cancel}
                  disabled={cancelling}
                  className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling…' : 'Cancel / change clerk'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                className="w-full rounded-xl border border-[#C9B896] bg-white px-4 py-2.5 text-sm text-[#3F2D19] focus:outline-none focus:ring-2 focus:ring-[#9A7545]"
                placeholder="Accounts clerk email"
                value={clerkEmail}
                onChange={(e) => setClerkEmail(e.target.value)}
              />
              <Button variant="primary" onClick={sendCode} isLoading={sending} disabled={sending} className="flex-shrink-0">
                Send Code to Clerk
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
