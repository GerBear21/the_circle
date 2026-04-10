import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/layout';
import { Card, Button } from '../../components/ui';
import { useRBACRoles } from '../../hooks/useRBACRoles';
import { useRBAC } from '../../contexts/RBACContext';

interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
}

interface RoleWithPermissions {
  id: string;
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

// Role icon mapping by slug
const roleIconMap: Record<string, string> = {
  super_admin: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  system_admin: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  auditor: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  employee: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
};
const defaultRoleIcon = 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z';


const colorConfig: Record<string, { bg: string; text: string; light: string; border: string }> = {
  purple: { bg: 'bg-[#9A7545]', text: 'text-[#5E4426]', light: 'bg-[#F3EADC]', border: 'border-[#E6D3B3]' },
  blue: { bg: 'bg-[#9A7545]', text: 'text-[#5E4426]', light: 'bg-[#F3EADC]', border: 'border-[#C9B896]' },
  teal: { bg: 'bg-teal-500', text: 'text-teal-700', light: 'bg-teal-100', border: 'border-teal-200' },
  gray: { bg: 'bg-gray-500', text: 'text-gray-700', light: 'bg-gray-100', border: 'border-gray-200' },
  green: { bg: 'bg-green-500', text: 'text-green-700', light: 'bg-green-100', border: 'border-green-200' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-100', border: 'border-orange-200' },
  indigo: { bg: 'bg-[#9A7545]', text: 'text-[#5E4426]', light: 'bg-[#F3EADC]', border: 'border-[#E6D3B3]' },
  red: { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-100', border: 'border-red-200' },
  pink: { bg: 'bg-pink-500', text: 'text-pink-700', light: 'bg-pink-100', border: 'border-pink-200' },
  cyan: { bg: 'bg-cyan-500', text: 'text-cyan-700', light: 'bg-cyan-100', border: 'border-cyan-200' },
};

const categoryConfig: Record<string, { label: string; icon: string; color: string }> = {
  requests: { label: 'Requests', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'text-[#9A7545]' },
  approvals: { label: 'Approvals', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-green-600' },
  users: { label: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', color: 'text-[#9A7545]' },
  settings: { label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', color: 'text-gray-600' },
  reports: { label: 'Reports', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', color: 'text-orange-600' },
  admin: { label: 'Administration', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: 'text-red-600' },
  forms: { label: 'Forms', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'text-cyan-600' },
  archives: { label: 'Archives', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', color: 'text-teal-600' },
};

export default function AdminRolesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { roles, permissions: allPermissions, loading, error, refetch, deleteRole } = useRBACRoles();
  const { hasPermission } = useRBAC();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const filteredRoles = roles.filter((role) => {
    return (
      role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (role.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const stats = {
    total: roles.length,
    system: roles.filter((r) => r.is_system).length,
    custom: roles.filter((r) => !r.is_system).length,
    totalUsers: roles.reduce((sum, r) => sum + (r.users_count || 0), 0),
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getPermissionsByCategory = (perms: Permission[]) => {
    const grouped: Record<string, Permission[]> = {};
    perms.forEach((permission) => {
      if (!grouped[permission.category]) {
        grouped[permission.category] = [];
      }
      grouped[permission.category].push(permission);
    });
    return grouped;
  };

  const getRoleIcon = (role: RoleWithPermissions) => {
    return roleIconMap[role.slug] || defaultRoleIcon;
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role? Users assigned to it will lose these permissions.')) return;
    try {
      await deleteRole(roleId);
    } catch (err: any) {
      alert(err.message || 'Failed to delete role');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <AppLayout title="Roles">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="Role Management">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-heading">Role Management</h1>
            <p className="text-gray-500 mt-1">Define roles and permissions for your organization</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowPermissions(!showPermissions)}
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              {showPermissions ? 'Hide' : 'View'} All Permissions
            </Button>
            <Button
              variant="primary"
              onClick={() => {}}
              className="flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Role
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="!p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Total Roles</div>
          </Card>
          <Card className="!p-4">
            <div className="text-2xl font-bold text-[#9A7545]">{stats.system}</div>
            <div className="text-sm text-gray-500">System Roles</div>
          </Card>
          <Card className="!p-4">
            <div className="text-2xl font-bold text-[#9A7545]">{stats.custom}</div>
            <div className="text-sm text-gray-500">Custom Roles</div>
          </Card>
          <Card className="!p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.totalUsers}</div>
            <div className="text-sm text-gray-500">Users Assigned</div>
          </Card>
        </div>

        {/* All Permissions Panel */}
        {showPermissions && (
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">All Available Permissions</h2>
              <span className="text-sm text-gray-500">{allPermissions.length} permissions</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(categoryConfig).map(([category, config]) => {
                const categoryPermissions = allPermissions.filter((p) => p.category === category);
                return (
                  <div key={category} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className={`w-5 h-5 ${config.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
                      </svg>
                      <h3 className="font-medium text-gray-900">{config.label}</h3>
                      <span className="text-xs text-gray-400">({categoryPermissions.length})</span>
                    </div>
                    <div className="space-y-2">
                      {categoryPermissions.map((permission) => (
                        <div key={permission.id} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">{permission.name}</p>
                            <p className="text-xs text-gray-500">{permission.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Roles Grid */}
        {filteredRoles.length === 0 ? (
          <Card className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-600 mb-1">No roles found</h3>
            <p className="text-gray-400">Try adjusting your search terms</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredRoles.map((role) => {
              const colorInfo = colorConfig[role.color] || colorConfig.gray;
              const permissionsByCategory = getPermissionsByCategory(role.permissions);
              const isExpanded = selectedRole?.id === role.id;

              return (
                <Card
                  key={role.id}
                  variant="outlined"
                  className={`transition-all ${isExpanded ? 'ring-2 ring-brand-500 border-brand-200' : 'hover:shadow-card-hover'}`}
                >
                  {/* Role Header */}
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 ${colorInfo.light} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <svg className={`w-6 h-6 ${colorInfo.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getRoleIcon(role)} />
                      </svg>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900">{role.name}</h3>
                            {role.is_system && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#F3EADC] text-[#5E4426]">
                                System
                              </span>
                            )}
                            {role.is_default && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{role.description}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedRole(isExpanded ? null : role)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                            title={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            <svg
                              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {!role.is_system && (
                            <button
                              onClick={() => {}}
                              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Meta Info */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          {role.users_count || 0} user{(role.users_count || 0) !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Updated {formatDate(role.updated_at)}
                        </span>
                      </div>

                      {/* Permission Categories Summary */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {Object.entries(permissionsByCategory).map(([category, permissions]) => {
                          const catConfig = categoryConfig[category] || categoryConfig.admin;
                          return (
                            <span
                              key={category}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-xs text-gray-600"
                            >
                              <svg className={`w-3 h-3 ${catConfig.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={catConfig.icon} />
                              </svg>
                              {catConfig.label} ({permissions.length})
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Permissions */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Permissions</h4>
                        {!role.is_system && (
                          <Button variant="secondary" onClick={() => {}} className="text-sm">
                            Edit Permissions
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.entries(permissionsByCategory).map(([category, permissions]) => {
                          const catConfig = categoryConfig[category] || categoryConfig.admin;
                          return (
                            <div key={category} className="bg-gray-50 rounded-xl p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className={`w-4 h-4 ${catConfig.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={catConfig.icon} />
                                </svg>
                                <span className="text-sm font-medium text-gray-700">{catConfig.label}</span>
                              </div>
                              <div className="space-y-1">
                                {permissions.map((permission) => (
                                  <div key={permission.id} className="flex items-center gap-2 text-sm">
                                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-gray-600">{permission.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                        <div className="text-xs text-gray-500">
                          Created {formatDate(role.created_at)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => router.push(`/admin/users?role=${role.id}`)}
                            className="text-sm"
                          >
                            View Users
                          </Button>
                          {!role.is_system && (
                            <>
                              <Button variant="secondary" onClick={() => {}} className="text-sm">
                                Duplicate
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => handleDeleteRole(role.id)}
                                className="text-sm text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Help Section */}
        <Card className="mt-6 bg-[#F3EADC] border-[#C9B896]">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-[#F3EADC] rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#9A7545]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-[#3F2D19]">Understanding Roles & Permissions</h3>
              <p className="text-sm text-[#5E4426] mt-1">
                Roles define what actions users can perform in the system. <strong>System roles</strong> are pre-configured and cannot be deleted, 
                but you can create <strong>custom roles</strong> tailored to your organization's needs. 
                The <strong>default role</strong> is automatically assigned to new users.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <a href="#" className="text-sm font-medium text-[#9A7545] hover:text-[#3F2D19] flex items-center gap-1">
                  Learn more about permissions
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
                <a href="#" className="text-sm font-medium text-[#9A7545] hover:text-[#3F2D19] flex items-center gap-1">
                  Best practices guide
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
