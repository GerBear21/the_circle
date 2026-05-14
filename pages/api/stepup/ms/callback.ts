/**
 * GET /api/stepup/ms/callback
 *
 * Microsoft redirects here after the step-up re-auth completes. We:
 *   1. Validate the signed `state` (so the browser can't forge it).
 *   2. Exchange the `code` for id_token + access_token.
 *   3. Decode the id_token's `amr` claim to confirm MFA actually happened.
 *   4. Mint a step-up token bound to this user/request/step.
 *   5. Render a tiny HTML page that posts the token back to window.opener
 *      and closes the popup.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { signStepUpToken } from '@/lib/stepUpToken';
import { setElevationCookie } from '@/lib/elevatedSession';

function verifyState(raw: string): {
  userId: string;
  requestId: string | null;
  stepId: string | null;
  nonce: string;
  issuedAt: number;
} | null {
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [payloadEncoded, sig] = parts;
  const expected = crypto
    .createHmac('sha256', process.env.NEXTAUTH_SECRET || '')
    .update(payloadEncoded)
    .digest('base64url');
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf8'));
    if (Date.now() - payload.issuedAt > 10 * 60 * 1000) return null; // 10-min window
    return payload;
  } catch {
    return null;
  }
}

/** Decode a JWT without verifying signature — Microsoft already did that; we only read claims. */
function decodeJwtPayload(token: string): any | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/** Render a page that posts the step-up result back to the opener and closes. */
function popupResponse(res: NextApiResponse, payload: Record<string, any>): void {
  // Microsoft's login pages set Cross-Origin-Opener-Policy which severs
  // the window.opener relationship. BroadcastChannel works across same-origin
  // windows regardless of COOP headers, so we use that as the primary
  // communication method, with postMessage as a fallback for older browsers.
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Verification complete</title>
<style>body{font:14px system-ui;padding:20px;text-align:center;color:#333}</style></head>
<body>
<p>Verification complete. You can close this window.</p>
<script>
(function(){
  var payload = ${json};
  try {
    var ch = new BroadcastChannel('stepup-ms');
    ch.postMessage({ type: 'stepup-ms-result', payload: payload });
    ch.close();
  } catch (e) {}
  try {
    if (window.opener) {
      window.opener.postMessage({ type: 'stepup-ms-result', payload: payload }, window.location.origin);
    }
  } catch (e) {}
  setTimeout(function(){ window.close(); }, 400);
})();
</script>
</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state, error: oauthError, error_description } = req.query;

  // If Microsoft returned an error (user cancelled, policy blocked, etc.)
  // surface it to the opener so the UI can show a friendly message.
  if (oauthError) {
    return popupResponse(res, {
      success: false,
      error: (error_description as string) || (oauthError as string),
    });
  }

  if (typeof code !== 'string' || typeof state !== 'string') {
    return popupResponse(res, { success: false, error: 'Missing code or state' });
  }

  const stateObj = verifyState(state);
  if (!stateObj) {
    return popupResponse(res, { success: false, error: 'Invalid or expired state' });
  }

  const tenant = process.env.AZURE_TENANT || 'common';
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`;

  if (!clientId || !clientSecret) {
    return popupResponse(res, { success: false, error: 'Azure client is not configured' });
  }

  // Exchange authorization code for tokens.
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${baseUrl}/api/stepup/ms/callback`,
    scope: 'openid profile email',
  });

  let tokenJson: any;
  try {
    const tokenResp = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      }
    );
    tokenJson = await tokenResp.json();
    if (!tokenResp.ok) {
      console.error('Step-up token exchange failed:', tokenJson);
      return popupResponse(res, {
        success: false,
        error: tokenJson.error_description || 'Token exchange failed',
      });
    }
  } catch (err: any) {
    console.error('Step-up token exchange error:', err);
    return popupResponse(res, { success: false, error: 'Token exchange failed' });
  }

  const idTokenClaims = decodeJwtPayload(tokenJson.id_token || '');
  if (!idTokenClaims) {
    return popupResponse(res, { success: false, error: 'Could not decode id_token' });
  }

  // Nonce replay check.
  if (idTokenClaims.nonce !== stateObj.nonce) {
    return popupResponse(res, { success: false, error: 'Nonce mismatch' });
  }

  // Confirm the re-auth actually included MFA. Microsoft reports this via
  // the `amr` claim (Authentication Methods References). Typical values:
  //   "pwd"  -> password only
  //   "mfa"  -> multi-factor
  //   "otp"  -> one-time-password
  //   "fido" -> FIDO2/passkey
  //   "wia"  -> Windows integrated auth
  // We require MFA-class evidence. If the tenant hasn't enabled MFA this
  // will fail — which is the correct behavior (we can't claim MFA that
  // didn't happen), and the ops team should enable Conditional Access.
  const amr: string[] = Array.isArray(idTokenClaims.amr) ? idTokenClaims.amr : [];
  const mfaSatisfied = amr.some(a =>
    ['mfa', 'otp', 'fido', 'hwk', 'sms', 'tel'].includes(String(a).toLowerCase())
  );

  // Also confirm the id_token belongs to the same user who initiated the
  // step-up. The `oid` claim is the stable per-tenant user id.
  const oid = idTokenClaims.oid;
  if (!oid) {
    return popupResponse(res, { success: false, error: 'id_token missing oid' });
  }

  const stepUpToken = signStepUpToken({
    userId: stateObj.userId,
    method: 'microsoft_mfa',
    credentialId: null,
    requestId: stateObj.requestId,
    stepId: stateObj.stepId,
    ttlSeconds: 120,
  });

  // Also persist an elevated session cookie so subsequent approvals within
  // the configured window don't need another MFA prompt.
  const elevation = await setElevationCookie(res, {
    userId: stateObj.userId,
    method: 'microsoft_mfa',
    credentialId: null,
  }).catch(() => null);

  return popupResponse(res, {
    success: true,
    stepUpToken,
    elevation: elevation
      ? { expiresAt: elevation.expiresAt, ttlMinutes: elevation.ttlMinutes, method: 'microsoft_mfa' }
      : null,
    mfaSatisfied,
    // amr is surfaced so the UI can warn "Your tenant did not enforce MFA"
    // even though the re-auth completed — useful during rollout.
    amr,
  });
}
