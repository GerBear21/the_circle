import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/layout';
import { Card, Button } from '../../components/ui';

interface Request {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_review' | 'withdrawn' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
  department: string;
  created_at: string;
  updated_at: string;
  current_step: number;
  total_steps: number;
  type: 'approval' | 'capex' | 'leave' | 'expense' | 'procurement' | 'it_request';
  amount?: number;
  currency?: string;
  requester: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    department: string;
    position: string;
  };
  current_approver?: {
    id: string;
    name: string;
    email: string;
  };
  due_date?: string;
  reference_number: string;
  attachments_count: number;
  comments_count: number;
}

// Extended mock data for demonstration
const mockRequests: Request[] = [
  {
    id: '1',
    title: 'New Laptop Purchase Request',
    description: 'Request for MacBook Pro M3 for development work. Current laptop is 5 years old and experiencing performance issues.',
    status: 'pending',
    priority: 'normal',
    category: 'Equipment',
    department: 'Engineering',
    created_at: '2024-12-03T10:30:00Z',
    updated_at: '2024-12-03T10:30:00Z',
    current_step: 1,
    total_steps: 3,
    type: 'approval',
    amount: 2499.99,
    currency: 'USD',
    requester: {
      id: 'u1',
      name: 'John Smith',
      email: 'john.smith@company.com',
      department: 'Engineering',
      position: 'Senior Developer',
    },
    current_approver: {
      id: 'u2',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@company.com',
    },
    due_date: '2024-12-10T23:59:59Z',
    reference_number: 'REQ-2024-001234',
    attachments_count: 2,
    comments_count: 3,
  },
  {
    id: '2',
    title: 'Software License - Adobe Creative Suite',
    description: 'Annual subscription renewal for design team. 5 licenses required for the creative department.',
    status: 'in_review',
    priority: 'high',
    category: 'Software',
    department: 'Design',
    created_at: '2024-12-02T14:15:00Z',
    updated_at: '2024-12-03T09:00:00Z',
    current_step: 2,
    total_steps: 3,
    type: 'approval',
    amount: 3599.95,
    currency: 'USD',
    requester: {
      id: 'u3',
      name: 'Emily Chen',
      email: 'emily.chen@company.com',
      department: 'Design',
      position: 'Design Lead',
    },
    current_approver: {
      id: 'u4',
      name: 'Michael Brown',
      email: 'michael.brown@company.com',
    },
    due_date: '2024-12-08T23:59:59Z',
    reference_number: 'REQ-2024-001233',
    attachments_count: 1,
    comments_count: 5,
  },
  {
    id: '3',
    title: 'Office Renovation Project',
    description: 'CAPEX request for office space renovation including new furniture, lighting, and HVAC upgrades for the 3rd floor.',
    status: 'approved',
    priority: 'normal',
    category: 'Infrastructure',
    department: 'Facilities',
    created_at: '2024-11-28T08:00:00Z',
    updated_at: '2024-12-01T16:30:00Z',
    current_step: 3,
    total_steps: 3,
    type: 'capex',
    amount: 125000,
    currency: 'USD',
    requester: {
      id: 'u5',
      name: 'Robert Williams',
      email: 'robert.williams@company.com',
      department: 'Facilities',
      position: 'Facilities Manager',
    },
    reference_number: 'CAPEX-2024-000089',
    attachments_count: 8,
    comments_count: 12,
  },
  {
    id: '4',
    title: 'Conference Travel Expenses',
    description: 'Reimbursement for AWS re:Invent 2024 conference attendance including flights, hotel, and meals.',
    status: 'rejected',
    priority: 'low',
    category: 'Travel',
    department: 'Engineering',
    created_at: '2024-11-25T11:45:00Z',
    updated_at: '2024-11-27T14:20:00Z',
    current_step: 2,
    total_steps: 2,
    type: 'expense',
    amount: 4250.00,
    currency: 'USD',
    requester: {
      id: 'u6',
      name: 'David Lee',
      email: 'david.lee@company.com',
      department: 'Engineering',
      position: 'Cloud Architect',
    },
    reference_number: 'EXP-2024-002156',
    attachments_count: 5,
    comments_count: 2,
  },
  {
    id: '5',
    title: 'Marketing Campaign Budget',
    description: 'Q1 2025 digital marketing campaign budget for product launch including social media ads, influencer partnerships, and PPC.',
    status: 'pending',
    priority: 'urgent',
    category: 'Marketing',
    department: 'Marketing',
    created_at: '2024-12-04T09:00:00Z',
    updated_at: '2024-12-04T09:00:00Z',
    current_step: 1,
    total_steps: 4,
    type: 'approval',
    amount: 75000,
    currency: 'USD',
    requester: {
      id: 'u7',
      name: 'Jessica Taylor',
      email: 'jessica.taylor@company.com',
      department: 'Marketing',
      position: 'Marketing Director',
    },
    current_approver: {
      id: 'u8',
      name: 'Thomas Anderson',
      email: 'thomas.anderson@company.com',
    },
    due_date: '2024-12-06T23:59:59Z',
    reference_number: 'REQ-2024-001235',
    attachments_count: 3,
    comments_count: 0,
  },
  {
    id: '6',
    title: 'Annual Leave Request - Holiday Season',
    description: 'Requesting 5 days of annual leave from December 23rd to December 27th for holiday travel.',
    status: 'approved',
    priority: 'normal',
    category: 'Time Off',
    department: 'Human Resources',
    created_at: '2024-11-20T09:30:00Z',
    updated_at: '2024-11-21T11:00:00Z',
    current_step: 2,
    total_steps: 2,
    type: 'leave',
    requester: {
      id: 'u9',
      name: 'Amanda Foster',
      email: 'amanda.foster@company.com',
      department: 'Human Resources',
      position: 'HR Specialist',
    },
    reference_number: 'LV-2024-000456',
    attachments_count: 0,
    comments_count: 1,
  },
  {
    id: '7',
    title: 'Server Infrastructure Upgrade',
    description: 'Procurement of new server hardware for data center expansion. Includes 4 rack servers and networking equipment.',
    status: 'in_review',
    priority: 'high',
    category: 'IT Infrastructure',
    department: 'IT',
    created_at: '2024-12-01T15:00:00Z',
    updated_at: '2024-12-03T10:00:00Z',
    current_step: 2,
    total_steps: 4,
    type: 'procurement',
    amount: 89500,
    currency: 'USD',
    requester: {
      id: 'u10',
      name: 'Kevin Martinez',
      email: 'kevin.martinez@company.com',
      department: 'IT',
      position: 'IT Manager',
    },
    current_approver: {
      id: 'u11',
      name: 'Patricia White',
      email: 'patricia.white@company.com',
    },
    due_date: '2024-12-15T23:59:59Z',
    reference_number: 'PROC-2024-000234',
    attachments_count: 6,
    comments_count: 8,
  },
  {
    id: '8',
    title: 'New Employee Onboarding Equipment',
    description: 'IT equipment request for 3 new hires starting January 2025. Includes laptops, monitors, and peripherals.',
    status: 'pending',
    priority: 'normal',
    category: 'Equipment',
    department: 'IT',
    created_at: '2024-12-04T11:30:00Z',
    updated_at: '2024-12-04T11:30:00Z',
    current_step: 1,
    total_steps: 2,
    type: 'it_request',
    amount: 7500,
    currency: 'USD',
    requester: {
      id: 'u12',
      name: 'Lisa Wong',
      email: 'lisa.wong@company.com',
      department: 'Human Resources',
      position: 'HR Manager',
    },
    current_approver: {
      id: 'u10',
      name: 'Kevin Martinez',
      email: 'kevin.martinez@company.com',
    },
    due_date: '2024-12-20T23:59:59Z',
    reference_number: 'IT-2024-003421',
    attachments_count: 1,
    comments_count: 0,
  },
  {
    id: '9',
    title: 'Client Entertainment Expenses',
    description: 'Expense claim for client dinner meeting at The Capital Grille with Acme Corp representatives.',
    status: 'withdrawn',
    priority: 'low',
    category: 'Entertainment',
    department: 'Sales',
    created_at: '2024-11-18T16:00:00Z',
    updated_at: '2024-11-19T09:00:00Z',
    current_step: 1,
    total_steps: 2,
    type: 'expense',
    amount: 485.50,
    currency: 'USD',
    requester: {
      id: 'u13',
      name: 'Mark Thompson',
      email: 'mark.thompson@company.com',
      department: 'Sales',
      position: 'Account Executive',
    },
    reference_number: 'EXP-2024-002145',
    attachments_count: 2,
    comments_count: 1,
  },
  {
    id: '10',
    title: 'Training Program Enrollment',
    description: 'Request to enroll in AWS Solutions Architect Professional certification training program.',
    status: 'approved',
    priority: 'normal',
    category: 'Training',
    department: 'Engineering',
    created_at: '2024-11-15T10:00:00Z',
    updated_at: '2024-11-18T14:30:00Z',
    current_step: 2,
    total_steps: 2,
    type: 'approval',
    amount: 1200,
    currency: 'USD',
    requester: {
      id: 'u14',
      name: 'Chris Johnson',
      email: 'chris.johnson@company.com',
      department: 'Engineering',
      position: 'DevOps Engineer',
    },
    reference_number: 'TRN-2024-000089',
    attachments_count: 1,
    comments_count: 2,
  },
];

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending: { label: 'Pending', bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  in_review: { label: 'In Review', bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
  approved: { label: 'Approved', bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
  rejected: { label: 'Rejected', bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
  withdrawn: { label: 'Withdrawn', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  cancelled: { label: 'Cancelled', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: 'text-gray-600', bg: 'bg-gray-100' },
  normal: { label: 'Normal', color: 'text-blue-600', bg: 'bg-blue-50' },
  high: { label: 'High', color: 'text-orange-600', bg: 'bg-orange-50' },
  urgent: { label: 'Urgent', color: 'text-red-600', bg: 'bg-red-50' },
};

const typeConfig: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  approval: { label: 'Approval', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-brand-600', bg: 'bg-brand-100' },
  capex: { label: 'CAPEX', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-purple-600', bg: 'bg-purple-100' },
  leave: { label: 'Leave', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'text-teal-600', bg: 'bg-teal-100' },
  expense: { label: 'Expense', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', color: 'text-green-600', bg: 'bg-green-100' },
  procurement: { label: 'Procurement', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', color: 'text-indigo-600', bg: 'bg-indigo-100' },
  it_request: { label: 'IT Request', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'text-cyan-600', bg: 'bg-cyan-100' },
};

const departmentColors: Record<string, string> = {
  Engineering: 'bg-blue-100 text-blue-700',
  Design: 'bg-pink-100 text-pink-700',
  Marketing: 'bg-purple-100 text-purple-700',
  Sales: 'bg-green-100 text-green-700',
  'Human Resources': 'bg-orange-100 text-orange-700',
  IT: 'bg-cyan-100 text-cyan-700',
  Facilities: 'bg-amber-100 text-amber-700',
  Finance: 'bg-emerald-100 text-emerald-700',
};

type StatusFilter = 'all' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'withdrawn';
type TypeFilter = 'all' | 'approval' | 'capex' | 'leave' | 'expense' | 'procurement' | 'it_request';
type SortOption = 'newest' | 'oldest' | 'amount_high' | 'amount_low' | 'priority';

export default function AllRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'compact'>('list');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRequests(mockRequests);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const filteredRequests = requests
    .filter((req) => {
      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
      const matchesType = typeFilter === 'all' || req.type === typeFilter;
      const matchesSearch =
        req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.reference_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.requester.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.department.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesType && matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'amount_high':
          return (b.amount || 0) - (a.amount || 0);
        case 'amount_low':
          return (a.amount || 0) - (b.amount || 0);
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        default:
          return 0;
      }
    });

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'pending' || r.status === 'in_review').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
    totalAmount: requests.reduce((sum, r) => sum + (r.amount || 0), 0),
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getDueStatus = (dueDate?: string) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: 'Overdue', className: 'text-red-600 bg-red-50', urgent: true };
    } else if (diffDays === 0) {
      return { label: 'Due today', className: 'text-orange-600 bg-orange-50', urgent: true };
    } else if (diffDays === 1) {
      return { label: 'Due tomorrow', className: 'text-yellow-600 bg-yellow-50', urgent: false };
    } else if (diffDays <= 3) {
      return { label: `Due in ${diffDays} days`, className: 'text-blue-600 bg-blue-50', urgent: false };
    }
    return null;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (status === 'loading' || loading) {
    return (
      <AppLayout title="All Requests">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="All Requests">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-heading">All Requests</h1>
            <p className="text-gray-500 mt-1">View and manage all organization requests</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {(statusFilter !== 'all' || typeFilter !== 'all') && (
                <span className="w-2 h-2 bg-brand-500 rounded-full" />
              )}
            </Button>
            <Button
              variant="primary"
              onClick={() => router.push('/requests/new')}
              className="flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Request
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <Card className="!p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Total Requests</div>
          </Card>
          <Card className="!p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-gray-500">In Progress</div>
          </Card>
          <Card className="!p-4">
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <div className="text-sm text-gray-500">Approved</div>
          </Card>
          <Card className="!p-4">
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <div className="text-sm text-gray-500">Rejected</div>
          </Card>
          <Card className="!p-4 col-span-2 sm:col-span-1">
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</div>
            <div className="text-sm text-gray-500">Total Value</div>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by title, reference, requester, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="amount_high">Highest Amount</option>
                <option value="amount_low">Lowest Amount</option>
                <option value="priority">Priority</option>
              </select>
              {/* View Mode Toggle */}
              <div className="hidden sm:flex items-center border border-gray-300 rounded-xl overflow-hidden">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2.5 ${viewMode === 'list' ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('compact')}
                  className={`p-2.5 ${viewMode === 'compact' ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <Card className="!p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'pending', 'in_review', 'approved', 'rejected', 'withdrawn'] as StatusFilter[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          statusFilter === s
                            ? 'bg-brand-100 text-brand-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {s === 'all' ? 'All' : statusConfig[s]?.label || s}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Request Type</label>
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'approval', 'capex', 'expense', 'leave', 'procurement', 'it_request'] as TypeFilter[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTypeFilter(t)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          typeFilter === t
                            ? 'bg-brand-100 text-brand-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {t === 'all' ? 'All' : typeConfig[t]?.label || t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Clear Filters */}
              {(statusFilter !== 'all' || typeFilter !== 'all') && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setStatusFilter('all');
                      setTypeFilter('all');
                    }}
                    className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            Showing {filteredRequests.length} of {requests.length} requests
          </p>
        </div>

        {/* Requests List */}
        {filteredRequests.length === 0 ? (
          <Card className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-600 mb-1">No requests found</h3>
            <p className="text-gray-400 mb-4">
              {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'No requests have been submitted yet'}
            </p>
            {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                }}
              >
                Clear filters
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((request) => {
              const statusInfo = statusConfig[request.status];
              const priorityInfo = priorityConfig[request.priority];
              const typeInfo = typeConfig[request.type];
              const dueStatus = getDueStatus(request.due_date);
              const deptColor = departmentColors[request.department] || 'bg-gray-100 text-gray-700';

              return (
                <Card
                  key={request.id}
                  variant="outlined"
                  className="cursor-pointer hover:shadow-card-hover transition-shadow"
                  onClick={() => router.push(`/requests/${request.id}`)}
                >
                  <div className="flex items-start gap-4">
                    {/* Type Icon */}
                    <div className={`w-10 h-10 ${typeInfo.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <svg className={`w-5 h-5 ${typeInfo.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeInfo.icon} />
                      </svg>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-gray-900 truncate">{request.title}</h3>
                            <span className="text-xs text-gray-400 font-mono">{request.reference_number}</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{request.description}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                            {statusInfo.label}
                          </span>
                          {request.amount && (
                            <span className="text-sm font-semibold text-gray-900">
                              {formatCurrency(request.amount, request.currency)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Requester Info */}
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                            {getInitials(request.requester.name)}
                          </div>
                          <span className="text-sm text-gray-700">{request.requester.name}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">{request.requester.position}</span>
                        </div>
                      </div>

                      {/* Meta Info */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3">
                        {/* Department */}
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${deptColor}`}>
                          {request.department}
                        </span>
                        {/* Category */}
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          {request.category}
                        </span>
                        {/* Priority */}
                        <span className={`flex items-center gap-1 text-xs font-medium ${priorityInfo.color}`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                          </svg>
                          {priorityInfo.label}
                        </span>
                        {/* Date */}
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatDate(request.created_at)}
                        </span>
                        {/* Due Status */}
                        {dueStatus && (
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${dueStatus.className}`}>
                            {dueStatus.label}
                          </span>
                        )}
                        {/* Attachments */}
                        {request.attachments_count > 0 && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            {request.attachments_count}
                          </span>
                        )}
                        {/* Comments */}
                        {request.comments_count > 0 && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {request.comments_count}
                          </span>
                        )}
                      </div>

                      {/* Progress Bar for pending/in_review */}
                      {(request.status === 'pending' || request.status === 'in_review') && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>Step {request.current_step} of {request.total_steps}</span>
                            {request.current_approver && (
                              <span>Awaiting: {request.current_approver.name}</span>
                            )}
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full transition-all"
                              style={{ width: `${(request.current_step / request.total_steps) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
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
