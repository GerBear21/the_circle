/**
 * Step-up authentication tokens.
 *
 * When a user passes a step-up ceremony (WebAuthn biometric OR Microsoft MFA
 * re-auth) we mint a short-lived signed token that the approval endpoint
 * accepts as proof the ceremony happened. The token binds the user, the
 * auth method, and (optionally) the specific approval it was minted for
 * so it cannot be replayed against a different request.
 *
 * Format: base64url(JSON payload) + '.' + base64url(HMAC-SHA256 signature)
 * Signed with NEXTAUTH_SECRET — same secret the rest of the app trusts.
 */

import crypto from 'crypto';
import type { AuthenticationMethod } from './approvalRisk';

export interface StepUpPayload {
  userId: string;
  method: AuthenticationMethod;
  /** credential_id for biometric, or MS session id for microsoft_mfa. */
  credentialId?: string | null;
  requestId?: string | null;
  stepId?: string | null;
  issuedAt: number; // ms epoch
  expiresAt: number; // ms epoch
}

function getSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET is not configured');
  return s;
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf;
  return b.toString('base64url');
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

/**
 * Issue a step-up token. Default TTL is 120s — the UI should immediately
 * post the user's approval action; any longer and an attacker who grabs
 * the token from a compromised client could replay it.
 */
export function signStepUpToken(input: {
  userId: string;
  method: AuthenticationMethod;
  credentialId?: string | null;
  requestId?: string | null;
  stepId?: string | null;
  ttlSeconds?: number;
}): string {
  const now = Date.now();
  const payload: StepUpPayload = {
    userId: input.userId,
    method: input.method,
    credentialId: input.credentialId ?? null,
    requestId: input.requestId ?? null,
    stepId: input.stepId ?? null,
    issuedAt: now,
    expiresAt: now + (input.ttlSeconds ?? 120) * 1000,
  };

  const headerEncoded = b64url(JSON.stringify({ alg: 'HS256', typ: 'step-up' }));
  const payloadEncoded = b64url(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest();

  return `${headerEncoded}.${payloadEncoded}.${b64url(sig)}`;
}

/**
 * Verify a step-up token. Returns the payload if the signature is valid
 * and the token has not expired; null otherwise. Callers must additionally
 * check that (userId, requestId, stepId, method) match what they expect.
 */
export function verifyStepUpToken(token: string | null | undefined): StepUpPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerEncoded, payloadEncoded, sigEncoded] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSecret())
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest();
  const providedSig = fromB64url(sigEncoded);

  // Constant-time comparison to avoid signature leakage via timing.
  if (expectedSig.length !== providedSig.length) return null;
  if (!crypto.timingSafeEqual(expectedSig, providedSig)) return null;

  let payload: StepUpPayload;
  try {
    payload = JSON.parse(fromB64url(payloadEncoded).toString('utf8'));
  } catch {
    return null;
  }

  if (typeof payload.expiresAt !== 'number' || payload.expiresAt < Date.now()) {
    return null;
  }

  return payload;
}

/**
 * Verify the token AND check it matches the approval we're about to record.
 * Returns null for any mismatch so callers can fail-closed.
 */
export function verifyStepUpForApproval(
  token: string | null | undefined,
  expected: {
    userId: string;
    requestId: string;
    stepId: string;
    requiredMethod: AuthenticationMethod;
  }
): StepUpPayload | null {
  const payload = verifyStepUpToken(token);
  if (!payload) return null;
  if (payload.userId !== expected.userId) return null;

  // Bound tokens must match the approval; unbound tokens (no requestId) are
  // allowed as a "global" step-up proof within their TTL.
  if (payload.requestId && payload.requestId !== expected.requestId) return null;
  if (payload.stepId && payload.stepId !== expected.stepId) return null;

  // The claimed method must satisfy the requirement (rank-based).
  const rank = (m: AuthenticationMethod) =>
    m === 'biometric' ? 2 : m === 'microsoft_mfa' ? 1 : 0;
  if (rank(payload.method) < rank(expected.requiredMethod)) return null;

  return payload;
}
