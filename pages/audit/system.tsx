import AuditPageShell from '../../components/audit/AuditPageShell';
import AuditEventExplorer from '../../components/audit/AuditEventExplorer';

export default function AuditSystemPage() {
  return (
    <AuditPageShell
      title="System Events"
      subtitle="Configuration changes, settings updates, integrations and other system-level operations."
    >
      <AuditEventExplorer fixedCategory="system" />
    </AuditPageShell>
  );
}
