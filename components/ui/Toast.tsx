import React, { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
    id: string;
    type: ToastType;
    title?: string;
    message: string;
    onClose: (id: string) => void;
    duration?: number;
}

const ICONS = {
    success: (
        <svg className="w-6 h-6 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
    ),
    error: (
        <svg className="w-6 h-6 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    warning: (
        <svg className="w-6 h-6 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    ),
    info: (
        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
};

const STYLES = {
    success: 'bg-success-50 border-success-100',
    error: 'bg-danger-50 border-danger-100',
    warning: 'bg-warning-50 border-warning-100',
    info: 'bg-primary-50 border-primary-100',
};

export default function Toast({ id, type, title, message, onClose, duration = 5000 }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onClose]);

    return (
        <div className={`flex items-start gap-4 p-4 rounded-xl border shadow-lg max-w-sm w-full transition-all transform hover:scale-[1.02] ${STYLES[type]}`}>
            <div className="flex-shrink-0">
                {ICONS[type]}
            </div>
            <div className="flex-1 pt-0.5">
                {title && <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>}
                <p className="text-sm text-gray-600">{message}</p>
            </div>
            <button
                onClick={() => onClose(id)}
                className="flex-shrink-0 -mr-2 -mt-2 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-black/5 transition-colors"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}
