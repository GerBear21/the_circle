import { useRBAC } from '../../contexts/RBACContext';
import { AppLayout } from '../layout';
import { ShieldOff } from 'lucide-react';

export const AUDIT_NAV_PERMISSIONS = ['audit.view_logs', 'admin.audit_logs'];

/**
 * Client-side gate for the /audit section: auditors and super admins only.
 * (APIs enforce the same permissions server-side — this is just UX.)
 */
export default function AuditAccessGate({ title, children }: { title: string; children: React.ReactNode }) {
  const { hasAnyPermission, isSuperAdmin, loading } = useRBAC();

  if (loading) {
    return (
      <AppLayout title={title}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      </AppLayout>
    );
  }

  if (!isSuperAdmin && !hasAnyPermission(AUDIT_NAV_PERMISSIONS)) {
    return (
      <AppLayout title={title}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
            <ShieldOff className="w-9 h-9 text-red-400" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Audit access restricted</h2>
          <p className="text-gray-500 mt-2 max-w-md">
            This section is reserved for Auditors and Super Administrators. If you believe you
            should have access, ask an administrator to grant you the Auditor role.
          </p>
        </div>
      </AppLayout>
    );
  }

  return <>{children}</>;
}
