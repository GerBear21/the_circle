import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, userId } = req.body;

    if (!token || !userId) {
      return res.status(400).json({ error: 'Missing token or userId' });
    }

    // Hash the provided token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Fetch the user's reset token data
    const { data: user, error } = await supabaseAdmin
      .from('app_users')
      .select('pin_reset_token_hash, pin_reset_token_expires')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(400).json({ error: 'Invalid reset link' });
    }

    // Check if token matches
    if (user.pin_reset_token_hash !== tokenHash) {
      return res.status(400).json({ error: 'Invalid reset link' });
    }

    // Check if token has expired
    if (!user.pin_reset_token_expires || new Date(user.pin_reset_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    return res.status(200).json({ valid: true });
  } catch (error: any) {
    console.error('Token validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
