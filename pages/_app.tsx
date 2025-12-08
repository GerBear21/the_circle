import type { AppProps } from 'next/app';
import { SessionProvider } from "next-auth/react";
import Head from 'next/head';
import '../styles/globals.css';

import { ToastProvider } from '../components/ui/ToastProvider';

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <ToastProvider>
        <Component {...pageProps} />
      </ToastProvider>
    </SessionProvider>
  );
}
