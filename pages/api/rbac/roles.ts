import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getAllRoles,
  getAllPermissions,
  requirePermission,
  logRBACAction,
  PERMISSIONS,
} from '@/lib/rbac';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const orgId = (session.user as any).org_id;
  if (!orgId) {
    return res.status(400).json({ error: 'No organization found' });
  }

  // GET — list all roles (+ permissions catalog)
  if (req.method === 'GET') {
    try {
      const [roles, permissions] = await Promise.all([
        getAllRoles(orgId),
        getAllPermissions(),
      ]);

      return res.status(200).json({ roles, permissions });
    } catch (err) {
      console.error('Error fetching roles:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST — create a new role
  if (req.method === 'POST') {
    const { allowed } = await requirePermission(session.user.id, PERMISSIONS.ADMIN_ROLES);
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    try {
      const { name, slug, description, color, permissions: permissionCodes } = req.body;

      if (!name || !slug) {
        return res.status(400).json({ error: 'Name and slug are required' });
      }

      // Create the role
      const { data: role, error: roleError } = await supabaseAdmin
        .from('roles')
        .insert({
          organization_id: orgId,
          name,
          slug,
          description: description || null,
          color: color || 'gray',
          is_system: false,
          is_default: false,
          priority: 0,
        })
        .select()
        .single();

      if (roleError) {
        console.error('Error creating role:', roleError);
        return res.status(400).json({ error: roleError.message });
      }

      // Assign permissions if provided
      if (permissionCodes && permissionCodes.length > 0) {
        // Resolve permission IDs from codes
        const { data: perms } = await supabaseAdmin
          .from('permissions')
          .select('id, code')
          .in('code', permissionCodes);

        if (perms && perms.length > 0) {
          const rpInserts = perms.map((p: any) => ({
            role_id: role.id,
            permission_id: p.id,
          }));

          await supabaseAdmin.from('role_permissions').insert(rpInserts);
        }
      }

      await logRBACAction(session.user.id, 'role_created', 'role', role.id, { name, slug });

      return res.status(201).json(role);
    } catch (err) {
      console.error('Error creating role:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT — update a role
  if (req.method === 'PUT') {
    const { allowed } = await requirePermission(session.user.id, PERMISSIONS.ADMIN_ROLES);
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    try {
      const { id, name, description, color, permissions: permissionCodes } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Role ID is required' });
      }

      // Update role metadata
      const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (name !== undefined) updatePayload.name = name;
      if (description !== undefined) updatePayload.description = description;
      if (color !== undefined) updatePayload.color = color;

      const { data: role, error: roleError } = await supabaseAdmin
        .from('roles')
        .update(updatePayload)
        .eq('id', id)
        .eq('organization_id', orgId)
        .select()
        .single();

      if (roleError) {
        console.error('Error updating role:', roleError);
        return res.status(400).json({ error: roleError.message });
      }

      // Update permissions if provided
      if (permissionCodes !== undefined) {
        // Remove existing permissions
        await supabaseAdmin
          .from('role_permissions')
          .delete()
          .eq('role_id', id);

        // Add new permissions
        if (permissionCodes.length > 0) {
          const { data: perms } = await supabaseAdmin
            .from('permissions')
            .select('id, code')
            .in('code', permissionCodes);

          if (perms && perms.length > 0) {
            const rpInserts = perms.map((p: any) => ({
              role_id: id,
              permission_id: p.id,
            }));
            await supabaseAdmin.from('role_permissions').insert(rpInserts);
          }
        }
      }

      await logRBACAction(session.user.id, 'role_updated', 'role', id, { name, changes: Object.keys(updatePayload) });

      return res.status(200).json(role);
    } catch (err) {
      console.error('Error updating role:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // DELETE — delete a custom role
  if (req.method === 'DELETE') {
    const { allowed } = await requirePermission(session.user.id, PERMISSIONS.ADMIN_ROLES);
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Role ID is required' });
      }

      // Prevent deleting system roles
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('is_system, name')
        .eq('id', id)
        .single();

      if (role?.is_system) {
        return res.status(400).json({ error: 'Cannot delete system roles' });
      }

      const { error } = await supabaseAdmin
        .from('roles')
        .delete()
        .eq('id', id)
        .eq('organization_id', orgId);

      if (error) {
        console.error('Error deleting role:', error);
        return res.status(400).json({ error: error.message });
      }

      await logRBACAction(session.user.id, 'role_deleted', 'role', id as string, { name: role?.name });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Error deleting role:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
