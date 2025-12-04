import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#2D9CDB" />
        {/* Apple mobile web app capable */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="The Circle" />
        {/* Prevent text size adjustment on orientation change */}
        <meta name="format-detection" content="telephone=no" />
      </Head>
      <body className="font-sans antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
