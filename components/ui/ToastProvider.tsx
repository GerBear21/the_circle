import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import Toast, { ToastType } from './Toast';

interface ToastData {
    id: string;
    type: ToastType;
    title?: string;
    message: string;
    duration?: number;
}

interface ToastContextType {
    addToast: (toast: Omit<ToastData, 'id'>) => void;
    removeToast: (id: string) => void;
    /** Register a modal as open. While any modal is open, toasts are suppressed. */
    pushModal: () => void;
    /** Unregister a previously-registered modal. */
    popModal: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

/**
 * Suppresses toast notifications while the given modal is open. Mount this in
 * every modal so the user never gets a toast at the same time as a modal —
 * the modal itself is the notification. Safe to call before an early return:
 * it's a single hook invoked unconditionally on every render.
 */
export function useSuppressToastsWhileOpen(isOpen: boolean) {
    const context = useContext(ToastContext);
    useEffect(() => {
        if (!isOpen || !context) return;
        context.pushModal();
        return () => context.popModal();
    }, [isOpen, context]);
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastData[]>([]);
    // Number of modals currently open. While > 0, new toasts are suppressed.
    const modalCountRef = useRef(0);

    const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
        // Don't show a toast at the same time as a modal — the modal is the message.
        if (modalCountRef.current > 0) return;
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { ...toast, id }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const pushModal = useCallback(() => {
        modalCountRef.current += 1;
    }, []);

    const popModal = useCallback(() => {
        modalCountRef.current = Math.max(0, modalCountRef.current - 1);
    }, []);

    const value = useMemo(
        () => ({ addToast, removeToast, pushModal, popModal }),
        [addToast, removeToast, pushModal, popModal]
    );

    return (
        <ToastContext.Provider value={value}>
            {children}

            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                {/* Make children pointer-events-auto so they can be clicked/hovered */}
                {toasts.map((toast) => (
                    <div key={toast.id} className="pointer-events-auto animate-slide-in-right">
                        <Toast {...toast} onClose={removeToast} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
