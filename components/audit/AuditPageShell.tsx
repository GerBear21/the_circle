import Head from 'next/head';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { AppLayout } from '../layout';
import AuditAccessGate from './AuditAccessGate';
import AuditSectionTabs from './AuditSectionTabs';

interface ShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

/** Standard page chrome for the /audit/* sub-pages: header + section tabs. */
export default function AuditPageShell({ title, subtitle, children }: ShellProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <AppLayout title={title}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      </AppLayout>
    );
  }
  if (!session) return null;

  return (
    <AuditAccessGate title={title}>
      <AppLayout title={title}>
        <Head><title>{title} | The Circle</title></Head>
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 font-heading tracking-tight">{title}</h1>
            <p className="text-gray-500 mt-1">{subtitle}</p>
          </div>
          <AuditSectionTabs />
          {children}
        </div>
      </AppLayout>
    </AuditAccessGate>
  );
}
