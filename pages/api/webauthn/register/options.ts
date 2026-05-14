/**
 * POST /api/webauthn/register/options
 *
 * Phase 1 of registering a new biometric credential. Returns the public
 * options the browser passes to navigator.credentials.create(). The server
 * also persists the challenge so phase 2 (/verify) can validate the
 * authenticator's response against the exact challenge it issued.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getRpConfig, RP_NAME, storeChallenge, getUserCredentials } from '@/lib/webauthn';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id as string;

  // Fetch user details so we can populate the authenticator's friendly name.
  const { data: user } = await supabaseAdmin
    .from('app_users')
    .select('email, display_name')
    .eq('id', userId)
    .single();

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Existing credentials are excluded from the allow-list so the browser
  // doesn't prompt the user to re-register the same authenticator.
  const existing = await getUserCredentials(userId);

  const { rpID } = getRpConfig();

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: user.email || userId,
    userDisplayName: user.display_name || user.email || 'User',
    // userID must be a Uint8Array<ArrayBuffer>; Buffer.from gives us a concrete
    // ArrayBuffer-backed view (TextEncoder.encode returns ArrayBufferLike, which
    // TS 5.7+ no longer accepts for SimpleWebAuthn's stricter signature).
    userID: Buffer.from(userId, 'utf-8'),
    attestationType: 'none', // we don't need attestation for internal use
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required', // must prove user presence + verification (biometric/PIN)
      authenticatorAttachment: 'platform', // prefer built-in (Windows Hello / Touch ID / Face ID)
    },
    excludeCredentials: existing.map(c => ({
      id: c.credential_id,
      transports: (c.transports as any) || undefined,
    })),
  });

  await storeChallenge({
    userId,
    challenge: options.challenge,
    ceremonyType: 'registration',
  });

  return res.status(200).json(options);
}
