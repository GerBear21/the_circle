import AdminSettingsShell from '../../../components/admin/settings/AdminSettingsShell';
import { WorkflowDefaultsConfig } from '../../../components/admin/settings';

export default function AdminApprovalDefaultsPage() {
  return (
    <AdminSettingsShell title="Workflow Config" subtitle="Set default approval routing and workflow behaviour.">
      {({ getSetting, queueChange }) => <WorkflowDefaultsConfig getSetting={getSetting} queueChange={queueChange} />}
    </AdminSettingsShell>
  );
}
