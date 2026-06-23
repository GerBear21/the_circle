import { useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  IDLE_TIMEOUT_MS,
  ABSOLUTE_TIMEOUT_MS,
  ACTIVE_SESSION_FLAG,
} from '../lib/sessionTimeout';

// How often the watchdog checks the idle / absolute deadlines.
const CHECK_INTERVAL_MS = 15 * 1000;
// Minimum gap between server-side session refreshes triggered by activity.
const REFRESH_THROTTLE_MS = 60 * 1000;

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

/**
 * Client-side enforcement of the session policy (see lib/sessionTimeout.ts):
 *
 *   - Idle timeout (15 min): on user activity we refresh the next-auth session
 *     (throttled), which rolls the JWT `exp` forward. With no activity the
 *     token lapses server-side and the user is signed out.
 *   - Absolute timeout (30 min): a hard cap measured from `loginAt`; we sign
 *     the user out when it elapses regardless of activity.
 *   - Page-close termination: sessionStorage is wiped when the tab/page closes.
 *     If we load authenticated but the flag is gone, the page was re-opened on a
 *     surviving cookie — force a fresh login.
 *
 * Renders nothing.
 */
export default function SessionActivityGuard() {
  const { data: session, status, update } = useSession();
  const lastActivityRef = useRef<number>(Date.now());
  const lastRefreshRef = useRef<number>(0);
  const signingOutRef = useRef<boolean>(false);

  const loginAt = (session as any)?.loginAt as number | undefined;

  useEffect(() => {
    if (status !== 'authenticated') return;

    const endSession = (reason: string) => {
      if (signingOutRef.current) return;
      signingOutRef.current = true;
      try {
        sessionStorage.removeItem(ACTIVE_SESSION_FLAG);
      } catch {
        /* ignore */
      }
      // eslint-disable-next-line no-console
      console.info(`[session] signing out: ${reason}`);
      signOut({ callbackUrl: '/' });
    };

    // Page-close termination: authenticated cookie survived but the per-tab
    // flag did not ⇒ the page was closed and re-opened.
    let hasFlag = false;
    try {
      hasFlag = sessionStorage.getItem(ACTIVE_SESSION_FLAG) === '1';
    } catch {
      hasFlag = true; // if sessionStorage is unavailable, don't lock the user out
    }
    if (!hasFlag) {
      endSession('page reopened (sessionStorage flag missing)');
      return;
    }

    const markActivity = () => {
      lastActivityRef.current = Date.now();
      // Roll the server-side session forward, but no more than once a minute.
      const now = Date.now();
      if (now - lastRefreshRef.current > REFRESH_THROTTLE_MS) {
        lastRefreshRef.current = now;
        update();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') markActivity();
    };

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, markActivity, { passive: true })
    );
    document.addEventListener('visibilitychange', onVisibility);

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        endSession('idle timeout');
        return;
      }
      if (typeof loginAt === 'number' && now - loginAt >= ABSOLUTE_TIMEOUT_MS) {
        endSession('absolute timeout');
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
    };
  }, [status, loginAt, update]);

  return null;
}
