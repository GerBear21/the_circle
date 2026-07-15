/** @type {import('next').NextConfig} */

// next-auth v4 reads process.env.NEXTAUTH_URL at module-import time and passes it
// straight to `new URL()`. Its internal fallback only guards null/undefined, so an
// *empty-string* NEXTAUTH_URL (a blank Vercel env var) crashes `next build` during
// "Collecting page data" with `TypeError: Invalid URL, input: ''`. Normalize a
// blank value to unset so next-auth's own fallback (VERCEL_URL / localhost) applies.
// NOTE: this only prevents the build crash — production still needs a real
// NEXTAUTH_URL set for auth callbacks to target the correct domain at runtime.
if (typeof process.env.NEXTAUTH_URL === 'string' && process.env.NEXTAUTH_URL.trim() === '') {
  delete process.env.NEXTAUTH_URL;
}

const isProd = process.env.NODE_ENV === 'production';

// ---------------------------------------------------------------------------
// Content-Security-Policy
//
// Tuned to this stack:
//   - 'unsafe-inline' (script) — Next.js Pages Router injects inline bootstrap
//     scripts; 'unsafe-eval' — required by the dev/webpack runtime and pdf.js.
//   - 'unsafe-inline' (style) + fonts.googleapis.com — styled-components inject
//     inline styles, and globals.css @imports the Manrope font stylesheet.
//   - *.supabase.co (https + wss) — client SDK REST calls and realtime sockets.
//   - blob:/data: — generated PDFs, signature canvases, and the pdf.js worker.
//   - ui-avatars.com — generated initials avatars used as the fallback when a
//     user has no uploaded profile picture (img-src only).
// frame-ancestors 'none' blocks clickjacking (X-Frame-Options is kept as the
// legacy fallback). upgrade-insecure-requests is prod-only so local http dev
// is unaffected.
// ---------------------------------------------------------------------------
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co https://graph.microsoft.com https://ui-avatars.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://graph.microsoft.com",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  // Force HTTPS for two years incl. subdomains (prod only — never send over
  // plain-http local dev where it would be cached against localhost).
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // Disable powerful features the app never uses (WebAuthn / publickey-
  // credentials are intentionally left at their default 'self' allowance).
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // drop the X-Powered-By: Next.js fingerprint
  images: {
    domains: [
      'kidreqxqapouxndqomdp.supabase.co', // staging Supabase storage
      'rdrdsqkgbpfeixbzwmxb.supabase.co', // production Supabase storage
    ],
  },
  async headers() {
    return [
      {
        // Apply the security headers to every route.
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        // The standalone History & Archives page was merged into My Requests
        // (Requests + Archived Documents tabs). Keep old bookmarks working;
        // any ?tab= query is forwarded automatically.
        source: '/requests/history',
        destination: '/requests/my-requests',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
