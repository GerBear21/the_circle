import { useRouter } from 'next/router';
import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui';
import {
  Search,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar,
  Paperclip,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { formatDate } from '@/lib/formatDate';

export type RequestsMode = 'tracking' | 'drafts' | 'history';

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
  completed_steps?: number;
  type?: string;
  metadata?: {
    priority?: string;
    requestType?: string;
    amount?: number;
    currency?: string;
    referenceCode?: string;
    [key: string]: any;
  };
  current_approver?: { id: string; name: string; email: string } | null;
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
  if (requestType === 'hotel_booking' || requestType === 'voucher_request') {
    return `/requests/comp/${request.id}`;
  }
  return `/requests/${request.id}`;
}

// Status pills keep a subtle, semantic tint — they are labels, not icons.
const statusConfig: Record<string, { label: string; bg: string; text: string; ring: string }> = {
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-100' },
  in_review: { label: 'In Review', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-100' },
  approved: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-100' },
  rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-100' },
  withdrawn: { label: 'Withdrawn', bg: 'bg-neutral-100', text: 'text-neutral-600', ring: 'ring-neutral-200' },
  cancelled: { label: 'Cancelled', bg: 'bg-neutral-100', text: 'text-neutral-600', ring: 'ring-neutral-200' },
  draft: { label: 'Draft', bg: 'bg-neutral-100', text: 'text-neutral-600', ring: 'ring-neutral-200' },
};

const typeLabels: Record<string, string> = {
  approval: 'Approval',
  capex: 'CAPEX',
  leave: 'Leave',
  expense: 'Expense',
  procurement: 'Procurement',
  it_request: 'IT Request',
  hotel_booking: 'Hotel Booking',
  petty_cash: 'Petty Cash',
  voucher_request: 'Voucher',
  travel_authorization: 'Travel',
};

function formatCurrency(amount: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

const MODE_CONFIG: Record<RequestsMode, { title: string; subtitle: string; statuses?: string[] }> = {
  tracking: {
    title: 'Track Requests',
    subtitle: 'Monitor the status of your submitted requests.',
  },
  drafts: {
    title: 'My Drafts',
    subtitle: 'Continue working on requests you have saved but not yet submitted.',
    statuses: ['draft'],
  },
  history: {
    title: 'Request History',
    subtitle: 'A record of your completed, withdrawn and cancelled requests.',
    statuses: ['approved', 'rejected', 'withdrawn', 'cancelled'],
  },
};

type TrackTab = 'all' | 'pending' | 'approved' | 'rejected';
const trackTabs: { id: TrackTab; label: string; statuses: string[] }[] = [
  { id: 'all', label: 'All', statuses: ['pending', 'in_review', 'approved', 'rejected'] },
  { id: 'pending', label: 'Pending', statuses: ['pending', 'in_review'] },
  { id: 'approved', label: 'Approved', statuses: ['approved'] },
  { id: 'rejected', label: 'Rejected', statuses: ['rejected'] },
];

export default function RequestsView({ mode }: { mode: RequestsMode }) {
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TrackTab>('all');
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0, draft: 0 });

  const cfg = MODE_CONFIG[mode];

  useEffect(() => {
    let active = true;
    async function fetchMyRequests() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/requests/my-requests');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch requests');
        }
        const data = await response.json();
        if (!active) return;
        setRequests(data.requests || []);
        setStats(data.stats || { total: 0, pending: 0, approved: 0, rejected: 0, draft: 0 });
      } catch (err: any) {
        if (active) setError(err.message || 'Failed to load requests');
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchMyRequests();
    return () => { active = false; };
  }, []);

  const statsCards: { label: string; value: number; Icon: LucideIcon; tab: TrackTab }[] = [
    { label: 'Total', value: stats.total, Icon: FileText, tab: 'all' },
    { label: 'Pending', value: stats.pending, Icon: Clock, tab: 'pending' },
    { label: 'Approved', value: stats.approved, Icon: CheckCircle2, tab: 'approved' },
    { label: 'Rejected', value: stats.rejected, Icon: XCircle, tab: 'rejected' },
  ];

  const filteredRequests = useMemo(() => {
    const allowedStatuses = mode === 'tracking'
      ? trackTabs.find(t => t.id === activeTab)!.statuses
      : cfg.statuses!;

    return requests.filter((req) => {
      if (!allowedStatuses.includes(req.status)) return false;
      const q = searchQuery.toLowerCase();
      if (!q) return true;
      const refCode = (req.metadata?.referenceCode || '') as string;
      return (
        req.title.toLowerCase().includes(q) ||
        (req.description || '').toLowerCase().includes(q) ||
        (req.category || '').toLowerCase().includes(q) ||
        refCode.toLowerCase().includes(q)
      );
    });
  }, [requests, mode, activeTab, searchQuery, cfg.statuses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">{cfg.title}</h1>
          <p className="text-text-secondary mt-1.5 text-sm sm:text-base">{cfg.subtitle}</p>
        </div>
        <Button variant="primary" onClick={() => router.push('/requests/new')} className="flex items-center gap-2 shrink-0">
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          New Request
        </Button>
      </div>

      {error && (
        <div className="bg-danger-50 border border-danger-100 text-danger-600 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {/* Stats (tracking only) */}
      {mode === 'tracking' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {statsCards.map(({ label, value, Icon, tab }) => (
            <button
              key={label}
              onClick={() => setActiveTab(tab)}
              className={`text-left bg-white rounded-2xl p-4 border transition-all hover:shadow-card-hover ${activeTab === tab ? 'border-primary-300 ring-1 ring-primary-100' : 'border-border'}`}
            >
              <span className="text-neutral-700 flex items-center justify-center w-9 h-9">
                <Icon className="w-[20px] h-[20px]" strokeWidth={1.5} />
              </span>
              <p className="text-2xl font-bold text-text-primary mt-2 tabular-nums">{value}</p>
              <p className="text-xs text-text-secondary">{label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Tabs (tracking) + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {mode === 'tracking' ? (
          <div className="flex p-1 bg-neutral-100 rounded-full w-full sm:w-auto overflow-x-auto">
            {trackTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-text-primary shadow-soft' : 'text-text-secondary hover:text-text-primary'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm text-text-secondary font-medium">
            {filteredRequests.length} {filteredRequests.length === 1 ? 'request' : 'requests'}
          </span>
        )}

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Search requests"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 h-10 bg-neutral-100 border border-transparent rounded-full text-sm text-text-primary placeholder:text-text-muted focus:bg-white focus:border-primary-300 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="min-h-[300px]">
        {filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-border">
            <div className="w-14 h-14 bg-neutral-100 rounded-full flex items-center justify-center mb-4 text-text-muted">
              <FileText className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-1">No requests found</h3>
            <p className="text-sm text-text-secondary mb-5">
              {searchQuery ? `No requests matching "${searchQuery}"` : `You have no ${cfg.title.toLowerCase()} yet.`}
            </p>
            {mode !== 'drafts' && !searchQuery && (
              <Button variant="secondary" onClick={() => router.push('/requests/new')}>Start a New Request</Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            <AnimatePresence mode="wait">
              {filteredRequests.map((request, index) => {
                const statusInfo = statusConfig[request.status] || statusConfig['pending'];
                const requestType = request.type || request.metadata?.requestType || 'approval';
                const typeLabel = typeLabels[requestType] || 'Request';
                const amount = request.metadata?.amount;
                const currency = request.metadata?.currency;

                return (
                  <motion.div
                    key={request.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.25) }}
                    onClick={() => router.push(getRequestDetailPath(request))}
                    className="group cursor-pointer bg-white rounded-2xl border border-border hover:border-neutral-300 hover:shadow-card-hover transition-all p-4 sm:p-5"
                  >
                    <div className="flex items-center gap-4">
                      {/* Type icon — plain monochrome glyph */}
                      <span className="shrink-0 w-9 flex items-center justify-center text-neutral-700">
                        <FileText className="w-5 h-5" strokeWidth={1.5} />
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{typeLabel}</span>
                          {request.metadata?.referenceCode && (
                            <span className="text-[10px] font-mono font-semibold text-text-secondary bg-neutral-100 px-2 py-0.5 rounded border border-border tracking-wider">
                              {request.metadata.referenceCode}
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-text-primary truncate group-hover:text-primary-700 transition-colors">
                          {request.title}
                        </h3>
                        <div className="flex items-center gap-x-3 gap-y-1 mt-1 text-xs text-text-muted flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
                            {formatDate(request.created_at)}
                          </span>
                          {request.attachments_count ? (
                            <span className="inline-flex items-center gap-1">
                              <Paperclip className="w-3.5 h-3.5" strokeWidth={1.5} />
                              {request.attachments_count}
                            </span>
                          ) : null}
                          {(request.current_step && request.total_steps) ? (
                            <span>Step {request.current_step} of {request.total_steps}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${statusInfo.bg} ${statusInfo.text} ${statusInfo.ring}`}>
                          {statusInfo.label}
                        </span>
                        {amount ? <span className="text-sm font-semibold text-text-primary">{formatCurrency(amount, currency)}</span> : null}
                      </div>

                      <ChevronRight className="hidden sm:block w-5 h-5 text-neutral-300 group-hover:text-neutral-500 group-hover:translate-x-0.5 transition-all shrink-0" strokeWidth={1.5} />
                    </div>

                    {/* Progress (pending/in_review) */}
                    {['pending', 'in_review'].includes(request.status) && request.total_steps && request.total_steps > 0 && (
                      <div className="mt-4 pt-3 border-t border-border">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 flex-1">
                            {Array.from({ length: request.total_steps }).map((_, idx) => {
                              const isCompleted = idx < (request.completed_steps || 0);
                              const isCurrent = idx === (request.completed_steps || 0);
                              return (
                                <div
                                  key={idx}
                                  className={`h-1.5 flex-1 rounded-full transition-colors ${isCompleted ? 'bg-primary-500' : isCurrent ? 'bg-primary-300' : 'bg-neutral-200'}`}
                                />
                              );
                            })}
                          </div>
                          <span className="text-xs font-medium text-text-secondary whitespace-nowrap">
                            {request.completed_steps || 0} of {request.total_steps} approved
                          </span>
                        </div>
                        {request.current_approver && (
                          <p className="mt-2 text-xs text-text-secondary">
                            Awaiting approval from <span className="font-medium text-text-primary">{request.current_approver.name}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
