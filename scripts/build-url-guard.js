'use strict';
/*
 * Build-time hardening against BLANK (empty-string) URL environment variables.
 *
 * A Vercel env var saved with no value comes through as "" (not undefined).
 * Libraries that do `new URL(process.env.X)` then crash `next build` during
 * "Collecting page data" with `TypeError: Invalid URL, input: ''`. The main
 * offender is next-auth v4: it reads NEXTAUTH_URL and NEXTAUTH_URL_INTERNAL at
 * import time and its fallback only guards null/undefined — an empty string
 * slips straight through to new URL('').
 *
 * This file is loaded as a Node --require preload (see .github/workflows/ci-cd.yml)
 * AND from next.config.js, so it runs in every build process, including the
 * page-data worker threads that next build spawns.
 *
 * Build-time only. Production still needs real URL values in Vercel for correct
 * runtime behavior (auth callback origins, etc.).
 */

// A URL env var is "unusable" for build purposes if it is blank OR is a bare
// protocol with no host (e.g. "https://", "https:// ", "http://"). Both make
// `new URL(value)` throw during `next build` → the whole build fails.
function isUnusableUrlValue(v) {
  if (typeof v !== 'string') return false;
  const t = v.trim();
  return t === '' || /^https?:\/\/$/i.test(t);
}

// 1) Neutralize blank / protocol-only URL-ish env vars so each library's own
//    fallback applies. Logs the offending keys — that names the Vercel var
//    still needing a real value.
try {
  const blanked = [];
  for (const key of Object.keys(process.env)) {
    if (key.includes('URL') && isUnusableUrlValue(process.env[key])) {
      blanked.push(key);
      delete process.env[key];
    }
  }
  if (blanked.length) {
    console.warn('[build-url-guard] Neutralized blank/protocol-only URL env vars:', blanked.join(', '));
  } else {
    console.warn('[build-url-guard] No blank URL env vars found.');
  }
} catch (e) {
  console.warn('[build-url-guard] env scan failed:', e && e.message);
}

// 2) Last-resort net: make `new URL('')` / `new URL(null/undefined)` resolve to a
//    localhost default instead of throwing, and log the first call site so the
//    real source is identifiable. Only empty/nullish inputs with no base are
//    affected; every valid URL behaves exactly as before.
try {
  const OriginalURL = global.URL;
  let warned = false;
  const warnOnce = (input, reason) => {
    if (warned) return;
    warned = true;
    console.warn(
      '[build-url-guard] new URL(' + JSON.stringify(input) +
      ') ' + reason + ' during build; using http://localhost:3000 fallback. Origin:\n' +
      new Error().stack
    );
  };
  class GuardedURL extends OriginalURL {
    constructor(input, base) {
      const noBase = base === undefined || base === null;
      const blank = input === '' || input === undefined || input === null;
      if (blank && noBase) {
        warnOnce(input, 'intercepted (blank)');
        super('http://localhost:3000');
        return;
      }
      try {
        super(input, base);
      } catch (err) {
        // A malformed URL from a mis-set build env var (e.g. "https://" or
        // "https://<garbage>") must never crash `next build`. With no base to
        // resolve against, fall back to localhost. Build-time only — real
        // runtime values on Vercel are used directly, not through this guard.
        if (noBase) {
          warnOnce(input, 'was invalid');
          super('http://localhost:3000');
          return;
        }
        throw err;
      }
    }
  }
  global.URL = GuardedURL;
} catch (e) {
  console.warn('[build-url-guard] URL patch failed:', e && e.message);
}
