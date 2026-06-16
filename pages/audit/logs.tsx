import AuditPageShell from '../../components/audit/AuditPageShell';
import AuditEventExplorer from '../../components/audit/AuditEventExplorer';

export default function AuditLogsPage() {
  return (
    <AuditPageShell
      title="Immutable Logs"
      subtitle="Every action taken in the system, sealed in an append-only SHA-256 hash chain. Filter, sort, inspect and export."
    >
      <AuditEventExplorer />
    </AuditPageShell>
  );
}
