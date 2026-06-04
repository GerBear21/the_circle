import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '../../layout';
import { Button } from '../../ui';
import { useSystemSettings } from '../../../hooks/useSystemSettings';

interface ShellApi {
  getSetting: (category: string, key: string, defaultValue?: any) => any;
  queueChange: (category: string, key: string, value: any) => void;
}

interface AdminSettingsShellProps {
  title: string;
  subtitle?: string;
  /** When true, the section has no editable settings (e.g. Access) so the
   *  Save button and change tracking are hidden. */
  readOnly?: boolean;
  children: (api: ShellApi) => React.ReactNode;
}

export default function AdminSettingsShell({ title, subtitle, readOnly = false, children }: AdminSettingsShellProps) {
  const { status } = useSession();
  const router = useRouter();
  const { loading: settingsLoading, saving, saveSettings, getSetting } = useSystemSettings();
  const [pendingChanges, setPendingChanges] = useState<{ category: string; key: string; value: any }[]>([]);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  const queueChange = useCallback((category: string, key: string, value: any) => {
    setPendingChanges((prev) => {
      const filtered = prev.filter((c) => !(c.category === category && c.key === key));
      return [...filtered, { category, key, value }];
    });
  }, []);

  const handleSave = async () => {
    if (pendingChanges.length === 0) {
      setSaveMessage({ type: 'success', text: 'No changes to save.' });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }
    const ok = await saveSettings(pendingChanges);
    if (ok) {
      setPendingChanges([]);
      setSaveMessage({ type: 'success', text: 'Settings saved successfully.' });
    } else {
      setSaveMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    }
    setTimeout(() => setSaveMessage(null), 4000);
  };

  if (status === 'loading' || settingsLoading) {
    return (
      <AppLayout title={title}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={title}>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-border p-6 sm:p-7 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">{title}</h1>
              {subtitle && <p className="text-text-secondary mt-1.5 text-sm sm:text-base leading-relaxed max-w-xl">{subtitle}</p>}
            </div>
            {!readOnly && (
              <div className="flex items-center gap-3 shrink-0">
                {pendingChanges.length > 0 && (
                  <span className="text-xs font-medium bg-neutral-100 text-text-secondary px-3 py-1.5 rounded-full">
                    {pendingChanges.length} unsaved change{pendingChanges.length > 1 ? 's' : ''}
                  </span>
                )}
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </div>

          {saveMessage && (
            <div className={`mt-4 px-4 py-2.5 rounded-xl text-sm font-medium border ${
              saveMessage.type === 'success' ? 'bg-success-50 text-success-600 border-success-100' : 'bg-danger-50 text-danger-600 border-danger-100'
            }`}>
              {saveMessage.text}
            </div>
          )}
        </div>

        {/* Section content */}
        <div>{children({ getSetting, queueChange })}</div>
      </div>
    </AppLayout>
  );
}
