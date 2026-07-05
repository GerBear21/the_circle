/**
 * GET /api/webauthn/credentials
 *
 * List the current user's registered biometric credentials so they can
 * manage them from settings (rename, remove). Returns public metadata only
 * — the stored public key is never exposed to the client.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getRpConfig } from '@/lib/webauthn';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data, error } = await supabaseAdmin
    .from('user_biometrics')
    .select('id, device_name, transports, attachment, rp_id, created_at, last_used_at, is_active')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to list biometric credentials:', error);
    return res.status(500).json({ error: 'Failed to list credentials' });
  }

  // Flag which credentials can actually authenticate on THIS domain.
  // Passkeys are bound to the RP ID they were registered under, so one
  // registered on localhost/staging is listed but unusable in production.
  // NULL rp_id = legacy row (assumed usable).
  const { rpID } = getRpConfig();
  const credentials = (data || []).map((c) => ({
    ...c,
    usable_here: c.rp_id === null || c.rp_id === rpID,
  }));

  return res.status(200).json({ credentials, rpId: rpID });
}
