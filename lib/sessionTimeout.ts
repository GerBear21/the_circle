/**
 * Session timeout policy — single source of truth shared by the next-auth
 * config, the edge middleware and the client-side activity guard.
 *
 *  - IDLE: a session is terminated after this much inactivity. Any user
 *    activity rolls the window forward (the client refreshes the JWT, which
 *    re-issues its `exp`). This is enforced authoritatively by the JWT
 *    `maxAge` — once the cookie's `exp` passes, `getServerSession`/`getToken`
 *    return null and every protected API responds 401.
 *
 *  - ABSOLUTE: a hard ceiling measured from login. Even a continuously active
 *    user is forced to re-authenticate once this elapses. Enforced server-side
 *    in the middleware (via the `loginAt` claim) and surfaced to the client
 *    guard so the UX matches.
 *
 * Times are deliberately small (15 / 30 min) per the security requirement.
 */

export const IDLE_TIMEOUT_SECONDS = 15 * 60; // 15 minutes of inactivity
export const ABSOLUTE_TIMEOUT_SECONDS = 30 * 60; // 30 minutes from login

export const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_SECONDS * 1000;
export const ABSOLUTE_TIMEOUT_MS = ABSOLUTE_TIMEOUT_SECONDS * 1000;

/**
 * sessionStorage key set at sign-in. sessionStorage is wiped when the tab/page
 * is closed, so its absence on an authenticated load means the page was closed
 * and re-opened — the client guard then forces a fresh login.
 */
export const ACTIVE_SESSION_FLAG = 'the_circle_active_session';
