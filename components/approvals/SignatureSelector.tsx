import { useEffect, useRef, useState } from 'react';
import type ReactSignatureCanvas from 'react-signature-canvas';

/**
 * SignatureSelector
 * -----------------
 * Compact tabbed control for choosing how to sign an approval. Three options:
 *
 *   - saved  -> use the user's pre-registered signature (default when available)
 *   - manual -> draw one right now on a canvas (accessibility: mouse / touch / stylus)
 *   - typed  -> type the user's name, rendered in a signature font (final fallback)
 *
 * The parent controls selection and supplies any ephemeral value (data URL for
 * manual, string for typed). This component doesn't submit anything — the
 * caller decides when to apply the chosen signature.
 */

// react-signature-canvas is client-only. We import it lazily inside useEffect
// so it never runs during SSR. Next.js dynamic() doesn't forward refs to class
// components, which breaks .isEmpty() / .clear() / .getTrimmedCanvas().

export type SignatureChoice = 'saved' | 'manual' | 'typed';

export interface SignatureSelection {
  type: SignatureChoice;
  /** Data URL for 'manual', literal string for 'typed', undefined for 'saved'. */
  data?: string;
}

interface Props {
  /** URL of the user's saved signature, if any. When absent, 'saved' is disabled. */
  savedSignatureUrl?: string | null;
  /** User's display name — pre-fills the typed fallback. */
  userDisplayName?: string | null;
  value: SignatureSelection;
  onChange: (selection: SignatureSelection) => void;
  disabled?: boolean;
}

export default function SignatureSelector({
  savedSignatureUrl,
  userDisplayName,
  value,
  onChange,
  disabled,
}: Props) {
  const canvasRef = useRef<ReactSignatureCanvas | null>(null);
  const [typed, setTyped] = useState<string>(value.type === 'typed' ? (value.data || '') : (userDisplayName || ''));
  const [SigCanvas, setSigCanvas] = useState<typeof ReactSignatureCanvas | null>(null);

  // Lazy-load react-signature-canvas on the client only.
  useEffect(() => {
    import('react-signature-canvas').then((mod) => {
      setSigCanvas(() => mod.default);
    });
  }, []);

  // If the user has no saved signature, auto-switch to manual the first time.
  useEffect(() => {
    if (!savedSignatureUrl && value.type === 'saved') {
      onChange({ type: 'manual' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSignatureUrl]);

  const handleTabChange = (choice: SignatureChoice) => {
    if (disabled) return;
    if (choice === 'saved') onChange({ type: 'saved' });
    if (choice === 'manual') onChange({ type: 'manual', data: value.type === 'manual' ? value.data : undefined });
    if (choice === 'typed') onChange({ type: 'typed', data: typed });
  };

  const handleCanvasEnd = () => {
    const sig = canvasRef.current;
    if (!sig) return;
    if (sig.isEmpty()) {
      onChange({ type: 'manual' });
      return;
    }
    // Use toDataURL directly from the signature_pad base class. The
    // getTrimmedCanvas() helper depends on 'trim-canvas' which has webpack
    // ESM compatibility issues — this avoids that dependency entirely.
    const dataUrl = sig.toDataURL('image/png');
    onChange({ type: 'manual', data: dataUrl });
  };

  const clearCanvas = () => {
    canvasRef.current?.clear();
    onChange({ type: 'manual' });
  };

  const handleTypedChange = (next: string) => {
    setTyped(next);
    onChange({ type: 'typed', data: next });
  };

  const TabButton = ({ choice, label, hint }: { choice: SignatureChoice; label: string; hint?: string }) => {
    const active = value.type === choice;
    const tabDisabled = disabled || (choice === 'saved' && !savedSignatureUrl);
    return (
      <button
        type="button"
        onClick={() => handleTabChange(choice)}
        disabled={tabDisabled}
        className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
          active
            ? 'bg-primary-600 text-white border-primary-600'
            : tabDisabled
            ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
        title={hint}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <TabButton
          choice="saved"
          label="Use saved"
          hint={savedSignatureUrl ? 'Use your registered signature' : 'No saved signature on file'}
        />
        <TabButton choice="manual" label="Draw" hint="Draw a new signature" />
        <TabButton choice="typed" label="Type" hint="Type your name as a signature" />
      </div>

      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 min-h-[140px]">
        {value.type === 'saved' && savedSignatureUrl && (
          <div className="flex items-center justify-center h-[120px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={savedSignatureUrl}
              alt="Your saved signature"
              className="max-h-[120px] max-w-full object-contain"
            />
          </div>
        )}

        {value.type === 'manual' && (
          <div>
            <div className="bg-white border border-dashed border-gray-300 rounded">
              {SigCanvas ? (
                <SigCanvas
                  ref={(ref: ReactSignatureCanvas | null) => { canvasRef.current = ref; }}
                  penColor="#111827"
                  canvasProps={{
                    width: 400,
                    height: 120,
                    className: 'w-full h-[120px] rounded',
                    style: { touchAction: 'none' },
                  }}
                  onEnd={handleCanvasEnd}
                />
              ) : (
                <div className="w-full h-[120px] flex items-center justify-center text-gray-400 text-sm">
                  Loading...
                </div>
              )}
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={clearCanvas}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {value.type === 'typed' && (
          <div className="space-y-2">
            <input
              type="text"
              value={typed}
              onChange={(e) => handleTypedChange(e.target.value)}
              placeholder="Type your full name"
              maxLength={80}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <div
              className="h-[70px] flex items-center justify-center bg-white border border-gray-200 rounded"
              style={{
                fontFamily: '"Dancing Script", "Segoe Script", "Brush Script MT", cursive',
                fontSize: '34px',
                color: '#111827',
              }}
            >
              {typed.trim() || <span className="text-gray-300 text-base font-sans">Your signature preview</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
