import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { signatureExists, userSignaturePath, userSignatureProxyUrl } from '@/lib/signatureStorage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      // Private bucket: check existence via the service role, return proxy URL.
      const exists = await signatureExists(userSignaturePath(userId));
      return res.status(200).json({ signature_url: exists ? userSignatureProxyUrl(userId) : null });
    } catch (error: any) {
      console.error('Signature fetch error:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
