import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { AppLayout } from '../../components/layout';
import { Card, Button } from '../../components/ui';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <AppLayout title="Settings">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <AppLayout title="Settings">
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Profile Section */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Profile</h3>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-semibold text-xl">
              {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || '?'}
            </div>
            <div>
              <p className="font-medium text-gray-900">{session.user?.name || 'User'}</p>
              <p className="text-sm text-gray-500">{session.user?.email}</p>
              <p className="text-xs text-gray-400 mt-1">
                Role: {(session.user as any)?.role || 'User'}
              </p>
            </div>
          </div>
        </Card>

        {/* Preferences */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Preferences</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-500">Receive email for new approvals</p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-brand-500">
                <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition" />
              </button>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-900">Push Notifications</p>
                <p className="text-sm text-gray-500">Get notified on your device</p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
                <span className="translate-x-1 inline-block h-4 w-4 transform rounded-full bg-white transition" />
              </button>
            </div>
          </div>
        </Card>

        {/* Admin Section (conditional) */}
        {((session.user as any)?.role === 'admin' || (session.user as any)?.role === 'owner') && (
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Administration</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center justify-between py-3 px-1 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <span className="font-medium text-gray-900">Manage Users</span>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button className="w-full flex items-center justify-between py-3 px-1 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <span className="font-medium text-gray-900">Workflow Templates</span>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button className="w-full flex items-center justify-between py-3 px-1 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <span className="font-medium text-gray-900">Audit Logs</span>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </Card>
        )}

        {/* Sign Out */}
        <Card>
          <Button
            variant="danger"
            className="w-full"
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            Sign Out
          </Button>
        </Card>

        {/* App Info */}
        <div className="text-center text-xs text-gray-400 pt-4">
          <p>The Circle v0.1.0</p>
          <p className="mt-1">Approval workflows made simple</p>
        </div>
      </div>
    </AppLayout>
  );
}
