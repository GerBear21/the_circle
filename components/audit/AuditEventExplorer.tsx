import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X,
  Lock,
  RefreshCw,
} from 'lucide-react';

export interface AuditEvent {
  id: string;
  sequence_number: number;
  occurred_at: string;
  category: string;
  action: string;
  severity: 'info' | 'notice' | 'warning' | 'critical';
  outcome: 'success' | 'failure' | 'denied';
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  actor_roles: string | null;
  ip_address: string | null;
  user_agent: string | null;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  request_id: string | null;
  details: Record<string, any>;
  prev_hash: string;
  entry_hash: string;
}

export const CATEGORY_STYLES: Record<string, { label: string; chip: string }> = {
  security: { label: 'Security', chip: 'bg-red-50 text-red-700 ring-red-100' },
  system: { label: 'System', chip: 'bg-violet-50 text-violet-700 ring-violet-100' },
  activity: { label: 'Activity', chip: 'bg-sky-50 text-sky-700 ring-sky-100' },
  transaction: { label: 'Transaction', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  workflow: { label: 'Workflow', chip: 'bg-amber-50 text-amber-700 ring-amber-100' },
  data: { label: 'Data', chip: 'bg-cyan-50 text-cyan-700 ring-cyan-100' },
  compliance: { label: 'Compliance', chip: 'bg-indigo-50 text-indigo-700 ring-indigo-100' },
};

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-gray-100 text-gray-600',
  notice: 'bg-blue-50 text-blue-700',
  warning: 'bg-amber-50 text-amber-700',
  critical: 'bg-red-50 text-red-700',
};

const OUTCOME_STYLES: Record<string, string> = {
  success: 'text-emerald-600',
  failure: 'text-red-600',
  denied: 'text-amber-600',
};

