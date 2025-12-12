import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = (session.user as any).id;

    if (!userId) {
      return res.status(400).json({ error: 'User ID not found' });
    }

    // Check if signature file exists in storage
    const { data, error } = await supabaseAdmin.storage
      .from('signatures')
      .list('', {
        limit: 1,
        search: `${userId}.png`,
      });

    if (error) {
      console.error('Storage list error:', error);
      return res.status(500).json({ error: 'Failed to check signature' });
    }

    const hasSignature = data && data.length > 0 && data.some(file => file.name === `${userId}.png`);

    if (hasSignature) {
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('signatures')
        .getPublicUrl(`${userId}.png`);

      return res.status(200).json({ hasSignature: true, signatureUrl: publicUrl });
    }

    return res.status(200).json({ hasSignature: false, signatureUrl: null });
  } catch (error) {
    console.error('Has signature check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
