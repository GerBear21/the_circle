import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import ComingSoonPage from '../../components/shared/ComingSoonPage';
import { AppLayout } from '../../components/layout';
import { Card } from '../../components/ui';
import { useRBAC } from '../../contexts/RBACContext';

export default function CapexTrackerPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { hasPermission, loading: rbacLoading } = useRBAC();

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/');
    }
  }, [sessionStatus, router]);

  if (sessionStatus === 'loading' || rbacLoading) {
    return (
      <AppLayout title="CAPEX Tracker">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  if (!hasPermission('finance.view_tracker')) {
    return (
      <AppLayout title="CAPEX Tracker">
        <div className="mx-auto max-w-3xl p-6">
          <Card padding="lg">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Access Restricted</h2>
            <p className="text-gray-600">You do not have permission to view this page.</p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <ComingSoonPage
      title="CAPEX Tracker"
      description="The CAPEX tracker route is in place and will show the full tracker here once the finance rollout is ready."
      badge="Finance"
      backHref="/dashboard"
      backLabel="Back to Dashboard"
      icon={(
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2a4 4 0 014-4h3M9 17l-3 3m0 0l-3-3m3 3V4m6 13h6m-6-4h6m-6-4h6" />
        </svg>
      )}
    />
  );
}
