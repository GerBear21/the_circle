import { ReactNode, useState } from 'react';
import { useRouter } from 'next/router';
import AppHeader from './AppHeader';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
import SignatureRequiredModal from '../SignatureRequiredModal';
import { useSignatureCheck } from '@/hooks';

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
  const router = useRouter();
  const { hasSignature, loading: signatureLoading, refetch } = useSignatureCheck();

  // Pages that should skip signature check
  const isSettingsPage = router.pathname === '/profile/settings';
  const shouldCheckSignature = !skipSignatureCheck && !isSettingsPage;

  const handleSignatureSaved = async (url: string) => {
    await refetch();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Signature Required Modal */}
      {shouldCheckSignature && !signatureLoading && !hasSignature && (
        <SignatureRequiredModal
          isOpen={true}
          onSignatureSaved={handleSignatureSaved}
        />
      )}

      {/* Sidebar for desktop and mobile */}
      {!hideSidebar && (
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}

      {/* Main content area */}
      <div className={`flex flex-col min-h-screen ${!hideSidebar ? 'lg:pl-64' : ''}`}>
        <AppHeader
          title={title}
          showBack={showBack}
          onBack={onBack}
          onMenuClick={() => setSidebarOpen(true)}
          showMenuButton={!hideSidebar}
        />

        <main className={`flex-1 ${hideNav ? 'pb-4' : 'pb-20 lg:pb-4'} max-w-8xl mx-auto w-full`}>
          {children}
        </main>

        {/* Mobile bottom nav - only show on mobile */}
        {!hideNav && <div className="lg:hidden"><BottomNav /></div>}
      </div>
    </div>
  );
}
