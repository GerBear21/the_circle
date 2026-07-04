import React from 'react';
import FeedbackLottie from './ui/FeedbackLottie';

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

/**
 * App-wide error boundary. Catches any render-time error in the React tree so
 * users never see a raw stack trace / red error screen. Shows a friendly
 * fallback with the error animation and a way to recover.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Log for developers/monitoring — never surfaced to the user.
        // eslint-disable-next-line no-console
        console.error('Caught by ErrorBoundary:', error, info?.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false });
    };

    handleReload = () => {
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        return (
            <div className="min-h-screen w-full bg-[#FAFAFA] flex flex-col items-center justify-center px-6 text-center">
                <div className="w-full max-w-md mx-auto flex flex-col items-center">
                    <FeedbackLottie type="error" size={160} />

                    <h1 className="mt-4 text-2xl font-semibold text-neutral-900 tracking-tight">
                        Something went wrong
                    </h1>
                    <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
                        An unexpected error occurred and this screen couldn&apos;t be displayed.
                        Your data is safe. You can try again or head back to the dashboard.
                    </p>

                    <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={this.handleReload}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-6 rounded-full transition-colors active:scale-[0.98]"
                        >
                            Try again
                        </button>
                        {/* Hard navigation (not next/link) is intentional: a full reload
                            discards the corrupted React tree that triggered this fallback. */}
                        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                        <a
                            href="/dashboard"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white border border-neutral-200 text-neutral-800 hover:bg-neutral-50 font-semibold py-3 px-6 rounded-full transition-colors active:scale-[0.98]"
                        >
                            Return to dashboard
                        </a>
                    </div>
                </div>
            </div>
        );
    }
}
