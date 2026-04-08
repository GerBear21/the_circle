import { useState, useEffect, useCallback } from 'react';

interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
}

interface RoleWithPermissions {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  is_system: boolean;
  is_default: boolean;
  priority: number;
  permissions: Permission[];
  users_count?: number;
  created_at: string;
  updated_at: string;
}

export function useRBACRoles() {
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/rbac/roles');
      if (!res.ok) throw new Error('Failed to fetch roles');
      const data = await res.json();
      setRoles(data.roles || []);
      setPermissions(data.permissions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const createRole = async (payload: {
    name: string;
    slug: string;
    description?: string;
    color?: string;
    permissions?: string[];
  }) => {
    const res = await fetch('/api/rbac/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to create role');
    }
    await fetchRoles();
    return res.json();
  };

  const updateRole = async (payload: {
    id: string;
    name?: string;
    description?: string;
    color?: string;
    permissions?: string[];
  }) => {
    const res = await fetch('/api/rbac/roles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update role');
    }
    await fetchRoles();
    return res.json();
  };

  const deleteRole = async (id: string) => {
    const res = await fetch(`/api/rbac/roles?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to delete role');
    }
    await fetchRoles();
  };

  const assignRole = async (payload: {
    user_id: string;
    role_id: string;
    department_id?: string;
    business_unit_id?: string;
    expires_at?: string;
  }) => {
    const res = await fetch('/api/rbac/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to assign role');
    }
    return res.json();
  };

  const revokeRole = async (payload: {
    user_id: string;
    role_id: string;
    department_id?: string;
    business_unit_id?: string;
  }) => {
    const res = await fetch('/api/rbac/assign', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to revoke role');
    }
    return res.json();
  };

  return {
    roles,
    permissions,
    loading,
    error,
    refetch: fetchRoles,
    createRole,
    updateRole,
    deleteRole,
    assignRole,
    revokeRole,
  };
}
