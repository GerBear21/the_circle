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

// 1) Neutralize blank URL-ish env vars so each library's own fallback applies.
//    Logs the offending keys — that names the Vercel var still needing a value.
try {
  const blanked = [];
  for (const key of Object.keys(process.env)) {
    if (key.includes('URL') && typeof process.env[key] === 'string' && process.env[key].trim() === '') {
      blanked.push(key);
      delete process.env[key];
    }
  }
  if (blanked.length) {
    console.warn('[build-url-guard] Neutralized blank URL env vars:', blanked.join(', '));
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
  class GuardedURL extends OriginalURL {
    constructor(input, base) {
      const blank = input === '' || input === undefined || input === null;
      if (blank && (base === undefined || base === null)) {
        if (!warned) {
          warned = true;
          console.warn(
            '[build-url-guard] new URL(' + JSON.stringify(input) +
            ') intercepted during build; using http://localhost:3000 fallback. Origin:\n' +
            new Error().stack
          );
        }
        super('http://localhost:3000');
        return;
      }
      super(input, base);
    }
  }
  global.URL = GuardedURL;
} catch (e) {
  console.warn('[build-url-guard] URL patch failed:', e && e.message);
}
