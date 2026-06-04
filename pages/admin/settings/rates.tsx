import AdminSettingsShell from '../../../components/admin/settings/AdminSettingsShell';
import { RatesConfig } from '../../../components/admin/settings';

export default function AdminRatesPage() {
  return (
    <AdminSettingsShell title="Financial Rates" subtitle="Manage currency, allowance and reimbursement rates used across requests.">
      {({ getSetting, queueChange }) => <RatesConfig getSetting={getSetting} queueChange={queueChange} />}
    </AdminSettingsShell>
  );
}
