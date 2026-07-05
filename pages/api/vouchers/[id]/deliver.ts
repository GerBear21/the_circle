import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getUserRBACProfile, hasPermission, PERMISSIONS } from '@/lib/rbac';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;
    const { id } = req.query;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }
    if (typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid voucher id' });
    }

    const profile = await getUserRBACProfile(userId);
    if (!hasPermission(profile, PERMISSIONS.VOUCHERS_VIEW_REGISTER)) {
      return res.status(403).json({ error: 'You do not have permission to update the voucher register' });
    }

    if (req.method === 'PATCH') {
      const delivered = req.body?.delivered === true;

      const { data, error } = await supabaseAdmin
        .from('vouchers')
        .update({
          delivered,
          delivered_at: delivered ? new Date().toISOString() : null,
          delivered_by: delivered ? userId : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Voucher not found' });

      return res.status(200).json({ voucher: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Voucher deliver API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update voucher' });
  }
}
