import { ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AppHeader from './AppHeader';
import Sidebar from './Sidebar';
import SignatureRequiredModal from '../SignatureRequiredModal';
import ProfileSetupModal from '../ProfileSetupModal';
import { useSignatureCheck, useCurrentUser } from '@/hooks';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  hideNav?: boolean;
  hideSidebar?: boolean;
  skipSignatureCheck?: boolean;
}

export default function AppLayout({
  children,
  title,
  showBack,
  onBack,
  hideNav = false,
  hideSidebar = false,
  skipSignatureCheck = false
}: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();

  // Persist the desktop collapsed state so it survives page navigations
  // (AppLayout remounts on every route change).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('sidebar:collapsed') === 'true');
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('sidebar:collapsed', String(next)); } catch {}
      return next;
    });
  };
  const { hasSignature, loading: signatureLoading, refetch } = useSignatureCheck();
  const { user, loading: userLoading, needsProfileSetup, refetch: refetchUser } = useCurrentUser();

  // Pages that should skip signature check
  const isSettingsPage = router.pathname === '/profile/settings';
  const shouldCheckSignature = !skipSignatureCheck && !isSettingsPage;

  const handleSignatureSaved = async (url: string) => {
    await refetch();
  };

  const handleProfileSetupComplete = async () => {
    await refetchUser();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Profile Setup Modal - shown first if user needs to set up profile */}
      {!userLoading && user && needsProfileSetup && (
        <ProfileSetupModal
          isOpen={true}
          userId={user.id}
          currentOrganizationId={user.organization_id}
          currentDepartmentId={user.department_id ?? undefined}
          currentBusinessUnitId={user.business_unit_id ?? undefined}
          onComplete={handleProfileSetupComplete}
        />
      )}

      {/* Signature Required Modal - shown after profile is set up */}
      {shouldCheckSignature && !signatureLoading && !hasSignature && !needsProfileSetup && (
        <SignatureRequiredModal
          isOpen={true}
          onSignatureSaved={handleSignatureSaved}
        />
      )}

      {/* Sidebar for desktop and mobile */}
      {!hideSidebar && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      )}

      {/* Main content area */}
      <div className={`flex flex-col min-h-screen ${!hideSidebar ? (collapsed ? 'lg:pl-16' : 'lg:pl-64') : ''} transition-all duration-300`}>
        <AppHeader
          title={title}
          showBack={showBack}
          onBack={onBack}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          showMenuButton={!hideSidebar}
        />

        <main className={`flex-1 pb-4 max-w-8xl mx-auto w-full`}>
          {children}
        </main>
      </div>
    </div>
  );
}
