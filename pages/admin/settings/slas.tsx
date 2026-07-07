import AdminSettingsShell from '../../../components/admin/settings/AdminSettingsShell';
import { SLAConfig } from '../../../components/admin/settings';

export default function AdminSLAsPage() {
  return (
    <AdminSettingsShell title="SLAs" subtitle="Define response times and reminder timing.">
      {({ getSetting, queueChange }) => (
        <div className="space-y-10">
          <SLAConfig getSetting={getSetting} queueChange={queueChange} />
        </div>
      )}
    </AdminSettingsShell>
  );
}
