/**
 * WebAuthn helpers — shared config + challenge persistence.
 *
 * Relying Party (RP) configuration is derived from NEXTAUTH_URL so biometric
 * credentials registered in development don't accidentally work in production
 * and vice versa. RP ID MUST be the effective domain (no scheme / port) per
 * the WebAuthn spec.
 */

import { supabaseAdmin } from './supabaseAdmin';

export const RP_NAME = 'The Circle';

/**
 * Returns `{ rpID, origin }` derived from NEXTAUTH_URL (or a safe localhost
 * fallback during development). Callers should prefer this helper over
 * reading env vars inline so behavior stays consistent across endpoints.
 */
export function getRpConfig(): { rpID: string; origin: string } {
  const raw = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  try {
    const url = new URL(raw);
    return {
      // hostname drops port and scheme — exactly what RP ID requires.
      rpID: url.hostname,
      origin: url.origin,
    };
  } catch {
    return { rpID: 'localhost', origin: 'http://localhost:3000' };
  }
}

export type CeremonyType = 'registration' | 'authentication';

/**
 * Persist a server-issued challenge so the verify endpoint can look it up
 * without relying on in-memory state (Next.js API routes are stateless
 * across Lambda invocations).
 */
export async function storeChallenge(params: {
  userId: string;
  challenge: string;
  ceremonyType: CeremonyType;
  requestId?: string | null;
  stepId?: string | null;
  ttlSeconds?: number;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + (params.ttlSeconds ?? 300) * 1000);
  const { error } = await supabaseAdmin
    .from('webauthn_challenges')
    .insert({
      user_id: params.userId,
      challenge: params.challenge,
      ceremony_type: params.ceremonyType,
      request_id: params.requestId ?? null,
      step_id: params.stepId ?? null,
      expires_at: expiresAt.toISOString(),
    });
  if (error) {
    throw new Error(`Failed to store WebAuthn challenge: ${error.message}`);
  }
}

/**
 * Consume (fetch-and-delete) the most recent un-expired challenge of a given
 * ceremony type for a user. Consuming prevents replay of the same assertion.
 */
export async function consumeChallenge(params: {
  userId: string;
  ceremonyType: CeremonyType;
}): Promise<{ challenge: string; requestId: string | null; stepId: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .from('webauthn_challenges')
    .select('id, challenge, request_id, step_id')
    .eq('user_id', params.userId)
    .eq('ceremony_type', params.ceremonyType)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch WebAuthn challenge:', error);
    return null;
  }
  if (!data) return null;

  // Delete it so a second verify attempt with the same assertion fails.
  await supabaseAdmin.from('webauthn_challenges').delete().eq('id', data.id);

  return {
    challenge: data.challenge,
    requestId: data.request_id,
    stepId: data.step_id,
  };
}

/**
 * Return all active credentials for a user in the shape the
 * @simplewebauthn/server verifyAuthenticationResponse expects.
 */
export async function getUserCredentials(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_biometrics')
    .select('id, credential_id, public_key, counter, transports, device_name, created_at, last_used_at')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) {
    throw new Error(`Failed to fetch user credentials: ${error.message}`);
  }
  return data || [];
}
