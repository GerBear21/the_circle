import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/layout';
import { Card, Button } from '../../components/ui';
import { UsersIllustration } from '../../components/illustrations/UsersIllustration';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'manager' | 'approver' | 'user';
  department: string;
  position: string;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  last_login?: string;
  phone?: string;
  employee_id: string;
  reports_to?: {
    id: string;
    name: string;
  };
  direct_reports_count: number;
  pending_approvals_count: number;
}

// Mock data for demonstration
const mockUsers: User[] = [
  {
    id: 'u1',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@company.com',
    role: 'admin',
    department: 'Executive',
    position: 'Chief Operations Officer',
    status: 'active',
    created_at: '2023-01-15T08:00:00Z',
    last_login: '2024-12-04T09:30:00Z',
    phone: '+1 (555) 123-4567',
    employee_id: 'EMP-001',
    direct_reports_count: 5,
    pending_approvals_count: 3,
  },
  {
    id: 'u2',
    name: 'Michael Brown',
    email: 'michael.brown@company.com',
    role: 'manager',
    department: 'Finance',
    position: 'Finance Director',
    status: 'active',
    created_at: '2023-02-20T08:00:00Z',
    last_login: '2024-12-04T08:15:00Z',
    phone: '+1 (555) 234-5678',
    employee_id: 'EMP-002',
    reports_to: { id: 'u1', name: 'Sarah Johnson' },
    direct_reports_count: 8,
    pending_approvals_count: 12,
  },
  {
    id: 'u3',
    name: 'Emily Chen',
    email: 'emily.chen@company.com',
    role: 'manager',
    department: 'Design',
    position: 'Design Lead',
    status: 'active',
    created_at: '2023-03-10T08:00:00Z',
    last_login: '2024-12-03T17:45:00Z',
    phone: '+1 (555) 345-6789',
    employee_id: 'EMP-003',
    reports_to: { id: 'u1', name: 'Sarah Johnson' },
    direct_reports_count: 4,
    pending_approvals_count: 2,
  },
  {
    id: 'u4',
    name: 'John Smith',
    email: 'john.smith@company.com',
    role: 'approver',
    department: 'Engineering',
    position: 'Senior Developer',
    status: 'active',
    created_at: '2023-04-05T08:00:00Z',
    last_login: '2024-12-04T10:00:00Z',
    phone: '+1 (555) 456-7890',
    employee_id: 'EMP-004',
    reports_to: { id: 'u5', name: 'Kevin Martinez' },
    direct_reports_count: 0,
    pending_approvals_count: 0,
  },
  {
    id: 'u5',
    name: 'Kevin Martinez',
    email: 'kevin.martinez@company.com',
    role: 'manager',
    department: 'IT',
    position: 'IT Manager',
    status: 'active',
    created_at: '2023-02-01T08:00:00Z',
    last_login: '2024-12-04T07:30:00Z',
    phone: '+1 (555) 567-8901',
    employee_id: 'EMP-005',
    reports_to: { id: 'u1', name: 'Sarah Johnson' },
    direct_reports_count: 12,
    pending_approvals_count: 7,
  },
  {
    id: 'u6',
    name: 'Lisa Wong',
    email: 'lisa.wong@company.com',
    role: 'manager',
    department: 'Human Resources',
    position: 'HR Manager',
    status: 'active',
    created_at: '2023-01-20T08:00:00Z',
    last_login: '2024-12-04T09:00:00Z',
    phone: '+1 (555) 678-9012',
    employee_id: 'EMP-006',
    reports_to: { id: 'u1', name: 'Sarah Johnson' },
    direct_reports_count: 3,
    pending_approvals_count: 5,
  },
  {
    id: 'u7',
    name: 'David Lee',
    email: 'david.lee@company.com',
    role: 'user',
    department: 'Engineering',
    position: 'Cloud Architect',
    status: 'active',
    created_at: '2023-06-15T08:00:00Z',
    last_login: '2024-12-03T16:20:00Z',
    phone: '+1 (555) 789-0123',
    employee_id: 'EMP-007',
    reports_to: { id: 'u5', name: 'Kevin Martinez' },
    direct_reports_count: 0,
    pending_approvals_count: 0,
  },
  {
    id: 'u8',
    name: 'Jessica Taylor',
    email: 'jessica.taylor@company.com',
    role: 'manager',
    department: 'Marketing',
    position: 'Marketing Director',
    status: 'active',
    created_at: '2023-03-25T08:00:00Z',
    last_login: '2024-12-04T08:45:00Z',
    phone: '+1 (555) 890-1234',
    employee_id: 'EMP-008',
    reports_to: { id: 'u1', name: 'Sarah Johnson' },
    direct_reports_count: 6,
    pending_approvals_count: 4,
  },
  {
    id: 'u9',
    name: 'Robert Williams',
    email: 'robert.williams@company.com',
    role: 'approver',
    department: 'Facilities',
    position: 'Facilities Manager',
    status: 'active',
    created_at: '2023-05-10T08:00:00Z',
    last_login: '2024-12-02T14:30:00Z',
    phone: '+1 (555) 901-2345',
    employee_id: 'EMP-009',
    reports_to: { id: 'u2', name: 'Michael Brown' },
    direct_reports_count: 2,
    pending_approvals_count: 1,
  },
  {
    id: 'u10',
    name: 'Amanda Foster',
    email: 'amanda.foster@company.com',
    role: 'user',
    department: 'Human Resources',
    position: 'HR Specialist',
    status: 'inactive',
    created_at: '2023-07-20T08:00:00Z',
    last_login: '2024-11-15T11:00:00Z',
    phone: '+1 (555) 012-3456',
    employee_id: 'EMP-010',
    reports_to: { id: 'u6', name: 'Lisa Wong' },
    direct_reports_count: 0,
    pending_approvals_count: 0,
  },
  {
    id: 'u11',
    name: 'Chris Johnson',
    email: 'chris.johnson@company.com',
    role: 'user',
    department: 'Engineering',
    position: 'DevOps Engineer',
    status: 'active',
    created_at: '2023-08-05T08:00:00Z',
    last_login: '2024-12-04T10:15:00Z',
    phone: '+1 (555) 123-4568',
    employee_id: 'EMP-011',
    reports_to: { id: 'u5', name: 'Kevin Martinez' },
    direct_reports_count: 0,
    pending_approvals_count: 0,
  },
  {
    id: 'u12',
    name: 'Patricia White',
    email: 'patricia.white@company.com',
    role: 'admin',
    department: 'Executive',
    position: 'Chief Financial Officer',
    status: 'active',
    created_at: '2023-01-10T08:00:00Z',
    last_login: '2024-12-04T09:45:00Z',
    phone: '+1 (555) 234-5679',
    employee_id: 'EMP-012',
    direct_reports_count: 3,
    pending_approvals_count: 8,
  },
  {
    id: 'u13',
    name: 'Mark Thompson',
    email: 'mark.thompson@company.com',
    role: 'user',
    department: 'Sales',
    position: 'Account Executive',
    status: 'pending',
    created_at: '2024-12-01T08:00:00Z',
    employee_id: 'EMP-013',
    reports_to: { id: 'u8', name: 'Jessica Taylor' },
    direct_reports_count: 0,
    pending_approvals_count: 0,
  },
];

