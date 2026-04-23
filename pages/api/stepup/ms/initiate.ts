/**
 * POST /api/stepup/ms/initiate
 *
 * Begin a Microsoft Entra ID step-up authentication. Returns a URL the
 * browser should open in a popup. That popup hits Microsoft's authorize
 * endpoint with `prompt=login` so the user is forced to re-authenticate
 * (MFA enforced by the tenant's Conditional Access policies). When the
 * popup redirects back to /api/stepup/ms/callback we verify the id_token's
 * `amr` claim, mint a step-up token, and post it back to the opener.
 *
 * The short-lived `state` value is signed so the callback can reconstruct
 * the approval binding (requestId, stepId) without trusting the browser.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import crypto from 'crypto';
import { authOptions } from '../../auth/[...nextauth]';

interface StateParams {
  userId: string;
  requestId?: string | null;
  stepId?: string | null;
  nonce: string;
  issuedAt: number;
}

/** Sign a state payload with NEXTAUTH_SECRET so callback can't be spoofed. */
function signState(state: StateParams): string {
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', process.env.NEXTAUTH_SECRET || '')
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { requestId, stepId } = req.body ?? {};

  const tenant = process.env.AZURE_TENANT || 'common';
  const clientId = process.env.AZURE_CLIENT_ID;
  const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`;

  if (!clientId) {
    return res.status(500).json({ error: 'AZURE_CLIENT_ID is not configured' });
  }

  // Nonce is also bound into the OAuth nonce so we can detect replayed
  // id_tokens at callback time.
  const nonce = crypto.randomBytes(16).toString('base64url');
  const state: StateParams = {
    userId: session.user.id as string,
    requestId: requestId || null,
    stepId: stepId || null,
    nonce,
    issuedAt: Date.now(),
  };
  const signedState = signState(state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: `${baseUrl}/api/stepup/ms/callback`,
    response_mode: 'query',
    scope: 'openid profile email',
    // prompt=login forces a fresh primary-factor auth, which typically
    // triggers MFA per the tenant's Conditional Access policy.
    prompt: 'login',
    // login_hint makes the re-auth go to the same user — they shouldn't
    // need to pick an account or enter an email a second time.
    login_hint: (session.user.email as string) || '',
    // max_age=0 belts-and-braces: even if prompt is ignored, the IdP must
    // consider the authentication stale and re-prompt.
    max_age: '0',
    state: signedState,
    nonce,
  });

  const authorizeUrl =
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;

  return res.status(200).json({ url: authorizeUrl });
}
