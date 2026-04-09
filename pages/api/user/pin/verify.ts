import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import * as argon2 from 'argon2';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { pin } = req.body;

    // Validate PIN format
    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }

    // Get the stored hash from the database
    const { data: user, error } = await supabaseAdmin
      .from('app_users')
      .select('approval_pin_hash, pin_setup_completed')
      .eq('id', session.user.id)
      .single();

    if (error || !user) {
      console.error('Error fetching user for PIN verification:', error);
      return res.status(500).json({ error: 'Failed to verify PIN' });
    }

    if (!user.pin_setup_completed || !user.approval_pin_hash) {
      return res.status(400).json({ error: 'PIN not set up', code: 'PIN_NOT_SETUP' });
    }

    // Verify the PIN using Argon2
    // This is a constant-time comparison to prevent timing attacks
    const isValid = await argon2.verify(user.approval_pin_hash, pin);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid PIN', code: 'INVALID_PIN' });
    }

    return res.status(200).json({ success: true, verified: true });
  } catch (error: any) {
    console.error('PIN verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
