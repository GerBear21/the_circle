import { useState, useEffect } from 'react';
import AuditPageShell from '../../components/audit/AuditPageShell';
import { CATEGORY_STYLES } from '../../components/audit/AuditEventExplorer';
import {
  Download,
  FileText,
  ShieldCheck,
  ShieldAlert,
  CalendarRange,
  Sparkles,
} from 'lucide-react';

interface ReportPreset {
  name: string;
  description: string;
  params: Record<string, string>;
}

function rangeDays(days: number) {
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: from.toISOString() };
}

const presets: ReportPreset[] = [
  { name: 'Full Audit Trail — 30 days', description: 'Every recorded event across all categories.', params: rangeDays(30) },
  { name: 'Security Report — 30 days', description: 'Logins, role changes, permission grants and security alerts.', params: { category: 'security', ...rangeDays(30) } },
  { name: 'Transactions Report — 90 days', description: 'Request lifecycle: creation, submission, approvals, rejections.', params: { category: 'transaction', ...rangeDays(90) } },
  { name: 'Failed & Denied Actions — 30 days', description: 'All unsuccessful or denied operations for exception review.', params: { outcome: 'failure', ...rangeDays(30) } },
  { name: 'Compliance Access Log — 90 days', description: 'Who accessed and exported the audit log itself.', params: { category: 'compliance', ...rangeDays(90) } },
];

export default function AuditReportsPage() {
  // Custom report builder state
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [outcome, setOutcome] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actorId, setActorId] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; display_name: string; email: string }>>([]);
  const [busy, setBusy] = useState<string | null>(null);

  // Load org users so the auditor can scope a report to one person's activity.
  useEffect(() => {
    fetch('/api/users')
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((data) => setUsers(data.users || []))
      .catch(() => { /* picker stays empty */ });
  }, []);

  // Integrity verification state
  const [verifying, setVerifying] = useState(false);
  const [integrity, setIntegrity] = useState<{
    isValid: boolean; eventsChecked: number; firstBrokenSequence: number | null; verifiedAt: string;
  } | null>(null);

  const download = async (params: Record<string, string>, format: 'csv' | 'pdf', key: string) => {
    try {
      setBusy(key);
      const qs = new URLSearchParams({ ...params, format });
      const resp = await fetch(`/api/audit/export?${qs.toString()}`);
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
      setBusy(null);
    }
  };

  const customParams = () => {
    const p: Record<string, string> = {};
    if (category) p.category = category;
    if (severity) p.severity = severity;
    if (outcome) p.outcome = outcome;
    if (actorId) p.actorId = actorId;
    if (from) p.from = new Date(from).toISOString();
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      p.to = end.toISOString();
    }
    return p;
  };

  const verify = async () => {
    try {
      setVerifying(true);
      const resp = await fetch('/api/audit/verify', { method: 'POST' });
      if (resp.ok) setIntegrity(await resp.json());
    } catch (e) {
      console.error(e);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <AuditPageShell
      title="Audit Reports"
      subtitle="Generate, filter and export evidence-grade reports from the immutable audit log — CSV for analysis, PDF for distribution."
    >
      {/* Integrity verification banner */}
      <div className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        integrity ? (integrity.isValid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200') : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-start gap-3">
          {integrity && !integrity.isValid
            ? <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" strokeWidth={1.5} />
            : <ShieldCheck className={`w-6 h-6 shrink-0 ${integrity ? 'text-emerald-600' : 'text-brand-500'}`} strokeWidth={1.5} />}
          <div>
            <h3 className="font-bold text-gray-900">Cryptographic Integrity Verification</h3>
            <p className="text-sm text-gray-600 mt-0.5">
              {integrity
                ? integrity.isValid
                  ? `Chain intact — ${integrity.eventsChecked.toLocaleString()} entries verified at ${new Date(integrity.verifiedAt).toLocaleString()}. No record has been altered or removed.`
                  : `TAMPERING DETECTED at sequence #${integrity.firstBrokenSequence}. Escalate immediately — records at and after this point cannot be trusted.`
                : 'Re-computes the SHA-256 hash chain across every audit entry to prove that no record has been modified or deleted (ISO 27001 A.8.15).'}
            </p>
          </div>
        </div>
        <button
          onClick={verify}
          disabled={verifying}
          className="shrink-0 px-4 py-2.5 rounded-xl bg-brand-600 text-white font-medium text-sm hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {verifying ? 'Verifying…' : 'Verify Now'}
        </button>
      </div>

      {/* Preset reports */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-500" strokeWidth={1.5} />
          One-click Reports
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {presets.map((preset) => (
            <div key={preset.name} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:border-brand-200 transition-colors flex flex-col">
              <h3 className="font-semibold text-gray-900">{preset.name}</h3>
              <p className="text-sm text-gray-500 mt-1 flex-1">{preset.description}</p>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => download(preset.params, 'csv', preset.name + 'csv')}
                  disabled={!!busy}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 font-medium text-xs hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {busy === preset.name + 'csv' ? 'Exporting…' : 'CSV'}
                </button>
                <button
                  onClick={() => download(preset.params, 'pdf', preset.name + 'pdf')}
                  disabled={!!busy}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-brand-50 text-brand-600 font-medium text-xs hover:bg-brand-100 transition-colors disabled:opacity-50"
                >
                  <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {busy === preset.name + 'pdf' ? 'Exporting…' : 'PDF'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom report builder */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-brand-500" strokeWidth={1.5} />
          Custom Report Builder
        </h2>
        <p className="text-sm text-gray-500 mb-5">Combine any filters — including a specific user — then export the matching evidence as CSV or PDF.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">User</label>
            <select value={actorId} onChange={(e) => setActorId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-brand-500 cursor-pointer">
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-brand-500 cursor-pointer">
              <option value="">All</option>
              {Object.entries(CATEGORY_STYLES).map(([key, v]) => (
                <option key={key} value={key}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-brand-500 cursor-pointer">
              <option value="">All</option>
              <option value="info">Info</option>
              <option value="notice">Notice</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Outcome</label>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-brand-500 cursor-pointer">
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="denied">Denied</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-brand-500" />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-5">
          <button
            onClick={() => download(customParams(), 'csv', 'custom-csv')}
            disabled={!!busy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" strokeWidth={1.5} />
            {busy === 'custom-csv' ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            onClick={() => download(customParams(), 'pdf', 'custom-pdf')}
            disabled={!!busy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white font-medium text-sm hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            <FileText className="w-4 h-4" strokeWidth={1.5} />
            {busy === 'custom-pdf' ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* ISO compliance footnote */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 text-sm text-gray-600 leading-relaxed">
        <h3 className="font-bold text-gray-900 mb-2">Compliance Notes</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>ISO/IEC 27001:2022 A.8.15 (Logging):</strong> events record who, what, when, where (IP / user agent) and the outcome; logs are append-only and protected from modification, including by administrators.</li>
          <li><strong>ISO/IEC 27001:2022 A.8.16 (Monitoring):</strong> the audit dashboard surfaces anomalies, failed/denied operations, and warning/critical alerts for review.</li>
          <li><strong>ISO 15489 (Records):</strong> every export is itself recorded in the log (category: compliance), preserving a complete chain of custody for audit evidence.</li>
          <li><strong>Tamper evidence:</strong> each entry is sealed with SHA-256 and chained to its predecessor; verification recomputes the full chain on demand.</li>
        </ul>
      </div>
    </AuditPageShell>
  );
}