const roleConfig: Record<string, { label: string; bg: string; text: string }> = {
  admin: { label: 'Admin', bg: 'bg-purple-100', text: 'text-purple-800' },
  manager: { label: 'Manager', bg: 'bg-blue-100', text: 'text-blue-800' },
  approver: { label: 'Approver', bg: 'bg-teal-100', text: 'text-teal-800' },
  user: { label: 'User', bg: 'bg-gray-100', text: 'text-gray-700' },
};

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active: { label: 'Active', bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
  inactive: { label: 'Inactive', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  pending: { label: 'Pending', bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
};

const departmentColors: Record<string, string> = {
  Executive: 'bg-purple-100 text-purple-700',
  Engineering: 'bg-blue-100 text-blue-700',
  Design: 'bg-pink-100 text-pink-700',
  Marketing: 'bg-orange-100 text-orange-700',
  Sales: 'bg-green-100 text-green-700',
  'Human Resources': 'bg-amber-100 text-amber-700',
  IT: 'bg-cyan-100 text-cyan-700',
  Finance: 'bg-emerald-100 text-emerald-700',
  Facilities: 'bg-indigo-100 text-indigo-700',
};

type RoleFilter = 'all' | 'admin' | 'manager' | 'approver' | 'user';
type StatusFilter = 'all' | 'active' | 'inactive' | 'pending';

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setUsers(mockUsers);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.employee_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === 'active').length,
    inactive: users.filter((u) => u.status === 'inactive').length,
    pending: users.filter((u) => u.status === 'pending').length,
    admins: users.filter((u) => u.role === 'admin').length,
    managers: users.filter((u) => u.role === 'manager').length,
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatLastLogin = (dateString?: string) => {
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

  const toggleSelectUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map((u) => u.id));
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
        {/* Header */}
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
              <Button
                variant="primary"
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Add User
              </Button>
            </div>
          </div>
          <div className="hidden md:flex md:col-span-1 justify-center items-center">
            <div className="w-full max-w-[280px]">
              <UsersIllustration />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
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
          <Card className="!p-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </div>
            <div className="text-sm text-gray-500">Pending</div>
          </Card>
          <Card className="!p-4">
            <div className="text-2xl font-bold text-purple-600">{stats.admins}</div>
            <div className="text-sm text-gray-500">Admins</div>
          </Card>
          <Card className="!p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.managers}</div>
            <div className="text-sm text-gray-500">Managers</div>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, department, position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              className="px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="approver">Approver</option>
              <option value="user">User</option>
            </select>
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
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
            <Button variant="secondary" onClick={() => { }} className="text-sm">
              Deactivate
            </Button>
            <Button variant="secondary" onClick={() => { }} className="text-sm">
              Change Role
            </Button>
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
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </div>

        {/* Users List */}
        {filteredUsers.length === 0 ? (
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
                checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span>Select all</span>
            </div>

            {filteredUsers.map((user) => {
              const roleInfo = roleConfig[user.role];
              const statusInfo = statusConfig[user.status];
              const deptColor = departmentColors[user.department] || 'bg-gray-100 text-gray-700';
              const isSelected = selectedUsers.includes(user.id);

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
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          getInitials(user.name)
                        )}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${statusInfo.dot}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Name and Role Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900">{user.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleInfo.bg} ${roleInfo.text}`}>
                              {roleInfo.label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                            {statusInfo.label}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/users/${user.id}`);
                            }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Position and Department */}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-sm text-gray-600">{user.position}</span>
                        <span className="text-gray-300">•</span>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${deptColor}`}>
                          {user.department}
                        </span>
                      </div>

                      {/* Meta Info */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-gray-500">
                        {/* Employee ID */}
                        <span className="flex items-center gap-1 font-mono">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                          </svg>
                          {user.employee_id}
                        </span>
                        {/* Phone */}
                        {user.phone && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {user.phone}
                          </span>
                        )}
                        {/* Reports To */}
                        {user.reports_to && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Reports to: {user.reports_to.name}
                          </span>
                        )}
                        {/* Direct Reports */}
                        {user.direct_reports_count > 0 && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {user.direct_reports_count} direct reports
                          </span>
                        )}
                        {/* Pending Approvals */}
                        {user.pending_approvals_count > 0 && (
                          <span className="flex items-center gap-1 text-yellow-600">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {user.pending_approvals_count} pending approvals
                          </span>
                        )}
                        {/* Last Login */}
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                          </svg>
                          Last login: {formatLastLogin(user.last_login)}
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
