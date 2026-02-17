import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      // Get the public URL for the user's signature from storage bucket
      const { data } = supabaseAdmin.storage.from('signatures').getPublicUrl(`${userId}.png`);
      
      // Check if the signature actually exists by making a HEAD request
      const checkRes = await fetch(data.publicUrl, { method: 'HEAD' });
      
      if (checkRes.ok) {
        return res.status(200).json({ 
          signature_url: data.publicUrl
        });
      } else {
        return res.status(200).json({ signature_url: null });
      }
    } catch (error: any) {
      console.error('Signature fetch error:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
