import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/layout';
import { Card, Button } from '../../components/ui';

interface Request {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_review' | 'withdrawn';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
  created_at: string;
  updated_at: string;
  current_step: number;
  total_steps: number;
  type: 'approval' | 'capex' | 'leave' | 'expense';
}

// Mock data for demonstration
const mockRequests: Request[] = [
  {
    id: '1',
    title: 'New Laptop Purchase Request',
    description: 'Request for MacBook Pro for development work',
    status: 'pending',
    priority: 'normal',
    category: 'Equipment',
    created_at: '2024-12-03T10:30:00Z',
    updated_at: '2024-12-03T10:30:00Z',
    current_step: 1,
    total_steps: 3,
    type: 'approval',
  },
  {
    id: '2',
    title: 'Software License - Adobe Creative Suite',
    description: 'Annual subscription for design team',
    status: 'in_review',
    priority: 'high',
    category: 'Software',
    created_at: '2024-12-02T14:15:00Z',
    updated_at: '2024-12-03T09:00:00Z',
    current_step: 2,
    total_steps: 3,
    type: 'approval',
  },
  {
    id: '3',
    title: 'Office Renovation Project',
    description: 'CAPEX request for office space renovation',
    status: 'approved',
    priority: 'normal',
    category: 'Infrastructure',
    created_at: '2024-11-28T08:00:00Z',
    updated_at: '2024-12-01T16:30:00Z',
    current_step: 3,
    total_steps: 3,
    type: 'capex',
  },
  {
    id: '4',
    title: 'Conference Travel Expenses',
    description: 'Reimbursement for tech conference attendance',
    status: 'rejected',
    priority: 'low',
    category: 'Travel',
    created_at: '2024-11-25T11:45:00Z',
    updated_at: '2024-11-27T14:20:00Z',
    current_step: 2,
    total_steps: 2,
    type: 'expense',
  },
  {
    id: '5',
    title: 'Marketing Campaign Budget',
    description: 'Q1 2025 digital marketing campaign',
    status: 'pending',
    priority: 'urgent',
    category: 'Marketing',
    created_at: '2024-12-04T09:00:00Z',
    updated_at: '2024-12-04T09:00:00Z',
    current_step: 1,
    total_steps: 4,
    type: 'approval',
  },
];

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: 'bg-warning-100', text: 'text-warning-700' },
  in_review: { label: 'In Review', bg: 'bg-primary-100', text: 'text-primary-700' },
  approved: { label: 'Approved', bg: 'bg-success-100', text: 'text-success-700' },
  rejected: { label: 'Rejected', bg: 'bg-danger-100', text: 'text-danger-700' },
  withdrawn: { label: 'Withdrawn', bg: 'bg-gray-100', text: 'text-gray-600' },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-gray-500' },
  normal: { label: 'Normal', color: 'text-primary-600' },
  high: { label: 'High', color: 'text-warning-600' },
  urgent: { label: 'Urgent', color: 'text-danger-600' },
};

const typeConfig: Record<string, { label: string; icon: string }> = {
  approval: { label: 'Approval', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  capex: { label: 'CAPEX', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  leave: { label: 'Leave', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  expense: { label: 'Expense', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
};

export default function MyRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => {
      setRequests(mockRequests);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const filteredRequests = requests.filter((req) => {
    const matchesFilter = filter === 'all' || req.status === filter || (filter === 'pending' && req.status === 'in_review');
    const matchesSearch = req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending' || r.status === 'in_review').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
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

  if (status === 'loading' || loading) {
    return (
      <AppLayout title="My Requests">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="My Requests">
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-heading">My Requests</h1>
            <p className="text-text-secondary mt-1">Track and manage your submitted requests</p>
          </div>
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="!p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('all')}>
            <div className={`text-2xl font-bold ${filter === 'all' ? 'text-primary-600' : 'text-text-primary'}`}>{stats.total}</div>
            <div className="text-sm text-text-secondary">Total Requests</div>
          </Card>
          <Card className="!p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('pending')}>
            <div className={`text-2xl font-bold ${filter === 'pending' ? 'text-warning-600' : 'text-warning-600'}`}>{stats.pending}</div>
            <div className="text-sm text-text-secondary">Pending</div>
          </Card>
          <Card className="!p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('approved')}>
            <div className={`text-2xl font-bold ${filter === 'approved' ? 'text-success-600' : 'text-success-600'}`}>{stats.approved}</div>
            <div className="text-sm text-text-secondary">Approved</div>
          </Card>
          <Card className="!p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('rejected')}>
            <div className={`text-2xl font-bold ${filter === 'rejected' ? 'text-danger-600' : 'text-danger-600'}`}>{stats.rejected}</div>
            <div className="text-sm text-text-secondary">Rejected</div>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Requests List */}
        {filteredRequests.length === 0 ? (
          <Card className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-600 mb-1">No requests found</h3>
            <p className="text-gray-400 mb-4">
              {searchQuery ? 'Try adjusting your search terms' : 'Create your first request to get started'}
            </p>
            {!searchQuery && (
              <Button variant="primary" onClick={() => router.push('/requests/new')}>
                Create Request
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((request) => {
              const statusInfo = statusConfig[request.status];
              const priorityInfo = priorityConfig[request.priority];
              const typeInfo = typeConfig[request.type];

              return (
                <Card
                  key={request.id}
                  variant="outlined"
                  className="cursor-pointer hover:shadow-md hover:border-primary-200 transition-all"
                  onClick={() => router.push(`/requests/${request.id}`)}
                >
                  <div className="flex items-start gap-4">
                    {/* Type Icon */}
                    <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeInfo.icon} />
                      </svg>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-text-primary truncate">{request.title}</h3>
                          <p className="text-sm text-text-secondary mt-0.5 line-clamp-1">{request.description}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${statusInfo.bg} ${statusInfo.text}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      {/* Meta Info */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          {request.category}
                        </span>
                        <span className={`flex items-center gap-1 ${priorityInfo.color}`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                          </svg>
                          {priorityInfo.label}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatDate(request.created_at)}
                        </span>
                        {request.status !== 'approved' && request.status !== 'rejected' && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Step {request.current_step} of {request.total_steps}
                          </span>
                        )}
                      </div>

                      {/* Progress Bar for pending/in_review */}
                      {(request.status === 'pending' || request.status === 'in_review') && (
                        <div className="mt-3">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-full transition-all"
                              style={{ width: `${(request.current_step / request.total_steps) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
