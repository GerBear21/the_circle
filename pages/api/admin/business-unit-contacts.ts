import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getUserRBACProfile, hasRole, ROLE_SLUGS } from '@/lib/rbac';
import { fetchHrimsBusinessUnits } from '@/lib/hrimsClient';

// Reception/reservations mailboxes for hotels, editable by the Super Admin and
// System Admin only. Business units are sourced from HRIMS, so the saved rows
// are merged onto the live HRIMS list.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const profile = await getUserRBACProfile(userId);
    const isAllowed = profile.is_super_admin || hasRole(profile, ROLE_SLUGS.SYSTEM_ADMIN);
    if (!isAllowed) {
      return res.status(403).json({ error: 'Only a Super Admin or System Admin may manage voucher emails' });
    }

    if (req.method === 'GET') {
      // Live hotel list from HRIMS (best-effort) merged with saved contacts.
      let hrimsUnits: Array<{ id: string; name: string; code?: string }> = [];
      try {
        const excluded = ['Head Office', 'RTG Head Office', 'Corporate Office'];
        const all = await fetchHrimsBusinessUnits();
        hrimsUnits = all
          .filter((u) => !excluded.includes(u.name))
          .map((u) => ({ id: String(u.id), name: u.name, code: u.code }));
      } catch (hrimsErr) {
        console.error('Failed to fetch HRIMS business units for contacts:', hrimsErr);
      }

      const { data: contacts } = await supabaseAdmin
        .from('business_unit_contacts')
        .select('business_unit_id, reception_email, reservations_email')
        .eq('organization_id', organizationId);

      const contactMap = new Map<string, { reception_email: string; reservations_email: string }>();
      for (const c of contacts || []) {
        contactMap.set(c.business_unit_id, {
          reception_email: c.reception_email || '',
          reservations_email: c.reservations_email || '',
        });
      }

      const merged = hrimsUnits.map((u) => ({
        business_unit_id: u.id,
        business_unit_code: u.code || null,
        business_unit_name: u.name,
        reception_email: contactMap.get(u.id)?.reception_email || '',
        reservations_email: contactMap.get(u.id)?.reservations_email || '',
      }));

      return res.status(200).json({ contacts: merged });
    }

    if (req.method === 'PUT') {
      const rows = Array.isArray(req.body?.contacts) ? req.body.contacts : null;
      if (!rows) {
        return res.status(400).json({ error: 'contacts array is required' });
      }

      const now = new Date().toISOString();
      const upserts = rows
        .filter((r: any) => r && r.business_unit_id)
        .map((r: any) => ({
          organization_id: organizationId,
          business_unit_id: String(r.business_unit_id),
          business_unit_code: r.business_unit_code || null,
          business_unit_name: r.business_unit_name || null,
          reception_email: (r.reception_email || '').trim() || null,
          reservations_email: (r.reservations_email || '').trim() || null,
          updated_by: userId,
          updated_at: now,
        }));

      if (upserts.length > 0) {
        const { error } = await supabaseAdmin
          .from('business_unit_contacts')
          .upsert(upserts, { onConflict: 'organization_id,business_unit_id' });
        if (error) throw error;
      }

      return res.status(200).json({ success: true, saved: upserts.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Business unit contacts API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}
