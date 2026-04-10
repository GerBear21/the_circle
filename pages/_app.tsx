import type { AppProps } from 'next/app';
import { SessionProvider, signOut, useSession } from "next-auth/react";
import Head from 'next/head';
import { useEffect, useState } from 'react';
import '../styles/globals.css';

import { ToastProvider } from '../components/ui/ToastProvider';
import { UserProvider } from '../contexts/UserContext';
import { RBACProvider } from '../contexts/RBACContext';
import Loader from '../components/Loader';

const SESSION_FLAG = 'the_circle_active_session';

function SessionGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  // Show loader until we have a definitive session status
  // This prevents flashing the login UI during OAuth callback processing
  if (status === 'loading') {
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
          <RBACProvider>
            <ToastProvider>
              <Component {...pageProps} />
            </ToastProvider>
          </RBACProvider>
        </UserProvider>
      </SessionGuard>
    </SessionProvider>
  );
}
