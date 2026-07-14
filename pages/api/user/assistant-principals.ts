import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { getPrincipalsForAssistant } from '@/lib/assistantAssignments';

/**
 * The principals the signed-in user may file requests on behalf of (their
 * admin-assigned assistant relationships). Powers the "Filing on behalf of"
 * field, which hides itself when this list is empty.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const user = session.user as any;
  const organizationId = user.org_id;
  if (!organizationId) return res.status(400).json({ error: 'No organization found' });

  const principals = await getPrincipalsForAssistant(user.id, organizationId);
  return res.status(200).json({ principals });
}
