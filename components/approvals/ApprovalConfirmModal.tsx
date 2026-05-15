import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import type { ApprovalRisk, AuthenticationMethod } from '@/lib/approvalRisk';
import BiometricSetupModal from './BiometricSetupModal';

/**
 * ApprovalConfirmModal
 * --------------------
 * Single entry point for confirming an approval. Given the evaluated risk
 * level (already known at render time because the parent called
 * getApprovalRisk), it orchestrates the right ceremony:
 *
 *   low    -> one-click "Confirm approval"
 *   medium -> open a popup to /api/stepup/ms/initiate, wait for postMessage
 *   high   -> WebAuthn biometric; if no credentials registered, offer setup
 *             OR fall back to Microsoft MFA (for inclusivity)
 *
 * On success the modal invokes `onConfirmed({ stepUpToken, authMethod })`.
 * The parent is responsible for POSTing to /api/approvals/action with that
 * payload — this component deliberately stays UI-only so it works for both
 * /requests/[id] and /requests/comp/[id] without duplicating network logic.
 */

export type ApprovalConfirmResult = {
  stepUpToken: string | null; // null is valid for low-risk (session is enough)
  authMethod: AuthenticationMethod;
  /**
   * Elevation info reported back to the parent so it can show the
   * "verified for the next N minutes" toast + countdown after a successful
   * ceremony, OR confirm that an existing elevation was reused (no toast).
   */
  elevation?: {
    expiresAt: number;
    ttlMinutes: number;
    reused: boolean;
  } | null;
};

interface Props {
  isOpen: boolean;
  risk: ApprovalRisk;
  action: 'approve' | 'reject';
  requestId: string;
  stepId: string;
  /** Whether the current user has at least one registered biometric credential. */
  hasBiometric: boolean;
  /** Reason strings from getApprovalRisk().reasons — shown as an advisory caption. */
  riskReasons?: string[];
  onConfirmed: (result: ApprovalConfirmResult) => void | Promise<void>;
  onCancel: () => void;
  /** Disable actions while the parent is still processing the final submission. */
  busy?: boolean;
}

