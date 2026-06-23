import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '../../components/layout';
import { Card, Button } from '../../components/ui';
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
}

interface Payment {
  id: string;
  capex_tracker_id: string;
  amount: number;
  payment_date: string;
  period: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

function money(n: number): string {
  try {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  } catch {
    return `$${Math.round(n).toLocaleString()}`;
  }
}
function fdate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function SupplierPaymentsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { hasPermission, loading: rbacLoading } = useRBAC();
  const { addToast } = useToast();

  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Record-payment modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    capex_tracker_id: '', amount: '', payment_date: new Date().toISOString().slice(0, 10),
    period: '', reference: '', notes: '',
  });

  const canEdit = hasPermission('finance.edit_tracker');

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/');
  }, [sessionStatus, router]);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [trackerRes, payRes] = await Promise.all([
        fetch('/api/finance/capex-tracker'),
        fetch('/api/finance/capex-payments'),
      ]);
      if (!trackerRes.ok) throw new Error((await trackerRes.json().catch(() => ({}))).error || `HTTP ${trackerRes.status}`);
      if (!payRes.ok) throw new Error((await payRes.json().catch(() => ({}))).error || `HTTP ${payRes.status}`);
      const trackerData = await trackerRes.json();
      const payData = await payRes.json();
      setEntries(trackerData.entries || []);
      setPayments(payData.payments || []);
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load supplier payments');
      addToast({ type: 'error', title: 'Failed to load', message: e?.message || 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionStatus === 'authenticated' && hasPermission('finance.view_suppliers')) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, rbacLoading]);

  const paymentsByTracker = useMemo(() => {
    const m = new Map<string, Payment[]>();
    for (const p of payments) {
      if (!m.has(p.capex_tracker_id)) m.set(p.capex_tracker_id, []);
      m.get(p.capex_tracker_id)!.push(p);
    }
    return m;
  }, [payments]);

  // Group approved CAPEX by supplier with rolled-up committed / paid / outstanding.
  const suppliers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const m = new Map<string, { supplier: string; items: TrackerEntry[]; cost: number; paid: number; balance: number }>();
    for (const e of entries) {
      const supplier = e.supplier || 'Unspecified supplier';
      if (term && !`${supplier} ${e.description} ${e.department || ''}`.toLowerCase().includes(term)) continue;
      const row = m.get(supplier) || { supplier, items: [], cost: 0, paid: 0, balance: 0 };
      row.items.push(e);
      row.cost += Number(e.cost || 0);
      row.paid += Number(e.funded || 0);
      row.balance += Number(e.balance || 0);
      m.set(supplier, row);
    }
    return Array.from(m.values()).sort((a, b) => b.balance - a.balance);
  }, [entries, search]);

  const grandTotals = useMemo(() => ({
    cost: entries.reduce((s, e) => s + Number(e.cost || 0), 0),
    paid: entries.reduce((s, e) => s + Number(e.funded || 0), 0),
    balance: entries.reduce((s, e) => s + Number(e.balance || 0), 0),
  }), [entries]);

  const openRecord = (trackerId?: string) => {
    setForm({
      capex_tracker_id: trackerId || '', amount: '',
      payment_date: new Date().toISOString().slice(0, 10), period: '', reference: '', notes: '',
    });
    setShowModal(true);
  };

  const submitPayment = async () => {
    if (!form.capex_tracker_id) { addToast({ type: 'error', title: 'Select a CAPEX item', message: 'Choose which CAPEX the payment is for.' }); return; }
    if (!form.amount || Number(form.amount) <= 0) { addToast({ type: 'error', title: 'Enter an amount', message: 'Amount must be greater than zero.' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/finance/capex-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record payment');
      addToast({ type: 'success', title: 'Payment recorded', message: 'Supplier payment saved and funding updated.' });
      setShowModal(false);
      await load();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Failed to record payment', message: e?.message || 'Unknown error' });
    } finally {
      setSaving(false);
    }
  };

  if (sessionStatus === 'loading' || rbacLoading) {
    return (
      <AppLayout title="Supplier Payments">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }
  if (!session) return null;
  if (!hasPermission('finance.view_suppliers')) {
    return (
      <AppLayout title="Supplier Payments">
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
    <AppLayout title="Supplier Payments">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-heading">Supplier Payments</h1>
            <p className="mt-1 text-sm text-gray-500">
              Suppliers, descriptions and the payment periods for every approved CAPEX commitment.
            </p>
          </div>
          {canEdit && (
            <Button variant="primary" onClick={() => openRecord()}>+ Record Payment</Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="!p-4"><span className="text-xs uppercase tracking-wide text-gray-400">Committed</span><div className="text-xl font-bold text-text-primary">{money(grandTotals.cost)}</div></Card>
          <Card className="!p-4"><span className="text-xs uppercase tracking-wide text-gray-400">Paid to Suppliers</span><div className="text-xl font-bold text-emerald-600">{money(grandTotals.paid)}</div></Card>
          <Card className="!p-4"><span className="text-xs uppercase tracking-wide text-gray-400">Outstanding</span><div className="text-xl font-bold text-amber-600">{money(grandTotals.balance)}</div></Card>
        </div>

        <input
          type="text"
          className="w-full min-h-[44px] rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Search supplier, description or department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loadError && <Card className="border-danger-200 bg-danger-50"><p className="text-sm text-danger-600">{loadError}</p></Card>}

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" /></div>
        ) : suppliers.length === 0 ? (
          <Card padding="lg"><p className="text-gray-600">No approved CAPEX commitments yet.</p></Card>
        ) : (
          <div className="space-y-4">
            {suppliers.map(s => (
              <Card key={s.supplier} className="!p-0 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                      {s.supplier.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{s.supplier}</h3>
                      <p className="text-xs text-gray-500">{s.items.length} CAPEX item{s.items.length === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  <div className="flex gap-5 text-right text-sm">
                    <div><div className="text-xs text-gray-400">Committed</div><div className="font-semibold text-gray-900">{money(s.cost)}</div></div>
                    <div><div className="text-xs text-gray-400">Paid</div><div className="font-semibold text-emerald-600">{money(s.paid)}</div></div>
                    <div><div className="text-xs text-gray-400">Outstanding</div><div className="font-semibold text-amber-600">{money(s.balance)}</div></div>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {s.items.map(item => {
                    const itemPayments = paymentsByTracker.get(item.id) || [];
                    return (
                      <div key={item.id} className="px-5 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">{item.description}</p>
                            <p className="text-xs text-gray-400">
                              {item.department || '—'} · CAPEX {fdate(item.capex_date)} · {item.status_update}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-right text-sm">
                            <div><div className="text-xs text-gray-400">Cost</div><div className="font-medium text-gray-900">{money(item.cost)}</div></div>
                            <div><div className="text-xs text-gray-400">Balance</div><div className="font-medium text-amber-600">{money(item.balance)}</div></div>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => openRecord(item.id)}
                                className="rounded-lg border border-primary-200 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50"
                              >
                                Record payment
                              </button>
                            )}
                          </div>
                        </div>
                        {itemPayments.length > 0 && (
                          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-100">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 text-gray-400">
                                <tr>
                                  <th className="px-3 py-1.5 text-left font-medium">Period</th>
                                  <th className="px-3 py-1.5 text-left font-medium">Date</th>
                                  <th className="px-3 py-1.5 text-left font-medium">Reference</th>
                                  <th className="px-3 py-1.5 text-right font-medium">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {itemPayments.map(p => (
                                  <tr key={p.id} className="border-t border-gray-50">
                                    <td className="px-3 py-1.5 text-gray-700">{p.period || '—'}</td>
                                    <td className="px-3 py-1.5 text-gray-700">{fdate(p.payment_date)}</td>
                                    <td className="px-3 py-1.5 text-gray-500">{p.reference || '—'}</td>
                                    <td className="px-3 py-1.5 text-right font-medium text-emerald-600">{money(Number(p.amount))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Record payment modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !saving && setShowModal(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold text-gray-900">Record Supplier Payment</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">CAPEX item *</label>
                <select
                  className="w-full min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 text-sm"
                  value={form.capex_tracker_id}
                  onChange={(e) => setForm({ ...form, capex_tracker_id: e.target.value })}
                >
                  <option value="">Select CAPEX item…</option>
                  {entries.map(e => (
                    <option key={e.id} value={e.id}>
                      {(e.supplier || 'Unspecified')} — {e.description} ({money(e.balance)} left)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Amount (USD) *</label>
                  <input type="number" min="0" step="0.01" className="w-full min-h-[44px] rounded-xl border border-gray-300 px-3 text-sm"
                    value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Payment date *</label>
                  <input type="date" className="w-full min-h-[44px] rounded-xl border border-gray-300 px-3 text-sm"
                    value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Period</label>
                  <input type="text" className="w-full min-h-[44px] rounded-xl border border-gray-300 px-3 text-sm"
                    value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="e.g. Q1 2026" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Reference</label>
                  <input type="text" className="w-full min-h-[44px] rounded-xl border border-gray-300 px-3 text-sm"
                    value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="EFT / cheque no." />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
                <textarea className="w-full min-h-[60px] rounded-xl border border-gray-300 px-3 py-2 text-sm resize-none"
                  value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)} disabled={saving}>Cancel</Button>
              <Button variant="primary" className="flex-1" onClick={submitPayment} isLoading={saving} disabled={saving}>Save Payment</Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
