import { useState } from 'react';
import { createPortal } from 'react-dom';
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';

/**
 * BiometricSetupModal
 * -------------------
 * Lightweight enrollment UI for registering a platform authenticator
 * (Windows Hello / Touch ID / Face ID). Shown from settings AND on-demand
 * when a user hits a high-risk approval without a registered credential.
 *
 * Flow:
 *   1. POST /api/webauthn/register/options -> get challenge
 *   2. startRegistration() -> user does the biometric gesture
 *   3. POST /api/webauthn/register/verify -> server validates + stores public key
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** When true, the copy emphasises "required for high-risk approvals". */
  required?: boolean;
}

export default function BiometricSetupModal({ isOpen, onClose, onSuccess, required }: Props) {
  const [status, setStatus] = useState<'idle' | 'registering' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string>('');

  const supported = typeof window !== 'undefined' && browserSupportsWebAuthn();

  const handleRegister = async () => {
    setStatus('registering');
    setError(null);
    try {
      const optsRes = await fetch('/api/webauthn/register/options', { method: 'POST' });
      if (!optsRes.ok) {
        const err = await optsRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to start registration');
      }
      const options = await optsRes.json();

      let attestationResponse;
      try {
        attestationResponse = await startRegistration({ optionsJSON: options });
      } catch (err: any) {
        // User cancelled, device not available, or policy refused.
        throw new Error(
          err?.name === 'InvalidStateError'
            ? 'This device is already registered.'
            : err?.message || 'Biometric setup was cancelled.'
        );
      }

      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attestationResponse, deviceName: deviceName.trim() || undefined }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyJson.error || 'Registration could not be verified.');
      }

      setStatus('success');
      // Give the user a beat to read the success state, then close.
      setTimeout(() => {
        onSuccess();
        setStatus('idle');
      }, 800);
    } catch (err: any) {
      setStatus('error');
      setError(err?.message || 'Something went wrong.');
    }
  };

  if (!isOpen || typeof window === 'undefined') return null;

  const content = (
    <div className="fixed inset-0 z-[120] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={status === 'registering' ? undefined : onClose}
        aria-hidden="true"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-black/5">
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0-1.1.9-2 2-2s2 .9 2 2m-8 0c0-3.3 2.7-6 6-6s6 2.7 6 6v1c0 5-4 9-6 10-2-1-6-5-6-10v-1z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Set up biometric verification</h2>
            <p className="text-sm text-gray-500 mt-1">
              {required
                ? 'This approval requires biometric verification. Register this device once — future approvals will be a single touch.'
                : 'Use Windows Hello, Touch ID, or Face ID to approve high-risk requests quickly and securely.'}
            </p>
          </div>

          <div className="px-6 pb-4 space-y-3">
            {!supported && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                Biometrics aren't supported in this browser. You'll be able to approve with Microsoft verification instead.
              </div>
            )}
            {error && (
              <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
                {error}
              </div>
            )}
            {status === 'success' && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 text-center">
                Device registered successfully.
              </div>
            )}
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Device name (optional)</span>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. Work laptop"
                maxLength={60}
                disabled={status === 'registering' || status === 'success'}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </label>
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex gap-3">
            <button
              onClick={onClose}
              disabled={status === 'registering'}
              className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {required ? 'Skip' : 'Cancel'}
            </button>
            <button
              onClick={handleRegister}
              disabled={!supported || status === 'registering' || status === 'success'}
              className="flex-1 py-2.5 px-4 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {status === 'registering' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  Verifying...
                </>
              ) : (
                'Register device'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