export default function ApprovalConfirmModal({
  isOpen,
  risk,
  action,
  requestId,
  stepId,
  hasBiometric,
  riskReasons,
  onConfirmed,
  onCancel,
  busy,
}: Props) {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [userHasBiometric, setUserHasBiometric] = useState(hasBiometric);
  const [elevation, setElevation] = useState<{ method: AuthenticationMethod; expiresAt: number } | null>(null);
  const [elevationChecked, setElevationChecked] = useState(false);
  const popupRef = useRef<Window | null>(null);

  // Required auth rank for the current risk bucket.
  const requiredRank = risk === 'high' ? 2 : risk === 'medium' ? 1 : 0;
  const methodRank = (m: AuthenticationMethod) =>
    m === 'biometric' ? 2 : m === 'microsoft_mfa' ? 1 : 0;
  // Mirror server inclusivity: biometric is preferred for HIGH risk, but a
  // microsoft_mfa elevation is an acceptable fallback (see action.ts).
  const elevationSatisfies = !!elevation && (
    methodRank(elevation.method) >= requiredRank ||
    (requiredRank === 2 && methodRank(elevation.method) >= 1)
  );

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setVerifying(false);
      setUserHasBiometric(hasBiometric);
      setElevationChecked(false);
      setElevation(null);

      // Pre-check elevation. If the user already has a valid elevated session
      // covering this risk level we skip the ceremony entirely.
      if (risk !== 'low') {
        fetch('/api/auth/elevation')
          .then(r => r.ok ? r.json() : null)
          .then((data) => {
            if (data?.elevated && typeof data.expiresAt === 'number') {
              setElevation({ method: data.method, expiresAt: data.expiresAt });
            }
          })
          .catch(() => { /* fail open — user runs ceremony */ })
          .finally(() => setElevationChecked(true));
      } else {
        setElevationChecked(true);
      }

      // Always re-probe biometric registration when the modal opens for
      // high-risk approvals. Otherwise we may show "register" to a user
      // who already has a credential (the parent's `hasBiometric` prop is
      // not always populated — e.g. when the parent's gated-flow handler
      // opens this modal before the parent has fetched credentials).
      if (risk === 'high') {
        fetch('/api/webauthn/credentials')
          .then(r => r.ok ? r.json() : null)
          .then((data) => {
            const has = (data?.credentials || []).some((c: any) => c.is_active);
            if (has) setUserHasBiometric(true);
          })
          .catch(() => { /* fall back to the prop */ });
      }
    }
  }, [isOpen, hasBiometric, risk]);

  // Close any open popup if the modal itself is dismissed.
  useEffect(() => {
    if (!isOpen && popupRef.current) {
      try { popupRef.current.close(); } catch (_) {}
      popupRef.current = null;
    }
  }, [isOpen]);

  // ------------------------------------------------------------------
  // LOW risk: one-click confirmation, no extra ceremony.
  // ------------------------------------------------------------------
  const handleLowConfirm = async () => {
    await onConfirmed({ stepUpToken: null, authMethod: 'session', elevation: null });
  };

  // ------------------------------------------------------------------
  // Reuse existing elevation: skip the ceremony, server will validate
  // the elevation cookie at /api/approvals/action.
  // ------------------------------------------------------------------
  const handleReuseElevation = async () => {
    if (!elevation) return;
    await onConfirmed({
      stepUpToken: null,
      authMethod: elevation.method,
      elevation: { expiresAt: elevation.expiresAt, ttlMinutes: 0, reused: true },
    });
  };

  // ------------------------------------------------------------------
  // MEDIUM risk: Microsoft step-up in a popup.
  // ------------------------------------------------------------------
  const handleMicrosoftStepUp = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/stepup/ms/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, stepId }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        throw new Error(json.error || 'Could not start Microsoft verification');
      }

      const popup = window.open(json.url, 'ms-stepup', 'width=520,height=640');
      popupRef.current = popup;
      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      const result = await new Promise<ApprovalConfirmResult>((resolve, reject) => {
        let channel: BroadcastChannel | null = null;
        let timeoutId: ReturnType<typeof setTimeout>;
        let closedPoll: ReturnType<typeof setInterval>;
        let settled = false;
        const cleanup = () => {
          if (settled) return;
          settled = true;
          window.removeEventListener('message', handler);
          clearTimeout(timeoutId);
          clearInterval(closedPoll);
          try { channel?.close(); } catch (_) {}
        };
        const onResult = (payload: any) => {
          cleanup();
          try { popup.close(); } catch (_) {}
          if (payload.success && payload.stepUpToken) {
            resolve({
              stepUpToken: payload.stepUpToken,
              authMethod: 'microsoft_mfa',
              elevation: payload.elevation
                ? { expiresAt: payload.elevation.expiresAt, ttlMinutes: payload.elevation.ttlMinutes, reused: false }
                : null,
            });
          } else {
            reject(new Error(payload.error || 'Microsoft verification failed'));
          }
        };
        // Primary: BroadcastChannel (works even when COOP severs window.opener)
        try {
          channel = new BroadcastChannel('stepup-ms');
          channel.onmessage = (event) => {
            if (event.data?.type === 'stepup-ms-result') {
              onResult(event.data.payload || {});
            }
          };
        } catch (_) {}
        // Fallback: postMessage (for browsers without BroadcastChannel)
        const handler = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          if (event.data?.type !== 'stepup-ms-result') return;
          onResult(event.data.payload || {});
        };
        window.addEventListener('message', handler);
        // Poll popup.closed so we don't get stuck "Verifying…" when the user
        // closes the Microsoft window before completing the ceremony. COOP can
        // make this property momentarily unreadable while on the MS origin —
        // we wrap in try/catch and only act on a definite `true`.
        closedPoll = setInterval(() => {
          let isClosed = false;
          try { isClosed = popup.closed; } catch (_) { /* COOP — ignore */ }
          if (isClosed) {
            cleanup();
            reject(new Error('Verification window was closed before completing. Please try again.'));
          }
        }, 600);
        timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error('Verification timed out. Please try again.'));
        }, 5 * 60 * 1000);
      });

      await onConfirmed(result);
    } catch (err: any) {
      setError(err?.message || 'Microsoft verification failed');
    } finally {
      setVerifying(false);
      popupRef.current = null;
    }
  };

  // ------------------------------------------------------------------
  // HIGH risk: WebAuthn biometric. Fallback: MS MFA.
  // ------------------------------------------------------------------
  const handleBiometric = async () => {
    setVerifying(true);
    setError(null);
    try {
      if (!browserSupportsWebAuthn()) {
        // Fall back without user action — inclusivity.
        await handleMicrosoftStepUp();
        return;
      }

      const optsRes = await fetch('/api/webauthn/authenticate/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, stepId }),
      });
      if (!optsRes.ok) {
        const err = await optsRes.json().catch(() => ({}));
        if (err.code === 'NO_CREDENTIALS') {
          // No registered credentials — ask the user to set one up now.
          setShowBiometricSetup(true);
          setVerifying(false);
          return;
        }
        throw new Error(err.error || 'Could not start biometric verification');
      }
      const options = await optsRes.json();

      let assertionResponse;
      try {
        assertionResponse = await startAuthentication({ optionsJSON: options });
      } catch (err: any) {
        throw new Error(err?.message || 'Biometric verification was cancelled');
      }

      const verifyRes = await fetch('/api/webauthn/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assertionResponse }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson.stepUpToken) {
        throw new Error(verifyJson.error || 'Biometric verification failed');
      }

      await onConfirmed({
        stepUpToken: verifyJson.stepUpToken,
        authMethod: 'biometric',
        elevation: verifyJson.elevation
          ? { expiresAt: verifyJson.elevation.expiresAt, ttlMinutes: verifyJson.elevation.ttlMinutes, reused: false }
          : null,
      });
    } catch (err: any) {
      setError(err?.message || 'Biometric verification failed');
    } finally {
      setVerifying(false);
    }
  };

  // Handler after the user successfully sets up a new biometric credential.
  const onBiometricSetupDone = () => {
    setShowBiometricSetup(false);
    setUserHasBiometric(true);
    // Kick straight into the authentication ceremony so the user doesn't
    // have to tap approve twice.
    setTimeout(() => handleBiometric(), 100);
  };

  if (!isOpen || typeof window === 'undefined') return null;

  // ------------------------------------------------------------------
  // Copy for each risk bucket. Kept plain-language per UI/UX goals.
  // ------------------------------------------------------------------
  const actionVerb = action === 'approve' ? 'Approve' : 'Reject';
  const colorClass = action === 'approve' ? 'bg-primary-600 hover:bg-primary-700' : 'bg-danger-600 hover:bg-danger-700';

  const headerIcon = (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {risk === 'high' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0-1.1.9-2 2-2s2 .9 2 2m-8 0c0-3.3 2.7-6 6-6s6 2.7 6 6v1c0 5-4 9-6 10-2-1-6-5-6-10v-1z" />
      ) : risk === 'medium' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      )}
    </svg>
  );

  const title =
    elevationSatisfies ? `Confirm ${action === 'approve' ? 'approval' : 'rejection'}` :
    risk === 'high' ? 'Biometric verification required' :
    risk === 'medium' ? 'Microsoft verification required' :
    `Confirm ${action === 'approve' ? 'approval' : 'rejection'}`;

  const elevationMinutesLeft = elevation
    ? Math.max(0, Math.ceil((elevation.expiresAt - Date.now()) / 60000))
    : 0;

  const description =
    elevationSatisfies
      ? `You're already verified for the next ${elevationMinutesLeft} minute${elevationMinutesLeft === 1 ? '' : 's'}. No re-authentication needed.` :
    risk === 'high' ? 'This is a sensitive approval. Please verify with Windows Hello, Touch ID, or Face ID.' :
    risk === 'medium' ? 'We\'ll quickly re-verify you with Microsoft before recording this decision.' :
    `You are about to ${action} this request. This action will be recorded with your signature.`;

  const primaryLabel =
    elevationSatisfies ? `${actionVerb} now` :
    risk === 'high' ? 'Verify with biometrics' :
    risk === 'medium' ? 'Continue with Microsoft' :
    `${actionVerb} now`;

  // For HIGH risk we always start the WebAuthn ceremony; the options endpoint
  // is authoritative on whether the user has credentials, and handleBiometric
  // already routes to BiometricSetupModal on NO_CREDENTIALS. Don't pre-judge
  // off the (possibly stale) `userHasBiometric` flag — that misroutes users
  // with registered passkeys to the registration screen.
  const onPrimary =
    elevationSatisfies ? handleReuseElevation :
    risk === 'high'
      ? handleBiometric
      : risk === 'medium'
      ? handleMicrosoftStepUp
      : handleLowConfirm;

  const content = (
    <div className="fixed inset-0 z-[110] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={verifying || busy ? undefined : onCancel}
        aria-hidden="true"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-black/5">
          <div className="p-6 text-center">
            <div className={`w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center ${
              risk === 'high' ? 'bg-amber-100 text-amber-600'
              : risk === 'medium' ? 'bg-blue-100 text-blue-600'
              : 'bg-emerald-100 text-emerald-600'
            }`}>
              {headerIcon}
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </div>

          {(riskReasons?.length || 0) > 0 && risk !== 'low' && (
            <div className="px-6 pb-2">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
                <div className="font-medium text-gray-700 mb-1">Why this verification?</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {riskReasons!.slice(0, 3).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {error && (
            <div className="px-6 pb-2">
              <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
                {error}
              </div>
            </div>
          )}

          {/* Always offer both verification methods when verification is needed.
              The primary button defaults to the recommended method for the risk
              level, but the user can always pick the other. */}
          {risk !== 'low' && !verifying && !elevationSatisfies && (
            <div className="px-6 pb-2 text-center">
              <button
                type="button"
                onClick={risk === 'high' ? handleMicrosoftStepUp : handleBiometric}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                {risk === 'high'
                  ? "Can't use biometrics? Verify with Microsoft instead."
                  : 'Prefer biometrics? Verify with Touch ID / Windows Hello.'}
              </button>
            </div>
          )}

          <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex gap-3">
            <button
              onClick={onCancel}
              disabled={verifying || busy}
              className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onPrimary}
              disabled={verifying || busy || (risk !== 'low' && !elevationChecked)}
              className={`flex-1 py-2.5 px-4 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed ${
                risk === 'low' ? colorClass : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {verifying || busy ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  Verifying...
                </>
              ) : (
                primaryLabel
              )}
            </button>
          </div>
        </div>
      </div>

      <BiometricSetupModal
        isOpen={showBiometricSetup}
        onClose={() => setShowBiometricSetup(false)}
        onSuccess={onBiometricSetupDone}
        required
      />
    </div>
  );

  return createPortal(content, document.body);
}
