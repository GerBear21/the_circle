import AuditPageShell from '../../components/audit/AuditPageShell';
import AuditEventExplorer from '../../components/audit/AuditEventExplorer';

export default function AuditActivityPage() {
  return (
    <AuditPageShell
      title="User Activity"
      subtitle="General user actions — document generation, downloads, exports and day-to-day usage."
    >
      <AuditEventExplorer fixedCategory="activity" />
    </AuditPageShell>
  );
}
