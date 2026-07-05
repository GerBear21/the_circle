import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card } from '../../../components/ui';
import { VoucherEmailsConfig } from '../../../components/admin/settings';
import { useRBAC } from '../../../contexts/RBACContext';

export default function AdminVoucherEmailsPage() {
  const { status } = useSession();
  const router = useRouter();
  const { loading, isSuperAdmin, isSystemAdmin } = useRBAC();
  const allowed = isSuperAdmin || isSystemAdmin;

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  if (status === 'loading' || loading) {
    return (
      <AppLayout title="Voucher Emails">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Voucher Emails">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {allowed ? (
          <VoucherEmailsConfig />
        ) : (
          <Card className="bg-danger-50 border-danger-200">
            <p className="text-danger-600 text-sm">
              Only a Super Admin or System Admin may manage voucher emails.
            </p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
