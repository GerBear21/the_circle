import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { AppLayout } from '../../components/layout';
import { Card, Button } from '../../components/ui';
import { useApprovals } from '../../hooks';
import tickAnimation from '../../tick.json';

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  in_review: { label: 'In Review', bg: 'bg-blue-100', text: 'text-blue-800' },
  approved: { label: 'Approved', bg: 'bg-green-100', text: 'text-green-800' },
  rejected: { label: 'Rejected', bg: 'bg-red-100', text: 'text-red-800' },
};

export default function RequestsApprovalsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { pendingApprovals, loading, error } = useApprovals();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const filteredApprovals = pendingApprovals.filter((request) => {
    return (
      request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (request.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    );
  });

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

  const getDueStatus = (dueAt: string | null) => {
    if (!dueAt) return null;
    const due = new Date(dueAt);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: 'Overdue', className: 'text-red-600 bg-red-50' };
    } else if (diffDays === 0) {
      return { label: 'Due today', className: 'text-yellow-600 bg-yellow-50' };
    } else if (diffDays === 1) {
      return { label: 'Due tomorrow', className: 'text-yellow-600 bg-yellow-50' };
    } else if (diffDays <= 3) {
      return { label: `Due in ${diffDays} days`, className: 'text-blue-600 bg-blue-50' };
    }
    return null;
  };

  if (status === 'loading' || loading) {
    return (
      <AppLayout title="Approvals">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <AppLayout title="Pending Approvals">
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-heading">Pending Approvals</h1>
            <p className="text-gray-500 mt-1">Requests waiting for your approval</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
              {pendingApprovals.length} pending
            </span>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Card className="bg-red-50 border-red-200 mb-6">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-600 text-sm">Error loading approvals: {error.message}</p>
            </div>
          </Card>
        )}

        {/* Search */}
        {pendingApprovals.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search approvals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredApprovals.length === 0 && !error ? (
          <Card className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4">
              <Lottie
                animationData={tickAnimation}
                loop={false}
                className="w-full h-full"
              />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">All caught up!</h3>
            <p className="text-gray-500">
              {searchQuery ? 'No approvals match your search' : 'No pending approvals at the moment'}
            </p>
            {searchQuery && (
              <Button
                variant="ghost"
                className="mt-4"
                onClick={() => setSearchQuery('')}
              >
                Clear search
              </Button>
            )}
          </Card>
        ) : (
          /* Approvals List */
          <div className="space-y-3">
            {filteredApprovals.map((request) => {
              const currentStep = request.request_steps?.[0];
              const dueStatus = currentStep?.due_at ? getDueStatus(currentStep.due_at) : null;
              const statusInfo = statusConfig[request.status] || statusConfig.pending;

              return (
                <Card
                  key={request.id}
                  variant="outlined"
                  className="cursor-pointer hover:shadow-card-hover transition-shadow"
                  onClick={() => router.push(`/requests/${request.id}`)}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium text-gray-900 truncate">{request.title}</h3>
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                            {request.description || 'No description provided'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                            {statusInfo.label}
                          </span>
                          {dueStatus && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${dueStatus.className}`}>
                              {dueStatus.label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Meta Info */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Submitted {formatDate(request.created_at)}
                        </span>
                        {currentStep && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Step {currentStep.step_index + 1}
                          </span>
                        )}
                        {currentStep?.step_type && (
                          <span className="flex items-center gap-1 capitalize">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            {currentStep.step_type.replace('_', ' ')}
                          </span>
                        )}
                      </div>

                      {/* Action Hint */}
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-brand-600 font-medium">Click to review and take action</span>
                      </div>
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
