import { useState, useCallback, ComponentType } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';

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
type Step = 'upload' | 'select-signers' | 'invite' | 'sending' | 'sent' | 'sign';

interface Invitee {
  id: string;
  email: string;
  name: string;
}

interface SendResult {
  email: string;
  status: 'sent' | 'failed';
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const newId = () => Math.random().toString(36).slice(2);

export default function ESignModal({ isOpen, onClose, onComplete }: ESignModalProps) {
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>('upload');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [signerOption, setSignerOption] = useState<SignerOption | null>(null);

  // Invite flow state
  const [invitees, setInvitees] = useState<Invitee[]>([{ id: newId(), email: '', name: '' }]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sendResults, setSendResults] = useState<SendResult[] | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

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
    } else {
      setSubject(
        pdfFile
          ? `Signature requested: ${pdfFile.name.replace(/\.pdf$/i, '')}`
          : 'Signature requested'
      );
      setStep('invite');
    }
  };

  // ---- Invitee list management ----
  const updateInvitee = (id: string, patch: Partial<Invitee>) => {
    setInvitees(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
  };
  const addInvitee = () => setInvitees(prev => [...prev, { id: newId(), email: '', name: '' }]);
  const removeInvitee = (id: string) =>
    setInvitees(prev => (prev.length === 1 ? prev : prev.filter(i => i.id !== id)));

  const validInvitees = invitees.filter(i => EMAIL_RE.test(i.email.trim()));
  const canSend = validInvitees.length > 0 && pdfFile !== null && step === 'invite';

  // ---- Send invitations ----
  const handleSendInvites = async () => {
    if (!pdfFile) return;
    setStep('sending');
    setSendError(null);
    setSendResults(null);
    try {
      // Convert PDF -> base64
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(pdfFile);
      });

      const resp = await fetch('/api/esign/send-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: pdfFile.name,
          pdfBase64: base64,
          invitees: validInvitees.map(i => ({ email: i.email.trim(), name: i.name.trim() })),
          subject: subject.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setSendError(data?.message || 'Failed to send invitations');
        setStep('invite');
        return;
      }
      setSendResults(data.results || []);
      setStep('sent');
    } catch (err: any) {
      setSendError(err?.message || 'Network error');
      setStep('invite');
    }
  };

  const handleSignComplete = (signedPdfBlob: Blob) => {
    if (onComplete && pdfFile) {
      const filename = pdfFile.name.replace('.pdf', '_signed.pdf');
      onComplete(signedPdfBlob, filename);
    }
    handleClose();
  };

  const handleClose = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfFile(null);
    setPdfUrl(null);
    setStep('upload');
    setSignerOption(null);
    setInvitees([{ id: newId(), email: '', name: '' }]);
    setSubject('');
    setMessage('');
    setSendResults(null);
    setSendError(null);
    onClose();
  };

  const handleBack = () => {
    if (step === 'sign') {
      setStep('select-signers');
    } else if (step === 'invite') {
      setStep('select-signers');
    } else if (step === 'sent') {
      handleClose();
    } else if (step === 'select-signers') {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfFile(null);
      setPdfUrl(null);
      setStep('upload');
    }
  };

  if (!isOpen) return null;

  const senderEmail = session?.user?.email || 'your account';

  // ---- Header titles ----
  const titles: Record<Step, { title: string; subtitle: string }> = {
    upload: {
      title: 'E-Sign PDF Document',
      subtitle: 'Upload a PDF document to sign electronically',
    },
    'select-signers': {
      title: 'Who will sign this document?',
      subtitle: 'Choose whether to sign yourself or invite others',
    },
    invite: {
      title: 'Send signing invitations',
      subtitle: `Emails will be sent from ${senderEmail}`,
    },
    sending: {
      title: 'Sending invitations…',
      subtitle: 'Please wait',
    },
    sent: {
      title: 'Invitations sent',
      subtitle: 'Your signers will receive an email shortly',
    },
    sign: {
      title: 'Sign Document',
      subtitle: pdfFile?.name || '',
    },
  };

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
            step === 'sign'
              ? 'w-full max-w-6xl h-[90vh]'
              : step === 'invite' || step === 'sent'
              ? 'w-full max-w-2xl'
              : 'w-full max-w-lg'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              {step !== 'upload' && step !== 'sending' && step !== 'sent' && (
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
                <h2 className="text-lg font-semibold text-gray-900">{titles[step].title}</h2>
                <p className="text-sm text-gray-500">{titles[step].subtitle}</p>
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
                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Invite Others Option */}
                <button
                  onClick={() => handleSignerSelect('invite')}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-left transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">Invite Others to Sign</h3>
                      <p className="text-sm text-gray-500">
                        Send an email invitation from <span className="font-medium text-gray-700">{senderEmail}</span>
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            )}

            {step === 'invite' && (
              <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                {/* Sender banner */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold">
                    {(session?.user?.name || senderEmail).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-blue-700 font-medium uppercase tracking-wide">From</p>
                    <p className="text-sm text-blue-900 font-medium truncate">{senderEmail}</p>
                  </div>
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>

                {/* Document preview */}
                {pdfFile && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
                    <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{pdfFile.name}</p>
                      <p className="text-xs text-gray-500">{(pdfFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                )}

                {/* Recipients */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-gray-700">Signers</label>
                    <span className="text-xs text-gray-400">{validInvitees.length} valid</span>
                  </div>
                  <div className="space-y-2">
                    {invitees.map((inv, idx) => {
                      const emailValid = inv.email === '' || EMAIL_RE.test(inv.email.trim());
                      return (
                        <div key={inv.id} className="flex items-center gap-2">
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-2">
                            <input
                              type="text"
                              value={inv.name}
                              onChange={(e) => updateInvitee(inv.id, { name: e.target.value })}
                              placeholder="Full name (optional)"
                              className="sm:col-span-2 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <input
                              type="email"
                              value={inv.email}
                              onChange={(e) => updateInvitee(inv.id, { email: e.target.value })}
                              placeholder={`signer${idx + 1}@example.com`}
                              className={`sm:col-span-3 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                                emailValid ? 'border-gray-300' : 'border-red-300 bg-red-50'
                              }`}
                            />
                          </div>
                          <button
                            onClick={() => removeInvitee(inv.id)}
                            disabled={invitees.length === 1}
                            className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-400 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={addInvitee}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add another signer
                  </button>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject line"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Personal message <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add a note that will appear in the invitation email…"
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                </div>

                {sendError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    {sendError}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-gray-500">
                    Each signer receives a unique secure link, valid for 30 days.
                  </p>
                  <button
                    onClick={handleSendInvites}
                    disabled={!canSend}
                    className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send invitations
                  </button>
                </div>
              </div>
            )}

            {step === 'sending' && (
              <div className="p-12 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4" />
                <p className="text-gray-700 font-medium">Sending invitation emails…</p>
                <p className="text-sm text-gray-500 mt-1">Delivering from {senderEmail}</p>
              </div>
            )}

            {step === 'sent' && sendResults && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {sendResults.filter(r => r.status === 'sent').length} of {sendResults.length} invitation
                    {sendResults.length !== 1 ? 's' : ''} sent
                  </h3>
                  <p className="text-sm text-gray-500">Your signers will receive an email shortly.</p>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {sendResults.map((r) => (
                    <div
                      key={r.email}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        r.status === 'sent' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
                      }`}
                    >
                      {r.status === 'sent' ? (
                        <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.email}</p>
                        {r.error && <p className="text-xs text-red-600 truncate">{r.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleClose}
                    className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold"
                  >
                    Done
                  </button>
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
