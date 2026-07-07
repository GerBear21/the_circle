import { createPortal } from 'react-dom';
import FeedbackLottie from './FeedbackLottie';
import { useSuppressToastsWhileOpen } from './ToastProvider';

interface UnsavedChangesModalProps {
    isOpen: boolean;
    savingDraft?: boolean;
    canSaveDraft?: boolean;
    onSaveDraft: () => void;
    onDiscard: () => void;
    onCancel: () => void;
}

export default function UnsavedChangesModal({
    isOpen,
    savingDraft = false,
    canSaveDraft = true,
    onSaveDraft,
    onDiscard,
    onCancel,
}: UnsavedChangesModalProps) {
    useSuppressToastsWhileOpen(isOpen);
    if (!isOpen) return null;

    const modal = (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
            <div className="flex min-h-full items-center justify-center p-4">
                <div
                    className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-black/5"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-14 h-14 flex items-center justify-center flex-shrink-0">
                                <FeedbackLottie type="warning" size={56} loop={false} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-900">Unsaved changes</h3>
                                <p className="mt-2 text-sm text-gray-600">
                                    You have unsaved changes on this form. Would you like to save your progress as a draft before leaving?
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-end gap-2 px-6 pb-6">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={savingDraft}
                            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
                        >
                            Stay on page
                        </button>
                        <button
                            type="button"
                            onClick={onDiscard}
                            disabled={savingDraft}
                            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-60"
                        >
                            Discard changes
                        </button>
                        {canSaveDraft && (
                            <button
                                type="button"
                                onClick={onSaveDraft}
                                disabled={savingDraft}
                                className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-white bg-[#9A7545] rounded-lg hover:bg-[#7C5A33] disabled:opacity-60"
                            >
                                {savingDraft ? 'Saving…' : 'Save as draft'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    if (typeof window === 'undefined') return null;
    return createPortal(modal, document.body);
}
