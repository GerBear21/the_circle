import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  assignRoleToUser,
  revokeRoleFromUser,
  requirePermission,
  getUserRBACProfile,
  PERMISSIONS,
  ROLE_SLUGS,
} from '@/lib/rbac';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // POST — assign a role to a user
  if (req.method === 'POST') {
    const { allowed, profile } = await requirePermission(session.user.id, PERMISSIONS.USERS_ASSIGN_ROLES);
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions to assign roles' });
    }

    try {
      const { user_id, role_id, department_id, business_unit_id, expires_at } = req.body;

      if (!user_id || !role_id) {
        return res.status(400).json({ error: 'user_id and role_id are required' });
      }

      // Prevent non-super-admins from assigning super_admin role
      const { data: targetRole } = await supabaseAdmin
        .from('roles')
        .select('slug')
        .eq('id', role_id)
        .single();

      if (targetRole?.slug === ROLE_SLUGS.SUPER_ADMIN && !profile.is_super_admin) {
        return res.status(403).json({ error: 'Only Super Admins can assign the Super Admin role' });
      }

      const result = await assignRoleToUser(user_id, role_id, session.user.id, {
        departmentId: department_id,
        businessUnitId: business_unit_id,
        expiresAt: expires_at,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Error assigning role:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // DELETE — revoke a role from a user
  if (req.method === 'DELETE') {
    const { allowed, profile } = await requirePermission(session.user.id, PERMISSIONS.USERS_ASSIGN_ROLES);
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions to revoke roles' });
    }

    try {
      const { user_id, role_id, department_id, business_unit_id } = req.body;

      if (!user_id || !role_id) {
        return res.status(400).json({ error: 'user_id and role_id are required' });
      }

      // Prevent non-super-admins from revoking super_admin role
      const { data: targetRole } = await supabaseAdmin
        .from('roles')
        .select('slug')
        .eq('id', role_id)
        .single();

      if (targetRole?.slug === ROLE_SLUGS.SUPER_ADMIN && !profile.is_super_admin) {
        return res.status(403).json({ error: 'Only Super Admins can revoke the Super Admin role' });
      }

      const result = await revokeRoleFromUser(
        user_id,
        role_id,
        session.user.id,
        department_id,
        business_unit_id
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Error revoking role:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET — get all role assignments for a specific user
  if (req.method === 'GET') {
    try {
      const { user_id } = req.query;

      if (!user_id) {
        return res.status(400).json({ error: 'user_id is required' });
      }

      const rbacProfile = await getUserRBACProfile(user_id as string);
      return res.status(200).json(rbacProfile);
    } catch (err) {
      console.error('Error fetching user roles:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
