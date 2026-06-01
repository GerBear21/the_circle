/**
 * POST /api/webauthn/authenticate/verify
 *
 * Phase 2 of biometric step-up. Verifies an authenticator assertion against
 * the challenge issued by /options. On success we bump the counter (clone
 * detection) and issue a short-lived signed step-up token that the approval
 * endpoint accepts as proof the user completed biometric auth.
 *
 * The token is JWT-like: a payload signed with NEXTAUTH_SECRET. It binds
 * (userId, requestId, stepId, credentialId, expiresAt) so it can't be
 * replayed against a different approval.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import crypto from 'crypto';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getRpConfig, consumeChallenge } from '@/lib/webauthn';
import { signStepUpToken } from '@/lib/stepUpToken';
import { setElevationCookie } from '@/lib/elevatedSession';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id as string;
  const { assertionResponse } = req.body ?? {};

  if (!assertionResponse?.id) {
    return res.status(400).json({ error: 'assertionResponse is required' });
  }

  const challengeRecord = await consumeChallenge({
    userId,
    ceremonyType: 'authentication',
  });
  if (!challengeRecord) {
    return res.status(400).json({
      error: 'No active authentication challenge — please retry.',
      code: 'NO_CHALLENGE',
    });
  }

  // Look up the specific credential the authenticator claims to have used.
  const { data: credential, error: credError } = await supabaseAdmin
    .from('user_biometrics')
    .select('id, credential_id, public_key, counter, transports')
    .eq('user_id', userId)
    .eq('credential_id', assertionResponse.id)
    .eq('is_active', true)
    .maybeSingle();

  if (credError || !credential) {
    return res.status(400).json({ error: 'Unknown credential', code: 'UNKNOWN_CREDENTIAL' });
  }

  const { rpID, origin } = getRpConfig();

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: assertionResponse,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: credential.credential_id,
        publicKey: Buffer.from(credential.public_key, 'base64url'),
        counter: Number(credential.counter) || 0,
        transports: (credential.transports as any) || undefined,
      },
    });
  } catch (err: any) {
    console.error('WebAuthn authentication verification failed:', err);
    return res.status(400).json({ error: err?.message || 'Verification failed' });
  }

  if (!verification.verified) {
    return res.status(400).json({ error: 'Authentication could not be verified' });
  }

  // Update counter and last-used for clone detection / audit.
  const newCounter = verification.authenticationInfo.newCounter;
  await supabaseAdmin
    .from('user_biometrics')
    .update({
      counter: newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', credential.id);

  // Mint a short-lived step-up proof bound to this approval.
  const stepUpToken = signStepUpToken({
    userId,
    method: 'biometric',
    credentialId: credential.credential_id,
    requestId: challengeRecord.requestId,
    stepId: challengeRecord.stepId,
    ttlSeconds: 120,
  });

  // Persist an elevated session cookie — biometric auth grants the highest
  // tier, so subsequent medium/high-risk approvals can skip re-verification
  // for the configured window.
  const elevation = await setElevationCookie(res, {
    userId,
    method: 'biometric',
    credentialId: credential.credential_id,
  }).catch(() => null);

  return res.status(200).json({
    success: true,
    stepUpToken,
    credentialId: credential.credential_id,
    elevation: elevation
      ? { expiresAt: elevation.expiresAt, ttlMinutes: elevation.ttlMinutes, method: 'biometric' }
      : null,
  });
}
