import AdminSettingsShell from '../../../components/admin/settings/AdminSettingsShell';
import { FormsConfig } from '../../../components/admin/settings';

export default function AdminFormsPage() {
  return (
    <AdminSettingsShell title="Form Configuration" subtitle="Control how request forms behave across the system.">
      {({ getSetting, queueChange }) => <FormsConfig getSetting={getSetting} queueChange={queueChange} />}
    </AdminSettingsShell>
  );
}
