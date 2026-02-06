import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '../../components/layout';
import { Card, Button } from '../../components/ui';
import { motion, AnimatePresence } from 'framer-motion';

interface Request {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_review' | 'withdrawn' | 'draft' | 'cancelled';
  priority?: string;
  category?: string;
  created_at: string;
  updated_at: string;
  current_step?: number;
  total_steps?: number;
  type?: string;
  metadata?: {
    priority?: string;
    requestType?: string;
    amount?: number;
    currency?: string;
    [key: string]: any;
  };
  current_approver?: {
    id: string;
    name: string;
    email: string;
  } | null;
  attachments_count?: number;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  draft: number;
}

function getRequestDetailPath(request: Request): string {
  const requestType = request.type || request.metadata?.type || request.metadata?.requestType;
  if (requestType === 'hotel_booking') {
    return `/requests/comp/${request.id}`;
  }
  return `/requests/${request.id}`;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; ring: string }> = {
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  in_review: { label: 'In Review', bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
  approved: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200' },
  withdrawn: { label: 'Withdrawn', bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200' },
  cancelled: { label: 'Cancelled', bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200' },
  draft: { label: 'Draft', bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-200' },
};

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: 'text-slate-600', bg: 'bg-slate-100' },
  normal: { label: 'Normal', color: 'text-blue-600', bg: 'bg-blue-50' },
  medium: { label: 'Medium', color: 'text-blue-600', bg: 'bg-blue-50' },
  high: { label: 'High', color: 'text-amber-600', bg: 'bg-amber-50' },
  urgent: { label: 'Urgent', color: 'text-red-600', bg: 'bg-red-50' },
  critical: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-100' },
};

const defaultPriority = { label: 'Normal', color: 'text-slate-500', bg: 'bg-slate-50' };

const typeConfig: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  approval: { label: 'Approval', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-blue-600', bg: 'bg-blue-100' },
  capex: { label: 'CAPEX', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-purple-600', bg: 'bg-purple-100' },
  leave: { label: 'Leave', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'text-teal-600', bg: 'bg-teal-100' },
  expense: { label: 'Expense', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-emerald-600', bg: 'bg-emerald-100' },
  procurement: { label: 'Procurement', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', color: 'text-indigo-600', bg: 'bg-indigo-100' },
  it_request: { label: 'IT Request', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'text-cyan-600', bg: 'bg-cyan-100' },
  hotel_booking: { label: 'Hotel Booking', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', color: 'text-amber-600', bg: 'bg-amber-100' },
};

const defaultType = { label: 'Request', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-gray-600', bg: 'bg-gray-100' };

type TabType = 'draft' | 'rejected' | 'history' | 'pending' | 'all' | 'approved';

const tabs: { id: TabType; label: string }[] = [
  { id: 'all', label: 'All Requests' },
  { id: 'approved', label: 'Approved' },
  { id: 'draft', label: 'Drafts' },
  { id: 'pending', label: 'Pending' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'history', label: 'Request History' },
];

export default function MyRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0, draft: 0 });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchMyRequests() {
      if (status !== 'authenticated') return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/requests/my-requests');

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch requests');
        }

        const data = await response.json();
        setRequests(data.requests || []);
        setStats(data.stats || { total: 0, pending: 0, approved: 0, rejected: 0, draft: 0 });
      } catch (err: any) {
        console.error('Error fetching requests:', err);
        setError(err.message || 'Failed to load requests');
      } finally {
        setLoading(false);
      }
    }

    fetchMyRequests();
  }, [status]);

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Tab Filtering
      let matchesTab = false;
      switch (activeTab) {
        case 'draft':
          matchesTab = req.status === 'draft';
          break;
        case 'approved':
          matchesTab = req.status === 'approved';
          break;
        case 'rejected':
          matchesTab = req.status === 'rejected';
          break;
        case 'history':
          matchesTab = ['approved', 'withdrawn', 'cancelled'].includes(req.status);
          break;
        case 'pending':
          matchesTab = ['pending', 'in_review'].includes(req.status);
          break;
        case 'all':
          matchesTab = true;
          break;
      }

      // Search Filtering
      const matchesSearch =
        req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.category || '').toLowerCase().includes(searchQuery.toLowerCase());

      return matchesTab && matchesSearch;
    });
  }, [requests, activeTab, searchQuery]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
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
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight font-heading">My Requests</h1>
            <p className="text-gray-500 mt-2 text-lg">Track and manage your submitted requests</p>
          </div>
          <Button
            variant="primary"
            onClick={() => router.push('/requests/new')}
            className="flex items-center gap-2 shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-all px-6 py-2.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Request
          </Button>
        </div>

        {/* Tabs & Search */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
            {/* Tabs */}
            <div className="flex p-1 bg-gray-50/80 rounded-xl w-full sm:w-auto overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap min-w-[100px] ${activeTab === tab.id
                    ? 'text-primary-700 bg-white shadow-sm ring-1 ring-black/5'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400 text-sm transition-all"
              />
            </div>
          </div>
        </div>

        {/* Requests Grid */}
        <div className="min-h-[400px]">
          {filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No requests found</h3>
              <p className="text-gray-500 mb-6">
                {searchQuery ? `No requests matching "${searchQuery}"` : `No ${activeTab === 'all' ? '' : activeTab} requests found`}
              </p>
              {!searchQuery && activeTab !== 'draft' && (
                <Button variant="secondary" onClick={() => router.push('/requests/new')}>
                  Start a New Request
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              <AnimatePresence mode='wait'>
                {filteredRequests.map((request, index) => {
                  const statusInfo = statusConfig[request.status] || statusConfig['pending'];
                  const priority = request.priority || request.metadata?.priority || 'normal';
                  const priorityInfo = priorityConfig[priority] || defaultPriority;
                  const requestType = request.type || request.metadata?.requestType || 'approval';
                  const typeInfo = typeConfig[requestType] || defaultType;
                  const amount = request.metadata?.amount;
                  const currency = request.metadata?.currency;

                  return (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      <Card
                        className="group cursor-pointer hover:shadow-lg hover:border-primary-200/50 transition-all duration-300 overflow-hidden border-gray-200/60"
                        onClick={() => router.push(getRequestDetailPath(request))}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-1">
                          {/* Icon Column */}
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${typeInfo.bg} group-hover:scale-105 duration-300`}>
                            <svg className={`w-6 h-6 ${typeInfo.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeInfo.icon} />
                            </svg>
                          </div>

                          {/* Main Content */}
                          <div className="flex-1 min-w-0 grid sm:grid-cols-4 gap-4 items-center">

                            {/* Title & Type */}
                            <div className="sm:col-span-2">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-semibold uppercase tracking-wider ${typeInfo.color}`}>
                                  {typeInfo.label}
                                </span>
                                {(request.current_step && request.total_steps) ? (
                                  <span className="text-xs text-gray-400">• Step {request.current_step} of {request.total_steps}</span>
                                ) : null}
                              </div>
                              <h3 className="font-bold text-gray-900 truncate text-lg group-hover:text-primary-600 transition-colors">
                                {request.title}
                              </h3>
                              <div className="flex items-center gap-3 mt-1">
                                <p className="text-sm text-gray-500 line-clamp-1 flex-1">
                                  {request.description || 'No description provided'}
                                </p>
                                {request.attachments_count ? (
                                  <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 flex-shrink-0" title={`${request.attachments_count} attachments`}>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    {request.attachments_count}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {/* Priority & Date */}
                            <div className="flex flex-row sm:flex-col items-center sm:items-start gap-3 sm:gap-1 text-sm text-gray-500">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityInfo.bg} ${priorityInfo.color}`}>
                                  {priorityInfo.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {formatDate(request.created_at)}
                              </div>
                            </div>

                            {/* Status & Amount */}
                            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 sm:gap-1">
                              <div className={`px-3 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${statusInfo.bg} ${statusInfo.text} ${statusInfo.ring}`}>
                                {statusInfo.label}
                              </div>
                              {amount && (
                                <span className="font-semibold text-gray-900">
                                  {formatCurrency(amount, currency)}
                                </span>
                              )}
                            </div>

                          </div>

                          {/* Chevron */}
                          <div className="hidden sm:block text-gray-300 group-hover:text-primary-400 group-hover:translate-x-1 transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>

                        {/* Progress Bar (Only for pending) */}
                        {['pending', 'in_review'].includes(request.status) && request.total_steps && (
                          <div className="mt-4 pt-3 border-t border-gray-100/50">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${((request.current_step || 0) / (request.total_steps || 1)) * 100}%` }}
                                  className="h-full bg-primary-500 rounded-full"
                                  transition={{ duration: 0.5, ease: "easeOut" }}
                                />
                              </div>
                              <span className="text-xs font-medium text-gray-500">
                                {Math.round(((request.current_step || 0) / (request.total_steps || 1)) * 100)}%
                              </span>
                            </div>
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
