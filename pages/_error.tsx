import Head from 'next/head';
import Link from 'next/link';
import type { NextPageContext } from 'next';
import FeedbackLottie from '../components/ui/FeedbackLottie';

interface ErrorPageProps {
    statusCode?: number;
}

/**
 * Custom error page. Next.js renders this for server-side errors and as the
 * production fallback for client-side errors, so users get a friendly screen
 * with the error animation instead of a raw stack trace.
 */
function ErrorPage({ statusCode }: ErrorPageProps) {
    const title = statusCode
        ? `Error ${statusCode}`
        : 'Something went wrong';

    return (
        <>
            <Head>
                <title>{title} | The Circle</title>
            </Head>
            <div className="min-h-screen w-full bg-[#FAFAFA] flex flex-col items-center justify-center px-6 text-center">
                <div className="w-full max-w-md mx-auto flex flex-col items-center">
                    <FeedbackLottie type="error" size={160} />

                    <h1 className="mt-4 text-2xl font-semibold text-neutral-900 tracking-tight">
                        {statusCode ? 'This page ran into a problem' : 'Something went wrong'}
                    </h1>
                    <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
                        {statusCode
                            ? `A server error (${statusCode}) occurred while loading this page.`
                            : 'An unexpected error occurred while loading this page.'}{' '}
                        Please try again in a moment.
                    </p>

                    <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                        <Link
                            href="/dashboard"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-6 rounded-full transition-colors active:scale-[0.98]"
                        >
                            Return to dashboard
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext): ErrorPageProps => {
    const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
    return { statusCode };
};

export default ErrorPage;
