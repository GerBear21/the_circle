/**
 * DELETE /api/webauthn/credentials/[id]
 * PATCH  /api/webauthn/credentials/[id]   { deviceName: string }
 *
 * Remove or rename a registered biometric credential. Only the credential's
 * owner can modify it — enforced by matching user_id against the session.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'Credential id is required' });
  }

  const userId = session.user.id as string;

  if (req.method === 'DELETE') {
    const { error } = await supabaseAdmin
      .from('user_biometrics')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // scope to owner
    if (error) {
      console.error('Failed to delete credential:', error);
      return res.status(500).json({ error: 'Failed to delete credential' });
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PATCH') {
    const { deviceName } = req.body ?? {};
    if (!deviceName || typeof deviceName !== 'string') {
      return res.status(400).json({ error: 'deviceName is required' });
    }
    const { error } = await supabaseAdmin
      .from('user_biometrics')
      .update({ device_name: deviceName.trim().slice(0, 80) })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) {
      console.error('Failed to rename credential:', error);
      return res.status(500).json({ error: 'Failed to rename credential' });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