export function formatEventTime(d: string) {
  const date = new Date(d);
  return `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

interface ExplorerProps {
  /** Lock the explorer to one category (e.g. the Security Events page). */
  fixedCategory?: string;
  /** Compact mode hides some columns (used for embedding). */
  compact?: boolean;
}

/**
 * The immutable audit log explorer — filter, sort, paginate, inspect and
 * export entries from the hash-chained audit_events table.
 */
export default function AuditEventExplorer({ fixedCategory, compact }: ExplorerProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState(fixedCategory || '');
  const [severity, setSeverity] = useState('');
  const [outcome, setOutcome] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortBy, setSortBy] = useState<'occurred_at' | 'severity' | 'category' | 'action' | 'actor_name'>('occurred_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (fixedCategory || category) params.set('category', fixedCategory || category);
    if (severity) params.set('severity', severity);
    if (outcome) params.set('outcome', outcome);
    if (from) params.set('from', new Date(from).toISOString());
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      params.set('to', end.toISOString());
    }
    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);
    return params;
  }, [debouncedSearch, fixedCategory, category, severity, outcome, from, to, sortBy, sortOrder]);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams(queryString);
      params.set('page', String(page));
      params.set('pageSize', '50');
      const resp = await fetch(`/api/audit/events?${params.toString()}`);
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load audit events');
      }
      const data = await resp.json();
      setEvents(data.events || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [queryString, page]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { setPage(1); }, [queryString]);

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      setExporting(format);
      const params = new URLSearchParams(queryString);
      params.set('format', format);
      const resp = await fetch(`/api/audit/export?${params.toString()}`);
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_report_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(null);
    }
  };

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortOrder('desc'); }
  };

  const SortHeader = ({ col, children }: { col: typeof sortBy; children: React.ReactNode }) => (
    <button
      onClick={() => toggleSort(col)}
      className={`flex items-center gap-1 uppercase tracking-wider text-[11px] font-bold ${sortBy === col ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}
    >
      {children}
      <ArrowUpDown className="w-3 h-3" strokeWidth={2} />
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search action, actor, target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!fixedCategory && (
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-brand-500 cursor-pointer">
                <option value="">All Categories</option>
                {Object.entries(CATEGORY_STYLES).map(([key, v]) => (
                  <option key={key} value={key}>{v.label}</option>
                ))}
              </select>
            )}
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-brand-500 cursor-pointer">
              <option value="">All Severities</option>
              <option value="info">Info</option>
              <option value="notice">Notice</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-brand-500 cursor-pointer">
              <option value="">All Outcomes</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="denied">Denied</option>
            </select>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-brand-500" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-brand-500" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400 font-medium flex items-center gap-2">
            <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>{total.toLocaleString()} immutable entries — append-only, SHA-256 hash-chained</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchEvents}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            </button>
            <button onClick={() => handleExport('csv')} disabled={!!exporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 font-medium text-xs hover:bg-gray-100 transition-colors disabled:opacity-50">
              <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
              {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
            </button>
            <button onClick={() => handleExport('pdf')} disabled={!!exporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-50 text-brand-600 font-medium text-xs hover:bg-brand-100 transition-colors disabled:opacity-50">
              <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
              {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {error ? (
          <div className="p-10 text-center text-red-600 text-sm font-medium">{error}</div>
        ) : loading && events.length === 0 ? (
          <div className="p-16 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
          </div>
        ) : events.length === 0 ? (
          <div className="p-16 text-center text-gray-400 text-sm">No audit events match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-4 py-3 text-left w-16"><SortHeader col="occurred_at">#</SortHeader></th>
                  <th className="px-4 py-3 text-left"><SortHeader col="occurred_at">Time</SortHeader></th>
                  {!fixedCategory && <th className="px-4 py-3 text-left"><SortHeader col="category">Category</SortHeader></th>}
                  <th className="px-4 py-3 text-left"><SortHeader col="action">Action</SortHeader></th>
                  <th className="px-4 py-3 text-left"><SortHeader col="actor_name">Actor</SortHeader></th>
                  {!compact && <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">Target</th>}
                  <th className="px-4 py-3 text-left"><SortHeader col="severity">Severity</SortHeader></th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {events.map((e) => (
                  <tr key={e.id} onClick={() => setSelected(e)}
                    className="hover:bg-brand-50/30 cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{e.sequence_number}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs font-mono">{formatEventTime(e.occurred_at)}</td>
                    {!fixedCategory && (
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${CATEGORY_STYLES[e.category]?.chip || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
                          {CATEGORY_STYLES[e.category]?.label || e.category}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-gray-900">{e.action}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {(e.actor_name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate max-w-[140px]">{e.actor_name || 'System'}</span>
                      </div>
                    </td>
                    {!compact && (
                      <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[180px]">
                        {e.target_label || e.target_id || '—'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${SEVERITY_STYLES[e.severity]}`}>
                        {e.severity}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-xs font-semibold capitalize ${OUTCOME_STYLES[e.outcome]}`}>{e.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/40">
            <span className="text-xs text-gray-500">Page {page} of {totalPages} — {total.toLocaleString()} entries</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40">
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <div className="text-xs opacity-80 font-mono">Entry #{selected.sequence_number} — {formatEventTime(selected.occurred_at)}</div>
                <h2 className="text-lg font-bold">{selected.action}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  ['Category', CATEGORY_STYLES[selected.category]?.label || selected.category],
                  ['Severity', selected.severity],
                  ['Outcome', selected.outcome],
                  ['Actor', selected.actor_name || 'System'],
                  ['Actor Email', selected.actor_email || '—'],
                  ['Roles', selected.actor_roles || '—'],
                  ['IP Address', selected.ip_address || '—'],
                  ['Target Type', selected.target_type || '—'],
                  ['Target', selected.target_label || selected.target_id || '—'],
                ].map(([label, value]) => (
                  <div key={label as string} className="bg-gray-50 rounded-xl p-3">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
                    <div className="text-sm font-semibold text-gray-900 capitalize break-words">{value}</div>
                  </div>
                ))}
              </div>

              {selected.user_agent && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">User Agent</div>
                  <div className="text-xs font-mono text-gray-600 break-all">{selected.user_agent}</div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Details</h3>
                <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(selected.details, null, 2)}
                </pre>
              </div>

              <div className="border border-emerald-100 bg-emerald-50/50 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold uppercase tracking-wide">
                  <Lock className="w-3.5 h-3.5" strokeWidth={2} />
                  Tamper-evidence (SHA-256 chain)
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide">Entry Hash</div>
                  <div className="text-[11px] font-mono text-gray-700 break-all">{selected.entry_hash}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide">Previous Hash</div>
                  <div className="text-[11px] font-mono text-gray-700 break-all">{selected.prev_hash}</div>
                </div>
              </div>

              {selected.request_id && (
                <a href={`/requests/${selected.request_id}`}
                  className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium">
                  View linked request
                  <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
