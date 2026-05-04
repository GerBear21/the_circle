import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

interface PendingExit {
    url: string;
    shallow: boolean;
}

interface Options {
    /** Whether the form has unsaved changes. */
    isDirty: boolean;
    /** Whether to disable the prompt (e.g. while actively saving/submitting). */
    disabled?: boolean;
}

/**
 * Intercepts router navigation and tab close while the form is dirty.
 * Returns state needed to render a confirmation modal with Save-as-draft / Discard / Cancel options.
 *
 * Usage:
 *   const prompt = useUnsavedChangesPrompt({ isDirty });
 *   prompt.isOpen → show your modal
 *   prompt.saveDraftAndContinue(async () => await saveDraft())
 *   prompt.discardAndContinue()
 *   prompt.cancel()
 */
export function useUnsavedChangesPrompt({ isDirty, disabled = false }: Options) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const pendingExitRef = useRef<PendingExit | null>(null);
    const allowNextNavigationRef = useRef(false);

    useEffect(() => {
        if (disabled) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!isDirty) return;
            e.preventDefault();
            e.returnValue = '';
        };

        const handleRouteChangeStart = (url: string, { shallow }: { shallow: boolean }) => {
            if (!isDirty || allowNextNavigationRef.current) {
                allowNextNavigationRef.current = false;
                return;
            }
            if (url === router.asPath) return;
            pendingExitRef.current = { url, shallow };
            setIsOpen(true);
            // Throw to abort the navigation — Next's routeChangeStart supports this pattern.
            router.events.emit('routeChangeError');
            // eslint-disable-next-line no-throw-literal
            throw 'Route change aborted by unsaved-changes prompt.';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        router.events.on('routeChangeStart', handleRouteChangeStart);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            router.events.off('routeChangeStart', handleRouteChangeStart);
        };
    }, [isDirty, disabled, router]);

    const proceedWithPendingExit = () => {
        const pending = pendingExitRef.current;
        pendingExitRef.current = null;
        setIsOpen(false);
        if (pending) {
            allowNextNavigationRef.current = true;
            router.push(pending.url);
        }
    };

    const saveDraftAndContinue = async (saveDraft: () => Promise<void> | void) => {
        try {
            // Allow saveDraft to perform its own navigation (e.g. router.push after POST).
            allowNextNavigationRef.current = true;
            await saveDraft();
            // If saveDraft handled its own navigation, bail out.
            if (!pendingExitRef.current) {
                setIsOpen(false);
                return;
            }
            proceedWithPendingExit();
        } catch {
            allowNextNavigationRef.current = false;
            setIsOpen(false);
        }
    };

    const discardAndContinue = () => {
        proceedWithPendingExit();
    };

    const cancel = () => {
        pendingExitRef.current = null;
        setIsOpen(false);
    };

    /** Programmatically request an exit (e.g. from a back/cancel button). */
    const requestExit = (url: string) => {
        if (!isDirty || disabled) {
            allowNextNavigationRef.current = true;
            router.push(url);
            return;
        }
        pendingExitRef.current = { url, shallow: false };
        setIsOpen(true);
    };

    return {
        isOpen,
        saveDraftAndContinue,
        discardAndContinue,
        cancel,
        requestExit,
    };
}
