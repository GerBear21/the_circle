import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePermission, logRBACAction, PERMISSIONS } from '@/lib/rbac';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const orgId = (session.user as any).org_id;
  if (!orgId) {
    return res.status(400).json({ error: 'No organization found' });
  }

  // GET — fetch all system settings for the org, optionally filtered by category
  if (req.method === 'GET') {
    const { allowed } = await requirePermission(session.user.id, PERMISSIONS.ADMIN_SYSTEM_CONFIG);
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    try {
      const { category } = req.query;

      let query = supabaseAdmin
        .from('system_settings')
        .select('*')
        .eq('organization_id', orgId)
        .order('category')
        .order('key');

      if (category) {
        query = query.eq('category', category as string);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching system settings:', error);
        return res.status(500).json({ error: 'Failed to fetch settings' });
      }

      // Transform into a grouped object: { sla: { key: value, ... }, rates: { ... }, ... }
      const grouped: Record<string, Record<string, any>> = {};
      (data || []).forEach((row: any) => {
        if (!grouped[row.category]) grouped[row.category] = {};
        grouped[row.category][row.key] = row.value;
      });

      return res.status(200).json({ settings: grouped, raw: data || [] });
    } catch (err) {
      console.error('Error in settings GET:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT — upsert one or more settings
  if (req.method === 'PUT') {
    const { allowed } = await requirePermission(session.user.id, PERMISSIONS.ADMIN_SYSTEM_CONFIG);
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    try {
      const { settings } = req.body;
      // settings should be: { category: string, key: string, value: any }[] or a single object
      const items = Array.isArray(settings) ? settings : [settings];

      if (!items.length || !items[0]?.category || !items[0]?.key) {
        return res.status(400).json({ error: 'Settings array with category, key, and value is required' });
      }

      const upserts = items.map((item: any) => ({
        organization_id: orgId,
        category: item.category,
        key: item.key,
        value: item.value,
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabaseAdmin
        .from('system_settings')
        .upsert(upserts, {
          onConflict: 'organization_id,category,key',
        })
        .select();

      if (error) {
        console.error('Error saving system settings:', error);
        return res.status(400).json({ error: error.message });
      }

      await logRBACAction(session.user.id, 'settings_updated', 'system_settings', undefined, {
        categories: [...new Set(items.map((i: any) => i.category))],
        keys: items.map((i: any) => `${i.category}.${i.key}`),
      });

      return res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('Error in settings PUT:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
