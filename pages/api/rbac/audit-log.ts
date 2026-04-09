import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePermission, PERMISSIONS } from '@/lib/rbac';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { allowed } = await requirePermission(session.user.id, PERMISSIONS.ADMIN_AUDIT_LOGS);
  if (!allowed) {
    return res.status(403).json({ error: 'Insufficient permissions to view audit logs' });
  }

  try {
    const { page = '1', limit = '50', action, actor_id, target_type } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = supabaseAdmin
      .from('rbac_audit_log')
      .select(`
        *,
        actor:app_users!rbac_audit_log_actor_id_fkey(id, display_name, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit as string) - 1);

    if (action) query = query.eq('action', action);
    if (actor_id) query = query.eq('actor_id', actor_id);
    if (target_type) query = query.eq('target_type', target_type);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching RBAC audit log:', error);
      return res.status(500).json({ error: 'Failed to fetch audit log' });
    }

    return res.status(200).json({
      data: data || [],
      total: count || 0,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (err) {
    console.error('Error in audit log API:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
