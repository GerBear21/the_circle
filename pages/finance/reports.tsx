import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '../../components/layout';
import { Card } from '../../components/ui';
import { useRBAC } from '../../contexts/RBACContext';
import { useToast } from '../../components/ui/ToastProvider';

interface TrackerEntry {
  id: string;
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

function money(n: number): string {
  try {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  } catch {
    return `$${Math.round(n).toLocaleString()}`;
  }
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

/** Group a list of entries by a key, summing cost/funded/balance + counting. */
function summariseBy(entries: TrackerEntry[], keyFn: (e: TrackerEntry) => string) {
  const map = new Map<string, { key: string; count: number; cost: number; funded: number; balance: number }>();
  for (const e of entries) {
    const key = keyFn(e) || '—';
    const row = map.get(key) || { key, count: 0, cost: 0, funded: 0, balance: 0 };
    row.count += 1;
    row.cost += Number(e.cost || 0);
    row.funded += Number(e.funded || 0);
    row.balance += Number(e.balance || 0);
    map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}

const STAT_CARD = 'flex flex-col gap-1 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm';

export default function FinancialReportsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { hasPermission, loading: rbacLoading } = useRBAC();
  const { addToast } = useToast();

  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<string>('');

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/');
  }, [sessionStatus, router]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch('/api/finance/capex-tracker');
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setEntries(data.entries || []);
      } catch (e: any) {
        setLoadError(e?.message || 'Failed to load report data');
        addToast({ type: 'error', title: 'Failed to load reports', message: e?.message || 'Unknown error' });
      } finally {
        setLoading(false);
      }
    };
    if (sessionStatus === 'authenticated' && hasPermission('finance.view_reports')) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, rbacLoading]);

  const years = useMemo(() => {
    const s = new Set<number>();
    entries.forEach(e => { if (Number.isFinite(e.financial_year)) s.add(e.financial_year); });
    return Array.from(s).sort((a, b) => b - a);
  }, [entries]);

  const scoped = useMemo(
    () => (yearFilter ? entries.filter(e => String(e.financial_year) === yearFilter) : entries),
    [entries, yearFilter]
  );

  const totals = useMemo(() => {
    const cost = scoped.reduce((s, e) => s + Number(e.cost || 0), 0);
    const funded = scoped.reduce((s, e) => s + Number(e.funded || 0), 0);
    const balance = scoped.reduce((s, e) => s + Number(e.balance || 0), 0);
    const budgeted = scoped.filter(e => e.is_budgeted).reduce((s, e) => s + Number(e.cost || 0), 0);
    const unbudgeted = cost - budgeted;
    return { cost, funded, balance, budgeted, unbudgeted, count: scoped.length };
  }, [scoped]);

  const byStatus = useMemo(() => summariseBy(scoped, e => e.status_update), [scoped]);
  const byDepartment = useMemo(() => summariseBy(scoped, e => e.department || 'Unassigned'), [scoped]);
  const bySupplier = useMemo(
    () => summariseBy(scoped, e => e.supplier || 'Unspecified supplier').slice(0, 10),
    [scoped]
  );

  if (sessionStatus === 'loading' || rbacLoading) {
    return (
      <AppLayout title="Financial Reports">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  if (!hasPermission('finance.view_reports')) {
    return (
      <AppLayout title="Financial Reports">
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
    <AppLayout title="Financial Reports">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-heading">CAPEX Financial Reports</h1>
            <p className="mt-1 text-sm text-gray-500">
              Commitments, funding and outstanding balances across all approved capital expenditure.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Financial Year</label>
            <select
              className="min-h-[40px] rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="">All years</option>
              {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          </div>
        </div>

        {loadError && (
          <Card className="border-danger-200 bg-danger-50"><p className="text-sm text-danger-600">{loadError}</p></Card>
        )}

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" />
          </div>
        ) : entries.length === 0 ? (
          <Card padding="lg">
            <p className="text-gray-600">No approved CAPEX yet. Reports populate as requests are approved.</p>
          </Card>
        ) : (
          <>
            {/* Headline stats */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className={STAT_CARD}>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Total CAPEX</span>
                <span className="text-2xl font-bold text-text-primary">{money(totals.cost)}</span>
                <span className="text-xs text-gray-400">{totals.count} item{totals.count === 1 ? '' : 's'}</span>
              </div>
              <div className={STAT_CARD}>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Funded / Paid</span>
                <span className="text-2xl font-bold text-emerald-600">{money(totals.funded)}</span>
                <span className="text-xs text-gray-400">{pct(totals.funded, totals.cost)}% of total</span>
              </div>
              <div className={STAT_CARD}>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Outstanding Balance</span>
                <span className="text-2xl font-bold text-amber-600">{money(totals.balance)}</span>
                <span className="text-xs text-gray-400">{pct(totals.balance, totals.cost)}% remaining</span>
              </div>
              <div className={STAT_CARD}>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Budgeted vs Non-Budget</span>
                <span className="text-2xl font-bold text-text-primary">{pct(totals.budgeted, totals.cost)}%</span>
                <span className="text-xs text-gray-400">budgeted · {money(totals.unbudgeted)} non-budget</span>
              </div>
            </div>

            {/* Funding progress bar */}
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Overall Funding Progress</h3>
              <div className="h-4 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct(totals.funded, totals.cost)}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <span>Paid {money(totals.funded)}</span>
                <span>Outstanding {money(totals.balance)}</span>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ReportTable title="By Status" rows={byStatus} totalCost={totals.cost} firstColLabel="Status" />
              <ReportTable title="By Department" rows={byDepartment} totalCost={totals.cost} firstColLabel="Department" />
            </div>

            <ReportTable title="Top Suppliers by Commitment" rows={bySupplier} totalCost={totals.cost} firstColLabel="Supplier" />
          </>
        )}
      </div>
    </AppLayout>
  );
}

function ReportTable({
  title, rows, totalCost, firstColLabel,
}: {
  title: string;
  rows: Array<{ key: string; count: number; cost: number; funded: number; balance: number }>;
  totalCost: number;
  firstColLabel: string;
}) {
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
              <th className="px-5 py-2 text-left font-medium">{firstColLabel}</th>
              <th className="px-3 py-2 text-right font-medium">Items</th>
              <th className="px-3 py-2 text-right font-medium">Cost</th>
              <th className="px-3 py-2 text-right font-medium">Paid</th>
              <th className="px-5 py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-2.5 text-gray-900">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{r.key}</span>
                    <span className="text-xs text-gray-400">({pct(r.cost, totalCost)}%)</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-primary-400" style={{ width: `${pct(r.cost, totalCost)}%` }} />
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-gray-600">{r.count}</td>
                <td className="px-3 py-2.5 text-right font-medium text-gray-900">{money(r.cost)}</td>
                <td className="px-3 py-2.5 text-right text-emerald-600">{money(r.funded)}</td>
                <td className="px-5 py-2.5 text-right text-amber-600">{money(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
