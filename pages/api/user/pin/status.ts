import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get PIN setup status from the database
    const { data: user, error } = await supabaseAdmin
      .from('app_users')
      .select('pin_setup_completed, pin_last_changed')
      .eq('id', session.user.id)
      .single();

    if (error || !user) {
      console.error('Error fetching PIN status:', error);
      return res.status(500).json({ error: 'Failed to get PIN status' });
    }

    return res.status(200).json({
      pinSetupCompleted: user.pin_setup_completed || false,
      pinLastChanged: user.pin_last_changed,
    });
  } catch (error: any) {
    console.error('PIN status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
