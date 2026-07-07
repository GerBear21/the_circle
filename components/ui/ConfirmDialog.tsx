import { createPortal } from 'react-dom';
import FeedbackLottie from './FeedbackLottie';
import { useSuppressToastsWhileOpen } from './ToastProvider';

/**
 * Generic destructive-action confirmation dialog. Use before any irreversible
 * decision (delete, reject, cancel) where a misclick would lose work or
 * commit a final state. Looks identical to the existing delete modal in
 * pages/requests/[id].tsx so the visual language is consistent.
 */
interface Props {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  variant?: 'danger' | 'warning';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  variant = 'danger',
  onConfirm,
  onCancel,
}: Props) {
  useSuppressToastsWhileOpen(isOpen);
  if (!isOpen || typeof window === 'undefined') return null;

  const confirmBtn = variant === 'danger'
    ? 'bg-danger-600 hover:bg-danger-700'
    : 'bg-amber-600 hover:bg-amber-700';

  const node = (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={busy ? undefined : onCancel}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 flex items-center justify-center flex-shrink-0">
            <FeedbackLottie type={variant === 'danger' ? 'error' : 'warning'} size={56} loop={false} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">This action cannot be undone</p>
          </div>
        </div>
        <div className="text-gray-600 mb-6 text-sm leading-relaxed">{message}</div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 text-white font-medium rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed ${confirmBtn}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
