import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '../../components/layout';
import { Card } from '../../components/ui';
import { useRBAC } from '../../contexts/RBACContext';
import { useToast } from '../../components/ui/ToastProvider';

interface Receipt {
  id: string;
  requestId: string;
  clerkEmail: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
  amount: number | null;
  currency: string | null;
  confirmedAt: string | null;
  createdAt: string;
  requestorName: string;
  clerkName: string | null;
  requestTitle: string;
  referenceCode: string | null;
}

function money(n: number | null, currency = 'USD'): string {
  if (n == null) return '—';
  try { return n.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }); }
  catch { return `${currency} ${n}`; }
}
function fmt(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const statusTone: Record<Receipt['status'], string> = {
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  expired: 'bg-gray-50 text-gray-500 border-gray-200',
  cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
};

export default function CashReceiptsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { hasPermission, loading: rbacLoading } = useRBAC();
  const { addToast } = useToast();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => { if (sessionStatus === 'unauthenticated') router.push('/'); }, [sessionStatus, router]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch('/api/finance/cash-receipts');
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
        const data = await res.json();
        setReceipts(data.receipts || []);
      } catch (e: any) {
        setLoadError(e?.message || 'Failed to load cash receipts');
        addToast({ type: 'error', title: 'Failed to load', message: e?.message || 'Unknown error' });
      } finally {
        setLoading(false);
      }
    };
    if (sessionStatus === 'authenticated' && hasPermission('finance.view_cash_receipts')) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, rbacLoading]);

  const filtered = useMemo(
    () => (statusFilter ? receipts.filter(r => r.status === statusFilter) : receipts),
    [receipts, statusFilter]
  );
  const confirmedTotal = useMemo(
    () => receipts.filter(r => r.status === 'confirmed').reduce((s, r) => s + Number(r.amount || 0), 0),
    [receipts]
  );

  if (sessionStatus === 'loading' || rbacLoading) {
    return (
      <AppLayout title="Cash Receipts">
        <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" /></div>
      </AppLayout>
    );
  }
  if (!session) return null;
  if (!hasPermission('finance.view_cash_receipts')) {
    return (
      <AppLayout title="Cash Receipts">
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
    <AppLayout title="Cash Receipts">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-heading">Petty Cash Receipts</h1>
            <p className="mt-1 text-sm text-gray-500">
              OTP-verified confirmations that requestors received petty cash from the accounts clerk.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              className="min-h-[40px] rounded-xl border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card className="!p-4"><span className="text-xs uppercase tracking-wide text-gray-400">Confirmed</span><div className="text-xl font-bold text-emerald-600">{receipts.filter(r => r.status === 'confirmed').length}</div></Card>
          <Card className="!p-4"><span className="text-xs uppercase tracking-wide text-gray-400">Confirmed value</span><div className="text-xl font-bold text-text-primary">{money(confirmedTotal)}</div></Card>
          <Card className="!p-4"><span className="text-xs uppercase tracking-wide text-gray-400">Awaiting</span><div className="text-xl font-bold text-amber-600">{receipts.filter(r => r.status === 'pending').length}</div></Card>
        </div>

        {loadError && <Card className="border-danger-200 bg-danger-50"><p className="text-sm text-danger-600">{loadError}</p></Card>}

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" /></div>
        ) : filtered.length === 0 ? (
          <Card padding="lg"><p className="text-gray-600">No cash receipt confirmations yet.</p></Card>
        ) : (
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-5 py-2.5 text-left font-medium">Voucher</th>
                    <th className="px-3 py-2.5 text-left font-medium">Requestor</th>
                    <th className="px-3 py-2.5 text-left font-medium">Clerk</th>
                    <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                    <th className="px-3 py-2.5 text-left font-medium">Confirmed</th>
                    <th className="px-5 py-2.5 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50" onClick={() => router.push(`/requests/${r.requestId}`)}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{r.requestTitle}</div>
                        {r.referenceCode && <div className="font-mono text-xs text-gray-400">{r.referenceCode}</div>}
                      </td>
                      <td className="px-3 py-3 text-gray-700">{r.requestorName}</td>
                      <td className="px-3 py-3 text-gray-700">{r.clerkName || r.clerkEmail}</td>
                      <td className="px-3 py-3 text-right font-medium text-gray-900">{money(r.amount, r.currency || 'USD')}</td>
                      <td className="px-3 py-3 text-gray-600">{r.status === 'confirmed' ? fmt(r.confirmedAt) : '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs capitalize ${statusTone[r.status]}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
