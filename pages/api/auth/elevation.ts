/**
 * GET  /api/auth/elevation — return the current elevation state for the
 *                            signed-in user. Used by the approval UI to
 *                            decide whether to skip the step-up ceremony.
 * DELETE /api/auth/elevation — explicitly drop the elevation cookie
 *                              (e.g. on user-initiated "lock" action).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './[...nextauth]';
import {
  verifyElevationCookie,
  clearElevationCookie,
  getElevationTtlMinutes,
} from '@/lib/elevatedSession';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = session.user.id as string;

  if (req.method === 'DELETE') {
    clearElevationCookie(res);
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = verifyElevationCookie(req, userId);
  if (!payload) {
    // Clear any stale cookie so the client gets a clean state.
    if (req.headers.cookie?.includes('elevation_session=')) {
      clearElevationCookie(res);
    }
    const ttlMinutes = await getElevationTtlMinutes(userId);
    return res.status(200).json({
      elevated: false,
      method: null,
      expiresAt: null,
      ttlMinutes,
    });
  }

  const ttlMinutes = await getElevationTtlMinutes(userId);
  return res.status(200).json({
    elevated: true,
    method: payload.method,
    expiresAt: payload.expiresAt,
    issuedAt: payload.issuedAt,
    ttlMinutes,
  });
}
