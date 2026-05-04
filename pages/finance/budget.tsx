import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import ComingSoonPage from '../../components/shared/ComingSoonPage';
import { AppLayout } from '../../components/layout';
import { Card } from '../../components/ui';
import { useRBAC } from '../../contexts/RBACContext';

export default function BudgetManagementPage() {
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
      <AppLayout title="Budget Management">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  if (!hasPermission('finance.view_budget')) {
    return (
      <AppLayout title="Budget Management">
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
      title="Budget Management"
      description="The finance budget management page is reserved and will be enabled here once the workflow is ready."
      badge="Finance"
      backHref="/dashboard"
      backLabel="Back to Dashboard"
      icon={(
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )}
    />
  );
}
