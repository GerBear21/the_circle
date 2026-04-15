import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import * as argon2 from 'argon2';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, userId, newPin } = req.body;

    if (!token || !userId || !newPin) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate PIN format
    if (!/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }

    // Hash the provided token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Fetch the user's reset token data
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('app_users')
      .select('pin_reset_token_hash, pin_reset_token_expires')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
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

    // Hash the new PIN using Argon2id
    const pinHash = await argon2.hash(newPin, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Update the user's PIN and clear the reset token
    const { error: updateError } = await supabaseAdmin
      .from('app_users')
      .update({
        approval_pin_hash: pinHash,
        pin_setup_completed: true,
        pin_last_changed: new Date().toISOString(),
        pin_reset_token_hash: null,
        pin_reset_token_expires: null,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error resetting PIN:', updateError);
      return res.status(500).json({ error: 'Failed to reset PIN' });
    }

    return res.status(200).json({ success: true, message: 'PIN reset successfully' });
  } catch (error: any) {
    console.error('PIN reset error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
