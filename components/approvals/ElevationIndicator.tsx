import { useEffect, useState } from 'react';

/**
 * Subtle floating indicator showing the user's remaining elevated-session
 * window (after a successful MFA / biometric verification). Fetches the
 * current elevation state on mount and listens for the global custom
 * event `elevation-updated` so freshly-issued elevations show up
 * immediately without polling.
 */
export default function ElevationIndicator() {
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = () => {
    fetch('/api/auth/elevation')
      .then(r => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.elevated && typeof data.expiresAt === 'number') {
          setExpiresAt(data.expiresAt);
          setMethod(data.method || null);
        } else {
          setExpiresAt(null);
          setMethod(null);
        }
      })
      .catch(() => { /* silent — indicator is best-effort */ });
  };

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener('elevation-updated', onUpdate);
    return () => window.removeEventListener('elevation-updated', onUpdate);
  }, []);

  // 1Hz tick — only runs while an elevation is active.
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt) return null;
  const msLeft = expiresAt - now;
  if (msLeft <= 0) {
    // Expired locally — clear state so the indicator hides.
    if (expiresAt) setExpiresAt(null);
    return null;
  }

  const totalSec = Math.floor(msLeft / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  const label = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  const methodLabel = method === 'biometric' ? 'Biometric' : method === 'microsoft_mfa' ? 'Microsoft MFA' : 'Verified';

  return (
    <div
      className="fixed bottom-4 left-4 z-[90] flex items-center gap-2 px-3 py-2 rounded-full bg-emerald-50 border border-emerald-200 shadow-md text-emerald-800 text-xs font-medium"
      title={`Verified via ${methodLabel}. You can approve without re-authenticating until the timer runs out.`}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span>Verified</span>
      <span className="font-mono tabular-nums text-emerald-700">{label}</span>
    </div>
  );
}
