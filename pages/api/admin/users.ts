import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAnyPermission, PERMISSIONS } from '@/lib/rbac';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const orgId = (session.user as any).org_id;
  if (!orgId) {
    return res.status(400).json({ error: 'No organization found' });
  }

  // GET — list all users with their roles, department, business unit
  if (req.method === 'GET') {
    const { allowed } = await requireAnyPermission(session.user.id, [
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.USERS_CREATE,
      PERMISSIONS.USERS_EDIT,
      PERMISSIONS.USERS_ASSIGN_ROLES,
    ]);
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    try {
      const { search, status, role_id } = req.query;

      // Fetch users with department and business unit
      let query = supabaseAdmin
        .from('app_users')
        .select(`
          id,
          display_name,
          email,
          role,
          job_title,
          profile_picture_url,
          is_active,
          created_at,
          last_sign_in_at,
          department_id,
          business_unit_id,
          department:departments(id, name),
          business_unit:business_units(id, name)
        `)
        .eq('organization_id', orgId)
        .order('display_name', { ascending: true });

      // Search filter
      if (search) {
        const s = search as string;
        query = query.or(`display_name.ilike.%${s}%,email.ilike.%${s}%,job_title.ilike.%${s}%`);
      }

      // Status filter
      if (status === 'active') {
        query = query.eq('is_active', true);
      } else if (status === 'inactive') {
        query = query.eq('is_active', false);
      }

      const { data: users, error: usersError } = await query;

      if (usersError) {
        console.error('Error fetching users:', usersError);
        return res.status(500).json({ error: 'Failed to fetch users' });
      }

      // Fetch all user_roles with role info for these users
      const userIds = (users || []).map((u: any) => u.id);

      let userRolesData: any[] = [];
      if (userIds.length > 0) {
        const { data: rolesData, error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .select(`
            user_id,
            role_id,
            is_active,
            expires_at,
            role:roles(id, name, slug, color, priority, is_system, is_default)
          `)
          .in('user_id', userIds)
          .eq('is_active', true);

        if (!rolesError) {
          userRolesData = rolesData || [];
        }
      }

      // Group roles by user_id
      const rolesByUser: Record<string, any[]> = {};
      userRolesData.forEach((ur: any) => {
        if (!rolesByUser[ur.user_id]) rolesByUser[ur.user_id] = [];
        if (ur.role) rolesByUser[ur.user_id].push(ur.role);
      });

      // If filtering by role_id, keep only users who have that role
      let enrichedUsers = (users || []).map((user: any) => ({
        ...user,
        roles: rolesByUser[user.id] || [],
        primary_role: (rolesByUser[user.id] || []).sort((a: any, b: any) => b.priority - a.priority)[0] || null,
      }));

      if (role_id) {
        enrichedUsers = enrichedUsers.filter((u: any) =>
          u.roles.some((r: any) => r.id === role_id)
        );
      }

      // Stats
      const stats = {
        total: enrichedUsers.length,
        active: enrichedUsers.filter((u: any) => u.is_active !== false).length,
        inactive: enrichedUsers.filter((u: any) => u.is_active === false).length,
      };

      return res.status(200).json({ users: enrichedUsers, stats });
    } catch (err) {
      console.error('Error in admin users GET:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT — update a user (status, role, department, etc.)
  if (req.method === 'PUT') {
    const { allowed } = await requireAnyPermission(session.user.id, [
      PERMISSIONS.USERS_EDIT,
      PERMISSIONS.USERS_DEACTIVATE,
    ]);
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    try {
      const { user_id, is_active, department_id, business_unit_id, job_title } = req.body;

      if (!user_id) {
        return res.status(400).json({ error: 'user_id is required' });
      }

      const updatePayload: Record<string, any> = {};
      if (is_active !== undefined) updatePayload.is_active = is_active;
      if (department_id !== undefined) updatePayload.department_id = department_id;
      if (business_unit_id !== undefined) updatePayload.business_unit_id = business_unit_id;
      if (job_title !== undefined) updatePayload.job_title = job_title;

      if (Object.keys(updatePayload).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const { data, error } = await supabaseAdmin
        .from('app_users')
        .update(updatePayload)
        .eq('id', user_id)
        .eq('organization_id', orgId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ success: true, user: data });
    } catch (err) {
      console.error('Error in admin users PUT:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
