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

    const { currentPin, newPin } = req.body;

    // Validate PIN formats
    if (!currentPin || !/^\d{4}$/.test(currentPin)) {
      return res.status(400).json({ error: 'Current PIN must be exactly 4 digits' });
    }
    if (!newPin || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ error: 'New PIN must be exactly 4 digits' });
    }

    // Get the stored hash from the database
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('app_users')
      .select('approval_pin_hash, pin_setup_completed')
      .eq('id', session.user.id)
      .single();

    if (fetchError || !user) {
      console.error('Error fetching user for PIN change:', fetchError);
      return res.status(500).json({ error: 'Failed to change PIN' });
    }

    if (!user.pin_setup_completed || !user.approval_pin_hash) {
      return res.status(400).json({ error: 'PIN not set up yet', code: 'PIN_NOT_SETUP' });
    }

    // Verify current PIN
    const isCurrentValid = await argon2.verify(user.approval_pin_hash, currentPin);
    if (!isCurrentValid) {
      return res.status(401).json({ error: 'Current PIN is incorrect', code: 'INVALID_PIN' });
    }

    // Hash the new PIN
    const newPinHash = await argon2.hash(newPin, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Update the PIN hash
    const { error: updateError } = await supabaseAdmin
      .from('app_users')
      .update({
        approval_pin_hash: newPinHash,
        pin_last_changed: new Date().toISOString(),
      })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Error updating PIN:', updateError);
      return res.status(500).json({ error: 'Failed to change PIN' });
    }

    return res.status(200).json({ success: true, message: 'PIN changed successfully' });
  } catch (error: any) {
    console.error('PIN change error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
