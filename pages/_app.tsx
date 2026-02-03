import type { AppProps } from 'next/app';
import { SessionProvider } from "next-auth/react";
import Head from 'next/head';
import '../styles/globals.css';

import { ToastProvider } from '../components/ui/ToastProvider';
import { UserProvider } from '../contexts/UserContext';

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <UserProvider>
        <ToastProvider>
          <Component {...pageProps} />
        </ToastProvider>
      </UserProvider>
    </SessionProvider>
  );
}
