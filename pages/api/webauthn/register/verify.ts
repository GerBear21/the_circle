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
import { audit } from '@/lib/auditLog';

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
  // constraint will catch accidental duplicate submissions. rp_id records the
  // domain the credential is bound to so authentication only offers passkeys
  // that can actually work in the current environment.
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
      rp_id: rpID,
    });

  if (insertError) {
    // Unique violation => this exact credential already exists. The ceremony
    // just proved the caller physically controls the authenticator (challenge
    // + user verification), so re-own the row: point it at the CURRENT user id
    // and reactivate it. This self-heals credentials orphaned by stale or
    // duplicate app_users rows (e.g. after a staging reseed), which previously
    // made registrations appear to "vanish" between logins.
    if ((insertError as any).code === '23505') {
      const { data: existingCred } = await supabaseAdmin
        .from('user_biometrics')
        .select('id, user_id, is_active')
        .eq('credential_id', credential.id)
        .maybeSingle();

      if (existingCred) {
        const reassigned = existingCred.user_id !== userId;
        const { error: reownError } = await supabaseAdmin
          .from('user_biometrics')
          .update({
            user_id: userId,
            is_active: true,
            counter: credential.counter,
            device_name: deviceName || defaultDeviceName(req),
            rp_id: rpID,
          })
          .eq('id', existingCred.id);

        if (reownError) {
          console.error('Failed to re-own biometric credential:', reownError);
          return res.status(500).json({ error: 'Failed to save credential' });
        }

        await audit(req, session.user, {
          category: 'security',
          action: 'security.device_registered',
          severity: 'notice',
          targetType: 'user',
          targetId: userId,
          details: {
            deviceName: deviceName || defaultDeviceName(req),
            duplicate: true,
            reassigned,
            previousUserId: reassigned ? existingCred.user_id : undefined,
          },
        });
      }

      return res.status(200).json({ success: true, duplicate: true });
    }
    console.error('Failed to persist biometric credential:', insertError);
    return res.status(500).json({ error: 'Failed to save credential' });
  }

  // Audit: a new device/passkey was registered for this user (security event).
  await audit(req, session.user, {
    category: 'security',
    action: 'security.device_registered',
    severity: 'notice',
    targetType: 'user',
    targetId: userId,
    details: {
      deviceName: deviceName || defaultDeviceName(req),
      deviceType: credentialDeviceType || null,
      backedUp: credentialBackedUp || false,
    },
  });

  return res.status(200).json({ success: true });
}

/**
 * Best-effort, identifiable device label derived from the user-agent so the
 * user can tell their registered devices apart in settings — e.g.
 * "Chrome · Windows" vs "Safari · iPhone". They can rename it later.
 *
 * We deliberately record BROWSER + OS/device (not just the biometric method)
 * so the label stays meaningful now that enrolment isn't limited to platform
 * authenticators (a passkey may live on a phone or security key).
 */
function defaultDeviceName(req: NextApiRequest): string {
  const ua = (req.headers['user-agent'] || '').toString();

  // Browser (order matters — Edge/Opera/Brave spoof Chrome, iOS spoofs Safari).
  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = 'Safari';

  // OS / device.
  let device = 'device';
  if (/iPhone/i.test(ua)) device = 'iPhone';
  else if (/iPad/i.test(ua)) device = 'iPad';
  else if (/Android/i.test(ua)) device = 'Android';
  else if (/Windows/i.test(ua)) device = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) device = 'Mac';
  else if (/Linux/i.test(ua)) device = 'Linux';

  return `${browser} · ${device}`;
}
