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

    // Validate PIN format - must be exactly 4 digits
    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }

    // Hash the PIN using Argon2id with secure parameters
    // Argon2id is resistant to both side-channel and GPU attacks
    const pinHash = await argon2.hash(pin, {
      type: argon2.argon2id,
      memoryCost: 65536,  // 64 MB memory
      timeCost: 3,        // 3 iterations
      parallelism: 4,     // 4 parallel threads
    });

    // Store the hash in the database
    const { error } = await supabaseAdmin
      .from('app_users')
      .update({
        approval_pin_hash: pinHash,
        pin_setup_completed: true,
        pin_last_changed: new Date().toISOString(),
      })
      .eq('id', session.user.id);

    if (error) {
      console.error('Error setting up PIN:', error);
      // Check if it's a column not found error (migration not run)
      if (error.message?.includes('column') || error.code === '42703') {
        return res.status(500).json({ 
          error: 'Database not configured. Please run the migration: add_approval_pin_to_app_users.sql',
          details: error.message 
        });
      }
      return res.status(500).json({ error: 'Failed to set up PIN', details: error.message });
    }

    return res.status(200).json({ success: true, message: 'PIN set up successfully' });
  } catch (error: any) {
    console.error('PIN setup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
