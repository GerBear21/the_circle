/**
 * POST /api/webauthn/authenticate/options
 *
 * Phase 1 of authenticating with a biometric credential (used for high-risk
 * approval step-up). Returns the challenge the authenticator must sign. The
 * caller may optionally scope the challenge to a (requestId, stepId) so the
 * verify endpoint can bind the assertion to a specific approval decision.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { authOptions } from '../../auth/[...nextauth]';
import { getRpConfig, storeChallenge, getUserCredentials } from '@/lib/webauthn';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id as string;
  const { requestId, stepId } = req.body ?? {};

  const credentials = await getUserCredentials(userId);
  if (credentials.length === 0) {
    return res.status(400).json({
      error: 'No biometric credentials registered',
      code: 'NO_CREDENTIALS',
    });
  }

  const { rpID } = getRpConfig();

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: credentials.map(c => ({
      id: c.credential_id,
      transports: (c.transports as any) || undefined,
    })),
  });

  await storeChallenge({
    userId,
    challenge: options.challenge,
    ceremonyType: 'authentication',
    requestId: requestId || null,
    stepId: stepId || null,
    ttlSeconds: 120, // step-up challenges are tighter than registration
  });

  return res.status(200).json(options);
}
