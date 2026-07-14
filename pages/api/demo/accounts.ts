import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { hrimsClient } from '@/lib/hrimsClient';
import { getUserRBACProfile, hasPermission, PERMISSIONS } from '@/lib/rbac';

const DEMO_MODE = process.env.DEMO_MODE === 'true';

/**
 * DEMO-ONLY endpoint for managing provisioned demo personas.
 *   GET    — list the org's demo accounts (app_users whose azure_oid is `demo:*`).
 *   DELETE — remove a demo account: its login (demo_users), identity (app_users +
 *            role assignments) and, best-effort, its HRIMS employee + position.
 *
 * Hard-gated by DEMO_MODE (cannot run in production) and by RBAC — the caller
 * must hold users.delete.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!DEMO_MODE) {
    return res.status(403).json({ error: 'Demo mode is not enabled in this environment.' });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const orgId = (session.user as any).org_id;
  if (!orgId) {
    return res.status(400).json({ error: 'No organization on session' });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const rbac = await getUserRBACProfile(session.user.id);

  // ---- GET: list demo accounts for this org ----
  if (req.method === 'GET') {
    if (!hasPermission(rbac, PERMISSIONS.USERS_CREATE) && !hasPermission(rbac, PERMISSIONS.USERS_DELETE)) {
      return res.status(403).json({ error: 'You do not have permission to view demo accounts.' });
    }
    try {
      const { data, error } = await supabaseAdmin
        .from('app_users')
        .select('id, email, display_name, created_at')
        .eq('organization_id', orgId)
        .like('azure_oid', 'demo:%')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Merge in the demo login's active flag.
      const emails = (data || []).map((u: any) => u.email);
      const activeByEmail: Record<string, boolean> = {};
      if (emails.length > 0) {
        const { data: logins } = await supabaseAdmin
          .from('demo_users')
          .select('email, is_active')
          .in('email', emails);
        (logins || []).forEach((l: any) => { activeByEmail[l.email] = l.is_active !== false; });
      }

      const accounts = (data || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        createdAt: u.created_at,
        isActive: activeByEmail[u.email] ?? true,
      }));
      return res.status(200).json({ accounts });
    } catch (err: any) {
      console.error('Demo accounts list error:', err);
      return res.status(500).json({ error: err.message || 'Failed to list demo accounts' });
    }
  }

  // ---- DELETE: remove a demo account ----
  if (req.method === 'DELETE') {
    if (!hasPermission(rbac, PERMISSIONS.USERS_DELETE)) {
      return res.status(403).json({ error: 'You do not have permission to delete demo accounts.' });
    }
    const email = String(req.body?.email || req.query?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'A demo account email is required.' });
    }

    try {
      // Locate the org-scoped app_users identity for this demo persona.
      const { data: appUser } = await supabaseAdmin
        .from('app_users')
        .select('id, azure_oid')
        .eq('organization_id', orgId)
        .eq('email', email)
        .maybeSingle();

      // Guard: only ever delete demo-provisioned identities.
      if (appUser && !String(appUser.azure_oid || '').startsWith('demo:')) {
        return res.status(400).json({ error: 'That account is not a demo account and cannot be deleted here.' });
      }

      // 1. Remove any RBAC role assignments, then the app identity. A demo
      //    persona that has already created requests / left an audit trail is
      //    referenced by foreign keys, so a hard delete can be rejected — in
      //    that case fall back to deactivating the account so it can no longer
      //    be used and drops out of the user lists.
      let deactivatedOnly = false;
      if (appUser?.id) {
        await supabaseAdmin.from('user_roles').delete().eq('user_id', appUser.id);
        const { error: delErr } = await supabaseAdmin.from('app_users').delete().eq('id', appUser.id);
        if (delErr) {
          await supabaseAdmin.from('app_users').update({ is_active: false }).eq('id', appUser.id);
          deactivatedOnly = true;
        }
      }

      // 2. Remove the demo login so the account can no longer sign in.
      await supabaseAdmin.from('demo_users').delete().eq('email', email);

      // 3. Best-effort HRIMS cleanup (employee + organogram position). Never
      //    fails the request — the login is already gone at this point. Skipped
      //    when we could only deactivate the identity (it's still referenced).
      if (hrimsClient && !deactivatedOnly) {
        try {
          const { data: emp } = await hrimsClient
            .from('employees')
            .select('id')
            .eq('email', email)
            .maybeSingle();
          if (emp?.id) {
            const { data: positions } = await hrimsClient
              .from('organogram_positions')
              .select('id')
              .eq('employee_id', emp.id);
            const posIds = (positions || []).map((p: any) => p.id);
            if (posIds.length > 0) {
              // Re-parent any children to the top of the chart so the delete
              // doesn't fail on a foreign-key reference.
              await hrimsClient
                .from('organogram_positions')
                .update({ parent_position_id: null })
                .in('parent_position_id', posIds);
              await hrimsClient.from('organogram_positions').delete().in('id', posIds);
            }
            await hrimsClient.from('employees').delete().eq('id', emp.id);
          }
        } catch (hrimsErr) {
          console.error('Demo account HRIMS cleanup failed (non-fatal):', hrimsErr);
        }
      }

      return res.status(200).json({ success: true, deactivatedOnly });
    } catch (err: any) {
      console.error('Demo account delete error:', err);
      return res.status(500).json({ error: err.message || 'Failed to delete demo account' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
