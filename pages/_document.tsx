import Document, { DocumentContext, DocumentInitialProps, Html, Head, Main, NextScript } from 'next/document';
import { ServerStyleSheet } from 'styled-components';

export default class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps> {
    const sheet = new ServerStyleSheet();
    const originalRenderPage = ctx.renderPage;

    try {
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => (props) => sheet.collectStyles(<App {...props} />),
        });

      const initialProps = await Document.getInitialProps(ctx);
      return {
        ...initialProps,
        styles: (
          <>
            {initialProps.styles}
            {sheet.getStyleElement()}
          </>
        ),
      };
    } finally {
      sheet.seal();
    }
  }

  render() {
    return (
      <Html lang="en">
        <Head>
          {/* Theme color for mobile browsers */}
          <meta name="theme-color" content="#2D9CDB" />
          {/* Apple mobile web app capable */}
          <meta name="mobile-web-app-capable" content="yes" />
          {/* <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="The Circle" /> */}
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
}
