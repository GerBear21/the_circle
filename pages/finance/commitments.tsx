import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import ComingSoonPage from '../../components/shared/ComingSoonPage';
import { AppLayout } from '../../components/layout';
import { Card } from '../../components/ui';
import { useRBAC } from '../../contexts/RBACContext';

export default function CommitmentsAndSpendPage() {
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
      <AppLayout title="Commitments & Spend">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  if (!hasPermission('finance.view_tracker')) {
    return (
      <AppLayout title="Commitments & Spend">
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
      title="Commitments & Spend"
      description="The commitments and spend page will be launched here once the finance reporting workflow is ready."
      badge="Finance"
      backHref="/dashboard"
      backLabel="Back to Dashboard"
      icon={(
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
    />
  );
}
