import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '../../components/layout';
import { Card } from '../../components/ui';
import { useRBAC } from '../../contexts/RBACContext';
import { useToast } from '../../components/ui/ToastProvider';

interface TrackerEntry {
  id: string;
  request_id: string | null;
  supplier: string | null;
  description: string;
  capex_date: string;
  cost: number;
  funded: number;
  balance: number;
  status_update: string;
  department: string | null;
  financial_year: number;
  is_budgeted: boolean;
}

type Severity = 'high' | 'medium' | 'low';
interface Exception {
  entry: TrackerEntry;
  severity: Severity;
  detail: string;
}

function money(n: number): string {
  try { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); }
  catch { return `$${Math.round(n).toLocaleString()}`; }
}
function fdate(d: string): string {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function daysSince(d: string): number {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return 0;
  return Math.floor((Date.now() - dt.getTime()) / 86_400_000);
}

const AGING_DAYS = 90;       // outstanding balance older than this is overdue
const STALE_FUNDING_DAYS = 60; // approved-awaiting-funding older than this is stalled

// Each exception category is a named rule run over the tracker entries.
const CATEGORIES: Array<{
  key: string;
  title: string;
  description: string;
  test: (e: TrackerEntry) => { hit: boolean; severity: Severity; detail: string };
}> = [
  {
    key: 'unbudgeted',
    title: 'Unbudgeted CAPEX',
    description: 'Approved capital expenditure that was not part of the approved annual budget.',
    test: (e) => ({
      hit: !e.is_budgeted,
      severity: e.cost >= 10000 ? 'high' : 'medium',
      detail: `Outside the approved annual budget (${money(e.cost)}).`,
    }),
  },
  {
    key: 'aging_balance',
    title: 'Overdue Outstanding Balance',
    description: `Outstanding supplier balance unpaid for more than ${AGING_DAYS} days.`,
    test: (e) => {
      const age = daysSince(e.capex_date);
      const hit = Number(e.balance) > 0 && age > AGING_DAYS &&
        e.status_update !== 'Completed' && e.status_update !== 'CAPEX Rejected' && e.status_update !== 'On Hold';
      return { hit, severity: age > AGING_DAYS * 2 ? 'high' : 'medium', detail: `${money(e.balance)} outstanding for ${age} days.` };
    },
  },
  {
    key: 'stale_funding',
    title: 'Stalled Funding',
    description: `Approved but awaiting funding for more than ${STALE_FUNDING_DAYS} days.`,
    test: (e) => {
      const age = daysSince(e.capex_date);
      const hit = e.status_update === 'CAPEX Approved – Awaiting Funding' && age > STALE_FUNDING_DAYS;
      return { hit, severity: 'medium', detail: `Awaiting funding for ${age} days.` };
    },
  },
  {
    key: 'on_hold',
    title: 'On Hold',
    description: 'CAPEX placed on hold and not progressing.',
    test: (e) => ({ hit: e.status_update === 'On Hold', severity: 'low', detail: 'Status is On Hold.' }),
  },
  {
    key: 'rejected',
    title: 'Rejected CAPEX',
    description: 'CAPEX rejected during approval.',
    test: (e) => ({ hit: e.status_update === 'CAPEX Rejected', severity: 'low', detail: 'Rejected in the approval trail.' }),
  },
  {
    key: 'missing_supplier',
    title: 'Missing Supplier',
    description: 'Approved CAPEX with no supplier recorded — data quality issue.',
    test: (e) => ({
      hit: !e.supplier || e.supplier.trim() === '',
      severity: 'low',
      detail: 'No supplier captured on the request.',
    }),
  },
];

const sevTone: Record<Severity, string> = {
  high: 'bg-rose-50 text-rose-700 border-rose-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-gray-50 text-gray-600 border-gray-200',
};

export default function ExceptionReportsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { hasPermission, loading: rbacLoading } = useRBAC();
  const { addToast } = useToast();

  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => { if (sessionStatus === 'unauthenticated') router.push('/'); }, [sessionStatus, router]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch('/api/finance/capex-tracker');
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
        const data = await res.json();
        setEntries(data.entries || []);
      } catch (e: any) {
        setLoadError(e?.message || 'Failed to load exception data');
        addToast({ type: 'error', title: 'Failed to load', message: e?.message || 'Unknown error' });
      } finally {
        setLoading(false);
      }
    };
    if (sessionStatus === 'authenticated' && hasPermission('finance.view_exceptions')) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, rbacLoading]);

  const grouped = useMemo(() => {
    return CATEGORIES.map(cat => {
      const exceptions: Exception[] = [];
      for (const e of entries) {
        const r = cat.test(e);
        if (r.hit) exceptions.push({ entry: e, severity: r.severity, detail: r.detail });
      }
      const value = exceptions.reduce((s, x) => s + Number(x.entry.balance || x.entry.cost || 0), 0);
      return { ...cat, exceptions, value };
    }).filter(g => g.exceptions.length > 0);
  }, [entries]);

  const totalExceptions = grouped.reduce((s, g) => s + g.exceptions.length, 0);

  if (sessionStatus === 'loading' || rbacLoading) {
    return (
      <AppLayout title="Exception Reports">
        <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" /></div>
      </AppLayout>
    );
  }
  if (!session) return null;
  if (!hasPermission('finance.view_exceptions')) {
    return (
      <AppLayout title="Exception Reports">
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
    <AppLayout title="Exception Reports">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-heading">CAPEX Exception Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Automatic flags across approved CAPEX — unbudgeted spend, overdue balances, stalled funding and data gaps.
          </p>
        </div>

        {loadError && <Card className="border-danger-200 bg-danger-50"><p className="text-sm text-danger-600">{loadError}</p></Card>}

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" /></div>
        ) : totalExceptions === 0 ? (
          <Card padding="lg">
            <div className="flex items-center gap-3 text-emerald-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="font-medium">No exceptions found. All approved CAPEX is within tolerance.</p>
            </div>
          </Card>
        ) : (
          <>
            <Card className="!p-4">
              <span className="text-xs uppercase tracking-wide text-gray-400">Total exceptions flagged</span>
              <div className="text-2xl font-bold text-rose-600">{totalExceptions}</div>
              <span className="text-xs text-gray-400">across {grouped.length} categor{grouped.length === 1 ? 'y' : 'ies'}</span>
            </Card>

            {grouped.map(g => (
              <Card key={g.key} className="!p-0 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{g.title}
                      <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{g.exceptions.length}</span>
                    </h3>
                    <p className="text-xs text-gray-500">{g.description}</p>
                  </div>
                  <div className="text-right text-sm"><div className="text-xs text-gray-400">Exposure</div><div className="font-semibold text-amber-600">{money(g.value)}</div></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                        <th className="px-5 py-2 text-left font-medium">Supplier / Description</th>
                        <th className="px-3 py-2 text-left font-medium">Department</th>
                        <th className="px-3 py-2 text-left font-medium">CAPEX Date</th>
                        <th className="px-3 py-2 text-right font-medium">Cost</th>
                        <th className="px-3 py-2 text-right font-medium">Balance</th>
                        <th className="px-5 py-2 text-left font-medium">Issue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.exceptions.map(x => (
                        <tr
                          key={x.entry.id}
                          className={`border-b border-gray-50 last:border-0 ${x.entry.request_id ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                          onClick={() => x.entry.request_id && router.push(`/requests/${x.entry.request_id}`)}
                        >
                          <td className="px-5 py-2.5">
                            <div className="font-medium text-gray-900">{x.entry.supplier || 'Unspecified supplier'}</div>
                            <div className="truncate text-xs text-gray-400">{x.entry.description}</div>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600">{x.entry.department || '—'}</td>
                          <td className="px-3 py-2.5 text-gray-600">{fdate(x.entry.capex_date)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-900">{money(Number(x.entry.cost))}</td>
                          <td className="px-3 py-2.5 text-right text-amber-600">{money(Number(x.entry.balance))}</td>
                          <td className="px-5 py-2.5">
                            <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${sevTone[x.severity]}`}>{x.detail}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
    </AppLayout>
  );
}
