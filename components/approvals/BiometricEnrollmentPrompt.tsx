import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';

/**
 * BiometricEnrollmentPrompt
 * -------------------------
 * Proactive, dismissible nudge shown after login when the user has no
 * registered biometric device. Registration stays optional — "Not now"
 * snoozes the prompt for 7 days (per user, per browser) — but the prompt
 * explains why enrolling matters so users make an informed choice.
 *
 * The parent decides *when* the user is unenrolled (it already fetches
 * /api/webauthn/credentials) and supplies the registration action, so this
 * component stays purely presentational + snooze bookkeeping.
 */

const SNOOZE_DAYS = 7;
const storageKey = (userId: string) => `biometric-prompt-snoozed:${userId}`;

function isSnoozed(userId: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

function snooze(userId: string) {
  try {
    window.localStorage.setItem(
      storageKey(userId),
      String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000)
    );
  } catch {
    /* private mode — prompt will simply reappear next visit */
  }
}

interface Props {
  /** True once the parent has confirmed the user has NO registered device. */
  shouldPrompt: boolean;
  /** Opens the registration flow (BiometricSetupModal). */
  onRegister: () => void;
}

export default function BiometricEnrollmentPrompt({ shouldPrompt, onRegister }: Props) {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id as string | undefined;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shouldPrompt && userId && !isSnoozed(userId)) {
      setOpen(true);
    }
  }, [shouldPrompt, userId]);

  if (!open || typeof window === 'undefined') return null;

  const dismiss = () => {
    if (userId) snooze(userId);
    setOpen(false);
  };

  const register = () => {
    setOpen(false);
    onRegister();
  };

  const content = (
    <div className="fixed inset-0 z-[115] overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={dismiss} aria-hidden="true" />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-black/5">
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0-1.1.9-2 2-2s2 .9 2 2m-8 0c0-3.3 2.7-6 6-6s6 2.7 6 6v1c0 5-4 9-6 10-2-1-6-5-6-10v-1z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Secure your approvals with biometrics</h2>
            <p className="text-sm text-gray-500 mt-2">
              You haven&apos;t registered this device for biometric verification yet.
            </p>
          </div>

          <div className="px-6 pb-4">
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg text-left">
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Why it matters</p>
              <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                <li>High-value approvals require identity verification — a registered device lets you verify with a single touch instead of a Microsoft sign-in.</li>
                <li>It proves approvals came from <em>you</em>: your fingerprint or face never leaves this device, and every verification is recorded in the audit trail.</li>
                <li>It protects your account if your password or session is ever compromised.</li>
              </ul>
            </div>
            <p className="text-[11px] text-gray-400 mt-2 text-center">
              Optional — you can always register later from your Dashboard or Settings.
            </p>
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex gap-3">
            <button
              onClick={dismiss}
              className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
            >
              Not now
            </button>
            <button
              onClick={register}
              className="flex-1 py-2.5 px-4 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700"
            >
              Register this device
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
