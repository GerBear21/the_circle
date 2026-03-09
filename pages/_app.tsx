import type { AppProps } from 'next/app';
import { SessionProvider, signOut, useSession } from "next-auth/react";
import Head from 'next/head';
import { useEffect, useState } from 'react';
import '../styles/globals.css';

import { ToastProvider } from '../components/ui/ToastProvider';
import { UserProvider } from '../contexts/UserContext';
import Loader from '../components/Loader';

const SESSION_FLAG = 'the_circle_active_session';

function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    if (session) {
      const hasFlag = sessionStorage.getItem(SESSION_FLAG);
      if (!hasFlag) {
        signOut({ callbackUrl: '/' });
        return;
      }
    }

    setChecked(true);
  }, [session, status]);

  if (status === 'loading' || !checked) {
    return <Loader />;
  }

  return <>{children}</>;
}

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <SessionGuard>
        <UserProvider>
          <ToastProvider>
            <Component {...pageProps} />
          </ToastProvider>
        </UserProvider>
      </SessionGuard>
    </SessionProvider>
  );
}
