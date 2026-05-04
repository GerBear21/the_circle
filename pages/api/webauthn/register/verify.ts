/**
 * POST /api/webauthn/register/verify
 *
 * Phase 2 of registering a new biometric credential. Verifies the attestation
 * returned by navigator.credentials.create() against the challenge issued by
 * phase 1, then stores the public key in user_biometrics.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getRpConfig, consumeChallenge } from '@/lib/webauthn';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id as string;
  const { attestationResponse, deviceName } = req.body ?? {};

  if (!attestationResponse) {
    return res.status(400).json({ error: 'attestationResponse is required' });
  }

  const challengeRecord = await consumeChallenge({
    userId,
    ceremonyType: 'registration',
  });
  if (!challengeRecord) {
    return res.status(400).json({
      error: 'No active registration challenge — please retry.',
      code: 'NO_CHALLENGE',
    });
  }

  const { rpID, origin } = getRpConfig();

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: attestationResponse,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (err: any) {
    console.error('WebAuthn registration verification failed:', err);
    return res.status(400).json({ error: err?.message || 'Verification failed' });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ error: 'Registration could not be verified' });
  }

  const { credential, credentialBackedUp, credentialDeviceType, aaguid } =
    verification.registrationInfo;

  // Persist the credential. The credential_id is globally unique so a unique
  // constraint will catch accidental duplicate submissions.
  const { error: insertError } = await supabaseAdmin
    .from('user_biometrics')
    .insert({
      user_id: userId,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      device_name: deviceName || defaultDeviceName(req),
      transports: credential.transports || [],
      attachment: credentialDeviceType || null,
      aaguid: aaguid || null,
      backup_eligible: credentialBackedUp || false,
      backup_state: credentialBackedUp || false,
    });

  if (insertError) {
    // Unique violation => already registered; treat as success to keep the
    // UX idempotent (user re-ran ceremony on the same device).
    if ((insertError as any).code === '23505') {
      return res.status(200).json({ success: true, duplicate: true });
    }
    console.error('Failed to persist biometric credential:', insertError);
    return res.status(500).json({ error: 'Failed to save credential' });
  }

  return res.status(200).json({ success: true });
}

/**
 * Best-effort friendly device name derived from the user-agent so the user
 * can distinguish "Windows Hello on Work Laptop" from "Touch ID on Phone"
 * in settings. They can rename later.
 */
function defaultDeviceName(req: NextApiRequest): string {
  const ua = (req.headers['user-agent'] || '').toString();
  if (/Windows/i.test(ua)) return 'Windows Hello';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Touch ID / Mac';
  if (/iPhone|iPad/i.test(ua)) return 'Face ID / iPhone';
  if (/Android/i.test(ua)) return 'Android Biometrics';
  return 'Biometric Device';
}
