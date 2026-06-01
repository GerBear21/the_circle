import { createPortal } from 'react-dom';

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
  if (!isOpen || typeof window === 'undefined') return null;

  const iconColor = variant === 'danger' ? 'bg-danger-100 text-danger-600' : 'bg-amber-100 text-amber-600';
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
          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${iconColor}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
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
