import { useState, useEffect, useCallback } from 'react';

interface UserRole {
  id: string;
  name: string;
  slug: string;
  color: string;
  priority: number;
  is_system: boolean;
  is_default: boolean;
}

interface AdminUser {
  id: string;
  display_name: string;
  email: string;
  role: string;
  job_title: string | null;
  profile_picture_url: string | null;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  department_id: string | null;
  business_unit_id: string | null;
  department: { id: string; name: string } | null;
  business_unit: { id: string; name: string } | null;
  roles: UserRole[];
  primary_role: UserRole | null;
}

interface UserStats {
  total: number;
  active: number;
  inactive: number;
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<UserStats>({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async (params?: {
    search?: string;
    status?: string;
    role_id?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.status && params.status !== 'all') query.set('status', params.status);
      if (params?.role_id) query.set('role_id', params.role_id);

      const url = `/api/admin/users${query.toString() ? '?' + query.toString() : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch users');
      }
      const data = await res.json();
      setUsers(data.users || []);
      setStats(data.stats || { total: 0, active: 0, inactive: 0 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateUser = useCallback(async (payload: {
    user_id: string;
    is_active?: boolean;
    department_id?: string;
    business_unit_id?: string;
    job_title?: string;
  }) => {
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update user');
    }
    await fetchUsers();
    return res.json();
  }, [fetchUsers]);

  return {
    users,
    stats,
    loading,
    error,
    fetchUsers,
    updateUser,
  };
}
