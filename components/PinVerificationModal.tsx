import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PinVerificationModalProps {
  isOpen: boolean;
  onVerified: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

export default function PinVerificationModal({
  isOpen,
  onVerified,
  onCancel,
  title = 'Enter Your PIN',
  description = 'Please enter your 4-digit PIN to confirm this action',
}: PinVerificationModalProps) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', '']);
      setError(null);
      setAttempts(0);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError(null);
    
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when all digits entered
    if (value && index === 3 && newPin.every(d => d !== '')) {
      handleVerify(newPin.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!pin[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'Enter') {
      const pinString = pin.join('');
      if (pinString.length === 4) {
        handleVerify(pinString);
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleVerify = async (pinString: string) => {
    if (pinString.length !== 4) {
      setError('Please enter all 4 digits');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const response = await fetch('/api/user/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinString }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAttempts(prev => prev + 1);
        if (data.code === 'INVALID_PIN') {
          setError(`Incorrect PIN. ${3 - attempts - 1} attempts remaining.`);
          setPin(['', '', '', '']);
          inputRefs.current[0]?.focus();
          
          if (attempts >= 2) {
            setError('Too many incorrect attempts. Please try again later.');
            setTimeout(() => onCancel(), 2000);
          }
        } else {
          setError(data.error || 'Verification failed');
        }
        return;
      }

      onVerified();
    } catch (err) {
      setError('Failed to verify PIN. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[110] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onCancel}
        aria-hidden="true" 
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-black/5">
          {/* Header */}
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </div>

          {/* Content */}
          <div className="px-6 pb-6 space-y-4">
            {error && (
              <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700 text-center">
                {error}
              </div>
            )}

            {/* PIN Input */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={pin[index]}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={verifying || attempts >= 3}
                  className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              ))}
            </div>

            {verifying && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                Verifying...
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex gap-3">
            <button
              onClick={onCancel}
              disabled={verifying}
              className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleVerify(pin.join(''))}
              disabled={pin.join('').length !== 4 || verifying || attempts >= 3}
              className="flex-1 py-2.5 px-4 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Verify
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;

  return createPortal(modalContent, document.body);
}
