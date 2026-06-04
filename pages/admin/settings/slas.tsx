import AdminSettingsShell from '../../../components/admin/settings/AdminSettingsShell';
import { SLAConfig, DelegationConfig } from '../../../components/admin/settings';

export default function AdminSLAsPage() {
  return (
    <AdminSettingsShell title="SLAs and Delegations" subtitle="Define response times and escalation rules, and review approval delegations.">
      {({ getSetting, queueChange }) => (
        <div className="space-y-10">
          <SLAConfig getSetting={getSetting} queueChange={queueChange} />
          <div className="pt-8 border-t border-border">
            <DelegationConfig />
          </div>
        </div>
      )}
    </AdminSettingsShell>
  );
}
