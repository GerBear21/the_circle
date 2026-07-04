import { useEffect, useRef } from 'react';
import { useToast } from './ui/ToastProvider';
import { getErrorMessage } from '../lib/getErrorMessage';

// Benign browser noise we never want to surface to users.
const IGNORED_PATTERNS = [
    'ResizeObserver loop',
    'Non-Error promise rejection captured',
];

function shouldIgnore(message: string): boolean {
    return IGNORED_PATTERNS.some((p) => message.includes(p));
}

/**
 * Registers global handlers for uncaught errors and unhandled promise
 * rejections. Anything that slips past local try/catch blocks (failed fetches,
 * async save failures, etc.) is turned into a friendly toast instead of a
 * silent failure or a raw error in the console-facing UI.
 */
export default function GlobalErrorListener() {
    const { addToast } = useToast();
    // Throttle identical errors so a misbehaving loop can't spam the user.
    const lastShown = useRef<{ message: string; at: number }>({ message: '', at: 0 });

    useEffect(() => {
        const notify = (raw: unknown) => {
            const message = getErrorMessage(raw);
            if (shouldIgnore(message)) return;

            const now = Date.now();
            if (lastShown.current.message === message && now - lastShown.current.at < 4000) {
                return;
            }
            lastShown.current = { message, at: now };

            addToast({
                type: 'error',
                title: 'Something went wrong',
                message,
            });
        };

        const handleError = (event: ErrorEvent) => {
            notify(event.error ?? event.message);
        };

        const handleRejection = (event: PromiseRejectionEvent) => {
            notify(event.reason);
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, [addToast]);

    return null;
}
