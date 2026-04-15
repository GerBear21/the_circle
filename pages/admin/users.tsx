import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '../../components/layout';
import { Card, Button } from '../../components/ui';
// UsersIllustration removed — clean layout
import { useAdminUsers } from '../../hooks/useAdminUsers';
import { useRBACRoles } from '../../hooks/useRBACRoles';
import { useRBAC } from '../../contexts/RBACContext';

type StatusFilter = 'all' | 'active' | 'inactive';

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active: { label: 'Active', bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
  inactive: { label: 'Inactive', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { hasPermission } = useRBAC();
  const { users, stats, loading, error, fetchUsers, updateUser } = useAdminUsers();
  const { roles } = useRBACRoles();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Debounced search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      fetchUsers({ search: query, status: statusFilter, role_id: roleFilter === 'all' ? undefined : roleFilter });
    }, 400);
    setSearchTimeout(timeout);
  }, [fetchUsers, statusFilter, roleFilter, searchTimeout]);

  const handleFilterChange = useCallback((newStatus?: StatusFilter, newRole?: string) => {
    const s = newStatus ?? statusFilter;
    const r = newRole ?? roleFilter;
    setStatusFilter(s);
    setRoleFilter(r);
    fetchUsers({ search: searchQuery, status: s, role_id: r === 'all' ? undefined : r });
  }, [fetchUsers, searchQuery, statusFilter, roleFilter]);

  const handleToggleActive = useCallback(async (userId: string, currentActive: boolean) => {
    try {
      await updateUser({ user_id: userId, is_active: !currentActive });
    } catch (err: any) {
      alert(err.message || 'Failed to update user');
    }
  }, [updateUser]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatLastLogin = (dateString?: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 5) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(dateString);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleColor = (color?: string) => {
    const colors: Record<string, string> = {
      red: 'bg-red-100 text-red-800',
      purple: 'bg-[#F3EADC] text-[#3F2D19]',
      indigo: 'bg-[#F3EADC] text-[#3F2D19]',
      blue: 'bg-[#F3EADC] text-[#3F2D19]',
      green: 'bg-green-100 text-green-800',
      gray: 'bg-gray-100 text-gray-700',
    };
    return colors[color || 'gray'] || 'bg-gray-100 text-gray-700';
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map((u) => u.id));
    }
  };

  if (status === 'loading' || loading) {
    return (
      <AppLayout title="Users">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="User Management">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="md:col-span-2 space-y-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-heading">User Management</h1>
              <p className="text-gray-500 mt-2 text-lg">
                Manage organization users, roles, and access permissions efficiently.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => { }}
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <Card className="!p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Total Users</div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </div>
            <div className="text-sm text-gray-500">Active</div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <div className="text-2xl font-bold text-gray-600">{stats.inactive}</div>
            </div>
            <div className="text-sm text-gray-500">Inactive</div>
          </Card>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, job title..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => handleFilterChange(undefined, e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
            >
              <option value="all">All Roles</option>
              {roles.map((role: any) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(e.target.value as StatusFilter)}
              className="px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedUsers.length > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-brand-50 rounded-xl">
            <span className="text-sm font-medium text-brand-700">
              {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex-1" />
            <button
              onClick={() => setSelectedUsers([])}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            Showing {users.length} user{users.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Users List */}
        {users.length === 0 ? (
          <Card className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-600 mb-1">No users found</h3>
            <p className="text-gray-400 mb-4">
              {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'No users have been added yet'}
            </p>
            {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all') && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchQuery('');
                  setRoleFilter('all');
                  setStatusFilter('all');
                  fetchUsers();
                }}
              >
                Clear filters
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Select All Header */}
            <div className="flex items-center gap-3 px-4 py-2 text-sm text-gray-500">
              <input
                type="checkbox"
                checked={selectedUsers.length === users.length && users.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span>Select all</span>
            </div>

            {users.map((user) => {
              const isActive = user.is_active !== false;
              const statusKey = isActive ? 'active' : 'inactive';
              const statusInfo = statusConfig[statusKey];
              const isSelected = selectedUsers.includes(user.id);
              const primaryRole = user.primary_role;

              return (
                <Card
                  key={user.id}
                  variant="outlined"
                  className={`transition-all ${isSelected ? 'ring-2 ring-brand-500 border-brand-200' : 'hover:shadow-card-hover'}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <div className="flex items-center pt-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectUser(user.id)}
                        className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                    </div>

                    {/* Avatar */}
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600 overflow-hidden">
                        {user.profile_picture_url ? (
                          <img src={user.profile_picture_url} alt={user.display_name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          getInitials(user.display_name || user.email)
                        )}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${statusInfo.dot}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Name and Role Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-gray-900">{user.display_name || 'Unnamed'}</h3>
                            {/* RBAC Roles */}
                            {user.roles && user.roles.length > 0 ? (
                              user.roles.map((role: any) => (
                                <span key={role.id} className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(role.color)}`}>
                                  {role.name}
                                </span>
                              ))
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                No Role
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                            {statusInfo.label}
                          </span>
                          {hasPermission('users.deactivate') && (
                            <button
                              onClick={() => handleToggleActive(user.id, isActive)}
                              className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                                isActive
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                  : 'bg-green-50 text-green-600 hover:bg-green-100'
                              }`}
                              title={isActive ? 'Deactivate user' : 'Activate user'}
                            >
                              {isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Position and Department */}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {user.job_title && (
                          <>
                            <span className="text-sm text-gray-600">{user.job_title}</span>
                            <span className="text-gray-300">&bull;</span>
                          </>
                        )}
                        {user.department && (
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-[#F3EADC] text-[#5E4426]">
                            {user.department.name}
                          </span>
                        )}
                        {user.business_unit && (
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-[#F3EADC] text-[#5E4426]">
                            {user.business_unit.name}
                          </span>
                        )}
                      </div>

                      {/* Meta Info */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-gray-500">
                        {/* Last Login */}
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                          </svg>
                          Last login: {formatLastLogin(user.last_sign_in_at)}
                        </span>
                        {/* Joined Date */}
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Joined {formatDate(user.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
