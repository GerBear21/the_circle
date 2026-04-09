import { supabaseAdmin } from './supabaseAdmin';

// ============================================================
// Types
// ============================================================

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
}

export interface Role {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  is_system: boolean;
  is_default: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
  users_count?: number;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  department_id: string | null;
  business_unit_id: string | null;
  assigned_by: string | null;
  assigned_at: string;
  expires_at: string | null;
  is_active: boolean;
  role?: Role;
}

export interface UserRBACProfile {
  roles: RoleWithPermissions[];
  permissions: string[];  // flat array of permission codes
  scoped_roles: UserRole[];
  is_super_admin: boolean;
}

export interface ApprovalDelegation {
  id: string;
  delegator_id: string;
  delegate_id: string;
  reason: string | null;
  department_id: string | null;
  business_unit_id: string | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

// ============================================================
// Permission Constants
// ============================================================

export const PERMISSIONS = {
  // Requests
  REQUESTS_CREATE: 'requests.create',
  REQUESTS_VIEW_OWN: 'requests.view_own',
  REQUESTS_VIEW_ALL: 'requests.view_all',
  REQUESTS_EDIT_OWN: 'requests.edit_own',
  REQUESTS_WITHDRAW: 'requests.withdraw',
  REQUESTS_DELETE: 'requests.delete',
  // Approvals
  APPROVALS_VIEW: 'approvals.view',
  APPROVALS_APPROVE: 'approvals.approve',
  APPROVALS_REJECT: 'approvals.reject',
  APPROVALS_DELEGATE: 'approvals.delegate',
  APPROVALS_OVERRIDE: 'approvals.override',
  APPROVALS_REASSIGN: 'approvals.reassign',
  APPROVALS_CONFIGURE_DELEGATION: 'approvals.configure_delegation',
  // Users
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DEACTIVATE: 'users.deactivate',
  USERS_DELETE: 'users.delete',
  USERS_ASSIGN_ROLES: 'users.assign_roles',
  USERS_MANAGE_ACCESS: 'users.manage_access',
  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',
  SETTINGS_WORKFLOWS: 'settings.workflows',
  SETTINGS_TEMPLATES: 'settings.templates',
  SETTINGS_INTEGRATIONS: 'settings.integrations',
  SETTINGS_SLA: 'settings.sla',
  // Forms
  FORMS_DESIGN: 'forms.design',
  FORMS_EDIT_RATES: 'forms.edit_rates',
  FORMS_PUBLISH: 'forms.publish',
  FORMS_ARCHIVE: 'forms.archive',
  // Reports
  REPORTS_VIEW_OWN: 'reports.view_own',
  REPORTS_VIEW_TEAM: 'reports.view_team',
  REPORTS_VIEW_ALL: 'reports.view_all',
  REPORTS_EXPORT: 'reports.export',
  REPORTS_SLA_COMPLIANCE: 'reports.sla_compliance',
  REPORTS_ANALYTICS: 'reports.analytics',
  // Admin
  ADMIN_ROLES: 'admin.roles',
  ADMIN_PERMISSIONS: 'admin.permissions',
  ADMIN_AUDIT_LOGS: 'admin.audit_logs',
  ADMIN_SYSTEM_CONFIG: 'admin.system_config',
  ADMIN_BILLING: 'admin.billing',
  ADMIN_API_KEYS: 'admin.api_keys',
  // Archives
  ARCHIVES_VIEW_OWN: 'archives.view_own',
  ARCHIVES_VIEW_ALL: 'archives.view_all',
  ARCHIVES_DOWNLOAD: 'archives.download',
  ARCHIVES_MANAGE: 'archives.manage',
} as const;

export const ROLE_SLUGS = {
  SUPER_ADMIN: 'super_admin',
  SYSTEM_ADMIN: 'system_admin',
  AUDITOR: 'auditor',
  EMPLOYEE: 'employee',
} as const;

// ============================================================
// Server-side RBAC Functions
// ============================================================

export async function getUserRBACProfile(userId: string): Promise<UserRBACProfile> {
  // Fetch all active user_roles with their role + role_permissions + permissions
  const { data: userRoles, error: urError } = await supabaseAdmin
    .from('user_roles')
    .select(`
      *,
      role:roles(
        *,
        role_permissions(
          permission:permissions(*)
        )
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

  if (urError) {
    console.error('Error fetching user RBAC profile:', urError);
    return { roles: [], permissions: [], scoped_roles: [], is_super_admin: false };
  }

  if (!userRoles || userRoles.length === 0) {
    return { roles: [], permissions: [], scoped_roles: [], is_super_admin: false };
  }

  const rolesMap = new Map<string, RoleWithPermissions>();
  const allPermissions = new Set<string>();
  let isSuperAdmin = false;

  for (const ur of userRoles) {
    const role = ur.role as any;
    if (!role) continue;

    if (role.slug === ROLE_SLUGS.SUPER_ADMIN) {
      isSuperAdmin = true;
    }

    if (!rolesMap.has(role.id)) {
      const permissions = (role.role_permissions || [])
        .map((rp: any) => rp.permission)
        .filter(Boolean);

      rolesMap.set(role.id, {
        ...role,
        permissions,
        role_permissions: undefined,
      });

      permissions.forEach((p: Permission) => allPermissions.add(p.code));
    }
  }

  return {
    roles: Array.from(rolesMap.values()),
    permissions: Array.from(allPermissions),
    scoped_roles: userRoles as UserRole[],
    is_super_admin: isSuperAdmin,
  };
}

export function hasPermission(rbacProfile: UserRBACProfile, permissionCode: string): boolean {
  if (rbacProfile.is_super_admin) return true;
  return rbacProfile.permissions.includes(permissionCode);
}

export function hasAnyPermission(rbacProfile: UserRBACProfile, permissionCodes: string[]): boolean {
  if (rbacProfile.is_super_admin) return true;
  return permissionCodes.some(code => rbacProfile.permissions.includes(code));
}

export function hasAllPermissions(rbacProfile: UserRBACProfile, permissionCodes: string[]): boolean {
  if (rbacProfile.is_super_admin) return true;
  return permissionCodes.every(code => rbacProfile.permissions.includes(code));
}

export function hasRole(rbacProfile: UserRBACProfile, roleSlug: string): boolean {
  return rbacProfile.roles.some(r => r.slug === roleSlug);
}

export function hasRoleInScope(
  rbacProfile: UserRBACProfile,
  roleSlug: string,
  departmentId?: string,
  businessUnitId?: string
): boolean {
  return rbacProfile.scoped_roles.some(ur => {
    const role = rbacProfile.roles.find(r => r.id === ur.role_id);
    if (!role || role.slug !== roleSlug) return false;

    // If no scope set on the assignment, it's global
    if (!ur.department_id && !ur.business_unit_id) return true;

    // Check department scope
    if (departmentId && ur.department_id && ur.department_id !== departmentId) return false;
    // Check business unit scope
    if (businessUnitId && ur.business_unit_id && ur.business_unit_id !== businessUnitId) return false;

    return true;
  });
}

// ============================================================
// Role management
// ============================================================

export async function getAllRoles(organizationId: string): Promise<RoleWithPermissions[]> {
  const { data: roles, error } = await supabaseAdmin
    .from('roles')
    .select(`
      *,
      role_permissions(
        permission:permissions(*)
      )
    `)
    .eq('organization_id', organizationId)
    .order('priority', { ascending: false });

  if (error) {
    console.error('Error fetching roles:', error);
    return [];
  }

  // Get user counts per role
  const { data: counts } = await supabaseAdmin
    .from('user_roles')
    .select('role_id')
    .eq('is_active', true);

  const countMap = new Map<string, number>();
  (counts || []).forEach((c: any) => {
    countMap.set(c.role_id, (countMap.get(c.role_id) || 0) + 1);
  });

  return (roles || []).map((role: any) => ({
    ...role,
    permissions: (role.role_permissions || []).map((rp: any) => rp.permission).filter(Boolean),
    users_count: countMap.get(role.id) || 0,
    role_permissions: undefined,
  }));
}

export async function getAllPermissions(): Promise<Permission[]> {
  const { data, error } = await supabaseAdmin
    .from('permissions')
    .select('*')
    .order('category')
    .order('code');

  if (error) {
    console.error('Error fetching permissions:', error);
    return [];
  }

  return data || [];
}

export async function assignRoleToUser(
  userId: string,
  roleId: string,
  assignedBy: string,
  options?: {
    departmentId?: string;
    businessUnitId?: string;
    expiresAt?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('user_roles')
    .upsert({
      user_id: userId,
      role_id: roleId,
      department_id: options?.departmentId || null,
      business_unit_id: options?.businessUnitId || null,
      assigned_by: assignedBy,
      expires_at: options?.expiresAt || null,
      is_active: true,
    }, {
      onConflict: 'user_id,role_id,department_id,business_unit_id',
    });

  if (error) {
    console.error('Error assigning role:', error);
    return { success: false, error: error.message };
  }

  // Log the action
  await logRBACAction(assignedBy, 'role_assigned', 'user_role', userId, {
    role_id: roleId,
    department_id: options?.departmentId,
    business_unit_id: options?.businessUnitId,
  });

  return { success: true };
}

export async function revokeRoleFromUser(
  userId: string,
  roleId: string,
  revokedBy: string,
  departmentId?: string,
  businessUnitId?: string
): Promise<{ success: boolean; error?: string }> {
  let query = supabaseAdmin
    .from('user_roles')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('role_id', roleId);

  if (departmentId) {
    query = query.eq('department_id', departmentId);
  } else {
    query = query.is('department_id', null);
  }

  if (businessUnitId) {
    query = query.eq('business_unit_id', businessUnitId);
  } else {
    query = query.is('business_unit_id', null);
  }

  const { error } = await query;

  if (error) {
    console.error('Error revoking role:', error);
    return { success: false, error: error.message };
  }

  await logRBACAction(revokedBy, 'role_revoked', 'user_role', userId, {
    role_id: roleId,
    department_id: departmentId,
    business_unit_id: businessUnitId,
  });

  return { success: true };
}

// ============================================================
// Audit logging
// ============================================================

export async function logRBACAction(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | undefined,
  details?: Record<string, any>,
  ipAddress?: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('rbac_audit_log')
    .insert({
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      details: details || {},
      ip_address: ipAddress,
    });

  if (error) {
    console.error('Error logging RBAC action:', error);
  }
}

// ============================================================
// API Route middleware helper
// ============================================================

export async function requirePermission(
  userId: string,
  permissionCode: string
): Promise<{ allowed: boolean; profile: UserRBACProfile }> {
  const profile = await getUserRBACProfile(userId);
  return {
    allowed: hasPermission(profile, permissionCode),
    profile,
  };
}

export async function requireAnyPermission(
  userId: string,
  permissionCodes: string[]
): Promise<{ allowed: boolean; profile: UserRBACProfile }> {
  const profile = await getUserRBACProfile(userId);
  return {
    allowed: hasAnyPermission(profile, permissionCodes),
    profile,
  };
}
