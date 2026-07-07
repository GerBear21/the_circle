import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../../components/layout';
import Loader from '@/components/Loader';
import { useRBAC } from '../../contexts/RBACContext';
import { Bug, Plus, RefreshCw, CheckCircle2, Clock, CircleDot, XCircle } from 'lucide-react';

/**
 * Bug Reports
 * -----------
 * Every user can file a bug and track the status of their own reports.
 * System/super admins (admin.system_config) additionally get an "All reports"
 * tab where they triage: change status, set severity, and leave a resolution
 * note. The reporter is notified in-app whenever the status changes.
 */

type BugStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type BugSeverity = 'low' | 'medium' | 'high' | 'critical';

interface BugReport {
  id: string;
  title: string;
  description: string;
  severity: BugSeverity;
  status: BugStatus;
  page_url: string | null;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  reporter?: { id: string; display_name: string | null; email: string | null } | null;
  resolver?: { id: string; display_name: string | null } | null;
}

const STATUS_META: Record<BugStatus, { label: string; classes: string; Icon: typeof CircleDot }> = {
  open: { label: 'Open', classes: 'bg-amber-50 text-amber-700 border-amber-200', Icon: CircleDot },
  in_progress: { label: 'In Progress', classes: 'bg-blue-50 text-blue-700 border-blue-200', Icon: Clock },
  resolved: { label: 'Resolved', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  closed: { label: 'Closed', classes: 'bg-neutral-100 text-neutral-600 border-neutral-200', Icon: XCircle },
};

const SEVERITY_CLASSES: Record<BugSeverity, string> = {
  low: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-danger-50 text-danger-700 border-danger-200',
};

function StatusChip({ status }: { status: BugStatus }) {
  const meta = STATUS_META[status] || STATUS_META.open;
  const Icon = meta.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.classes}`}>
      <Icon className="w-3 h-3" strokeWidth={2} />
      {meta.label}
    </span>
  );
}

function SeverityChip({ severity }: { severity: BugSeverity }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${SEVERITY_CLASSES[severity] || SEVERITY_CLASSES.medium}`}>
      {severity}
    </span>
  );
}

// ---------------------------------------------------------------------------
// New report modal
// ---------------------------------------------------------------------------
function NewBugModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<BugSeverity>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (title.trim().length < 3 || description.trim().length < 3) {
      setError('Please give the issue a title and describe what happened.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          severity,
          // Where the user came from when they opened the bug page.
          pageUrl: typeof document !== 'undefined' ? document.referrer || '' : '',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to submit bug report');
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit bug report');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={submitting ? undefined : onClose} aria-hidden="true" />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Report a bug</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Describe the problem — the system administrator will be notified and you&apos;ll hear back once it&apos;s reviewed.
            </p>
          </div>
          <div className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">{error}</div>
            )}
            <label className="block">
              <span className="text-sm font-medium text-gray-700">What went wrong?</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="e.g. Signature pad draws away from my finger"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Details</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                rows={5}
                placeholder="What were you doing? What did you expect? What happened instead?"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">How badly does it affect you?</span>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as BugSeverity)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="low">Low — cosmetic / minor annoyance</option>
                <option value="medium">Medium — I can work around it</option>
                <option value="high">High — blocks part of my work</option>
                <option value="critical">Critical — I cannot work at all</option>
              </select>
            </label>
          </div>
          <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex gap-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex-1 py-2.5 px-4 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Submitting…
                </>
              ) : (
                'Submit report'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin triage panel (inline, per bug)
// ---------------------------------------------------------------------------
function AdminTriage({ bug, onSaved }: { bug: BugReport; onSaved: () => void }) {
  const [status, setStatus] = useState<BugStatus>(bug.status);
  const [notes, setNotes] = useState(bug.admin_notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = status !== bug.status || notes !== (bug.admin_notes || '');

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/bugs/${bug.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNotes: notes }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to update');
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-gray-200 space-y-2">
      {error && <p className="text-xs text-danger-600">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BugStatus)}
          className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-primary-500"
        >
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed (won&apos;t fix / duplicate)</option>
        </select>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={5000}
          placeholder="Resolution note (sent to the reporter)"
          className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500"
        />
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function BugReportsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { hasPermission, loading: rbacLoading } = useRBAC();
  const isAdmin = !rbacLoading && hasPermission('admin.system_config');

  const [tab, setTab] = useState<'own' | 'all'>('own');
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | BugStatus>('all');

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/');
  }, [authStatus, router]);

  const load = useCallback(async (scope: 'own' | 'all') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bugs${scope === 'all' ? '?scope=all' : ''}`);
      if (res.ok) {
        const json = await res.json();
        setBugs(json.bugs || []);
      }
    } catch {
      /* keep whatever is on screen */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') load(tab);
  }, [authStatus, tab, load]);

  if (authStatus === 'loading') {
    return (
      <AppLayout title="Bug Reports">
        <Loader fullScreen={false} />
      </AppLayout>
    );
  }
  if (!session) return null;

  const visibleBugs = statusFilter === 'all' ? bugs : bugs.filter((b) => b.status === statusFilter);

  return (
    <AppLayout title="Bug Reports">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="rounded-2xl bg-white border border-border p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-neutral-700" strokeWidth={1.5} />
              <h1 className="text-xl font-bold text-text-primary tracking-tight">Bug Reports</h1>
            </div>
            <p className="text-sm text-text-secondary mt-1">
              Found something broken? Log it here — you&apos;ll be notified when it has been reviewed or fixed.
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 shrink-0"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Report a bug
          </button>
        </div>

        {/* Tabs + filters */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTab('own')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              tab === 'own' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            My reports
          </button>
          {isAdmin && (
            <button
              onClick={() => setTab('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                tab === 'all' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              All reports
            </button>
          )}
          <div className="flex-1" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <button
            onClick={() => load(tab)}
            className="p-1.5 border border-gray-300 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>
        ) : visibleBugs.length === 0 ? (
          <div className="rounded-2xl bg-white border border-border p-10 text-center">
            <Bug className="w-8 h-8 text-neutral-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium text-gray-900">No bug reports {statusFilter !== 'all' ? `with status "${STATUS_META[statusFilter as BugStatus]?.label}"` : 'yet'}</p>
            <p className="text-xs text-gray-500 mt-1">When you report an issue it will appear here with its current status.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleBugs.map((bug) => (
              <div key={bug.id} className="rounded-2xl bg-white border border-border p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">{bug.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {tab === 'all' && bug.reporter && (
                        <>Reported by {bug.reporter.display_name || bug.reporter.email || 'Unknown'} · </>
                      )}
                      {new Date(bug.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <SeverityChip severity={bug.severity} />
                    <StatusChip status={bug.status} />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{bug.description}</p>
                {bug.page_url && (
                  <p className="text-xs text-gray-400 mt-1.5 truncate">Page: {bug.page_url}</p>
                )}
                {bug.admin_notes && tab === 'own' && (
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Response from admin</p>
                    <p className="text-sm text-gray-700">{bug.admin_notes}</p>
                  </div>
                )}
                {isAdmin && tab === 'all' && (
                  <AdminTriage bug={bug} onSaved={() => load('all')} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <NewBugModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            setTab('own');
            load('own');
          }}
        />
      )}
    </AppLayout>
  );
}
