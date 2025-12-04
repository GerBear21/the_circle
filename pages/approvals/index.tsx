import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { AppLayout } from '../../components/layout';
import { Card, Button } from '../../components/ui';
import { useApprovals } from '../../hooks';

export default function ApprovalsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { pendingApprovals, loading, error } = useApprovals();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

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
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {error && (
          <Card className="bg-red-50 border-red-200">
            <p className="text-red-600 text-sm">Error loading approvals: {error.message}</p>
          </Card>
        )}

        {pendingApprovals.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
            <p className="text-gray-500 mt-1">No pending approvals at the moment</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingApprovals.map((request) => (
              <Card 
                key={request.id} 
                variant="elevated"
                className="cursor-pointer hover:shadow-card-hover transition-shadow"
                onClick={() => router.push(`/requests/${request.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{request.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {request.description || 'No description'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(request.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
