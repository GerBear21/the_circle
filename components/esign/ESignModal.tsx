import { useState, useCallback, ComponentType } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';

interface PdfSignatureEditorProps {
  pdfUrl: string;
  onSave: (signedPdfBlob: Blob) => void;
  onCancel: () => void;
}

const PdfSignatureEditor = dynamic<PdfSignatureEditorProps>(
  () =>
    import('./PdfSignatureEditor')
      .then(mod => {
        // eslint-disable-next-line no-console
        console.log('[esign] PdfSignatureEditor chunk loaded');
        return mod;
      })
      .catch(err => {
        // eslint-disable-next-line no-console
        console.error('[esign] failed to load PdfSignatureEditor chunk', err);
        throw err;
      }) as Promise<{ default: ComponentType<PdfSignatureEditorProps> }>,
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mb-3" />
        <p className="text-sm text-gray-500">Loading PDF editor…</p>
        <p className="text-xs text-gray-400 mt-1">If this hangs, open the browser console — look for messages prefixed with [esign].</p>
      </div>
    ),
  }
);

interface ESignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (signedPdfBlob: Blob, filename: string) => void;
}

type SignerOption = 'self' | 'invite';

export default function ESignModal({ isOpen, onClose, onComplete }: ESignModalProps) {
  const [step, setStep] = useState<'upload' | 'select-signers' | 'sign'>('upload');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [signerOption, setSignerOption] = useState<SignerOption | null>(null);
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setStep('select-signers');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setStep('select-signers');
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleSignerSelect = (option: SignerOption) => {
    setSignerOption(option);
    if (option === 'self') {
      setStep('sign');
    }
  };

  const handleAddEmail = () => {
    const email = emailInput.trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !invitedEmails.includes(email)) {
      setInvitedEmails([...invitedEmails, email]);
      setEmailInput('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    setInvitedEmails(invitedEmails.filter(e => e !== email));
  };

  const handleProceedWithInvites = () => {
    // For now, we'll just proceed to sign - invite functionality can be expanded later
    setStep('sign');
  };

  const handleSignComplete = (signedPdfBlob: Blob) => {
    if (onComplete && pdfFile) {
      const filename = pdfFile.name.replace('.pdf', '_signed.pdf');
      onComplete(signedPdfBlob, filename);
    }
    handleClose();
  };

  const handleClose = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setPdfFile(null);
    setPdfUrl(null);
    setStep('upload');
    setSignerOption(null);
    setInvitedEmails([]);
    setEmailInput('');
    onClose();
  };

  const handleBack = () => {
    if (step === 'sign') {
      setStep('select-signers');
    } else if (step === 'select-signers') {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      setPdfFile(null);
      setPdfUrl(null);
      setStep('upload');
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative bg-white rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-black/5 overflow-hidden transition-all duration-300 ${
            step === 'sign' ? 'w-full max-w-6xl h-[90vh]' : 'w-full max-w-lg'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              {step !== 'upload' && (
                <button
                  onClick={handleBack}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {step === 'upload' && 'E-Sign PDF Document'}
                  {step === 'select-signers' && 'Who will sign this document?'}
                  {step === 'sign' && 'Sign Document'}
                </h2>
                <p className="text-sm text-gray-500">
                  {step === 'upload' && 'Upload a PDF document to sign electronically'}
                  {step === 'select-signers' && 'Choose whether to sign yourself or invite others'}
                  {step === 'sign' && pdfFile?.name}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className={step === 'sign' ? 'h-[calc(90vh-73px)]' : ''}>
            {step === 'upload' && (
              <div className="p-6">
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-primary-400 hover:bg-primary-50/30 transition-all cursor-pointer"
                >
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label htmlFor="pdf-upload" className="cursor-pointer">
                    <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-900 font-medium mb-1">Drop your PDF here or click to browse</p>
                    <p className="text-gray-500 text-sm">Only PDF files are supported</p>
                  </label>
                </div>
              </div>
            )}

            {step === 'select-signers' && (
              <div className="p-6 space-y-4">
                {/* Sign Only Option */}
                <button
                  onClick={() => handleSignerSelect('self')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    signerOption === 'self'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      signerOption === 'self' ? 'bg-primary-100' : 'bg-gray-100'
                    }`}>
                      <svg className={`w-6 h-6 ${signerOption === 'self' ? 'text-primary-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">Sign Only (Me)</h3>
                      <p className="text-sm text-gray-500">I am the only person who needs to sign this document</p>
                    </div>
                    <svg className={`w-5 h-5 ${signerOption === 'self' ? 'text-primary-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Invite Others Option */}
                <div
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    signerOption === 'invite'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <button
                    onClick={() => setSignerOption('invite')}
                    className="w-full"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        signerOption === 'invite' ? 'bg-primary-100' : 'bg-gray-100'
                      }`}>
                        <svg className={`w-6 h-6 ${signerOption === 'invite' ? 'text-primary-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-gray-900">Invite Others to Sign</h3>
                        <p className="text-sm text-gray-500">Send signing invitations to other people</p>
                      </div>
                      <svg className={`w-5 h-5 transition-transform ${signerOption === 'invite' ? 'text-primary-600 rotate-90' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>

                  {signerOption === 'invite' && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                          placeholder="Enter email address"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <button
                          onClick={handleAddEmail}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          Add
                        </button>
                      </div>

                      {invitedEmails.length > 0 && (
                        <div className="space-y-2">
                          {invitedEmails.map((email) => (
                            <div key={email} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200">
                              <span className="text-sm text-gray-700">{email}</span>
                              <button
                                onClick={() => handleRemoveEmail(email)}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={handleProceedWithInvites}
                        disabled={invitedEmails.length === 0}
                        className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Continue to Sign & Send Invites
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 'sign' && pdfUrl && (
              <PdfSignatureEditor
                pdfUrl={pdfUrl}
                onSave={handleSignComplete}
                onCancel={handleBack}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;

  return createPortal(modalContent, document.body);
}
