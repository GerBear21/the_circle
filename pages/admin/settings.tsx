import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '../../components/layout';
import { Button } from '../../components/ui';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { useRBAC } from '../../contexts/RBACContext';
import {
  SLAConfig,
  RatesConfig,
  TravelConfig,
  FormsConfig,
  WorkflowDefaultsConfig,
  NotificationsConfig,
  AccessConfig,
  PreferencesConfig,
  NavButton,
  SLAIcon,
  RatesIcon,
  TravelIcon,
  FormsIcon,
  WorkflowIcon,
  NotificationIcon,
  AccessIcon,
  PreferencesIcon,
} from '../../components/admin/settings';

type TabType = 'slas' | 'rates' | 'travel' | 'forms' | 'workflows' | 'notifications' | 'access' | 'preferences';

export default function AdminSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { hasPermission } = useRBAC();
  const { settings, loading: settingsLoading, saving, saveSettings, getSetting } = useSystemSettings();
  const [activeTab, setActiveTab] = useState<TabType>('slas');
  const [pendingChanges, setPendingChanges] = useState<{ category: string; key: string; value: any }[]>([]);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const queueChange = useCallback((category: string, key: string, value: any) => {
    setPendingChanges(prev => {
      const filtered = prev.filter(c => !(c.category === category && c.key === key));
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
      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
    } else {
      setSaveMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    }
    setTimeout(() => setSaveMessage(null), 4000);
  };

  if (status === 'loading' || settingsLoading) {
    return (
      <AppLayout title="Settings">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  const NAV_ITEMS: { tab: TabType; icon: React.ReactNode; label: string; group: string }[] = [
    { tab: 'slas', icon: <SLAIcon />, label: 'SLAs & Escalations', group: 'Operations' },
    { tab: 'rates', icon: <RatesIcon />, label: 'Financial Rates', group: 'Operations' },
    { tab: 'travel', icon: <TravelIcon />, label: 'Travel & Distances', group: 'Operations' },
    { tab: 'forms', icon: <FormsIcon />, label: 'Form Configuration', group: 'Configuration' },
    { tab: 'workflows', icon: <WorkflowIcon />, label: 'Approval Defaults', group: 'Configuration' },
    { tab: 'notifications', icon: <NotificationIcon />, label: 'Notifications', group: 'Configuration' },
    { tab: 'access', icon: <AccessIcon />, label: 'Access & Rights', group: 'Administration' },
    { tab: 'preferences', icon: <PreferencesIcon />, label: 'System Preferences', group: 'Administration' },
  ];

  const groups = ['Operations', 'Configuration', 'Administration'];

  return (
    <AppLayout title="System Configuration">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 mb-8 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-float-slow"></div>
            <div className="absolute top-20 -left-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-overlay filter blur-3xl animate-float-medium"></div>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold font-heading mb-2">System Configuration</h1>
              <p className="text-blue-100 max-w-xl text-lg">
                Full administrative control over SLAs, rates, travel rules, form behaviour, workflows, notifications, and global preferences.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {pendingChanges.length > 0 && (
                <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                  {pendingChanges.length} unsaved change{pendingChanges.length > 1 ? 's' : ''}
                </span>
              )}
              <Button
                variant="primary"
                className="bg-white text-blue-700 hover:bg-blue-50 transition-all shadow-md font-semibold"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save All Changes'}
              </Button>
            </div>
          </div>

          {saveMessage && (
            <div className={`mt-4 px-4 py-2 rounded-xl text-sm font-medium ${
              saveMessage.type === 'success' ? 'bg-green-500/20 text-green-100' : 'bg-red-500/20 text-red-100'
            }`}>
              {saveMessage.text}
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sticky top-24 space-y-4">
              {groups.map(group => (
                <div key={group}>
                  <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{group}</p>
                  <div className="space-y-0.5">
                    {NAV_ITEMS.filter(n => n.group === group).map(n => (
                      <NavButton key={n.tab} active={activeTab === n.tab} onClick={() => setActiveTab(n.tab)} icon={n.icon} label={n.label} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {activeTab === 'slas' && <SLAConfig getSetting={getSetting} queueChange={queueChange} />}
            {activeTab === 'rates' && <RatesConfig getSetting={getSetting} queueChange={queueChange} />}
            {activeTab === 'travel' && <TravelConfig getSetting={getSetting} queueChange={queueChange} />}
            {activeTab === 'forms' && <FormsConfig getSetting={getSetting} queueChange={queueChange} />}
            {activeTab === 'workflows' && <WorkflowDefaultsConfig getSetting={getSetting} queueChange={queueChange} />}
            {activeTab === 'notifications' && <NotificationsConfig getSetting={getSetting} queueChange={queueChange} />}
            {activeTab === 'access' && <AccessConfig />}
            {activeTab === 'preferences' && <PreferencesConfig getSetting={getSetting} queueChange={queueChange} />}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
