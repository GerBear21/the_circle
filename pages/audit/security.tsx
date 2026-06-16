import AuditPageShell from '../../components/audit/AuditPageShell';
import AuditEventExplorer from '../../components/audit/AuditEventExplorer';

export default function AuditSecurityPage() {
  return (
    <AuditPageShell
      title="Security Events"
      subtitle="Authentication, sessions, role and permission changes, step-up verification and other security-relevant actions."
    >
      <AuditEventExplorer fixedCategory="security" />
    </AuditPageShell>
  );
}
