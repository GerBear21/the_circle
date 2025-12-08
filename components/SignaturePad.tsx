import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { QRCodeSVG } from 'qrcode.react';
import { v4 as uuidv4 } from 'uuid';
import Button from './ui/Button'; // Assuming Button component exists or I'll use standard button
import Card from './ui/Card'; // Assuming Card component exists

// Fallback UI components if they don't exist
const TabButton = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${active
            ? 'bg-white text-brand-600 border-t border-x border-gray-200'
            : 'bg-gray-50 text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
    >
        {children}
    </button>
);

interface SignaturePadProps {
    initialUrl?: string;
    onSave?: (url: string) => void;
}

export default function SignaturePad({ initialUrl, onSave }: SignaturePadProps) {
    const [activeTab, setActiveTab] = useState<'draw' | 'upload' | 'mobile'>('draw');
    const [currentSignature, setCurrentSignature] = useState<string | null>(initialUrl || null);
    const sigCanvas = useRef<SignatureCanvas>(null);

    // Mobile Mobile State
    const [sessionId, setSessionId] = useState<string>('');
    const [mobileUrl, setMobileUrl] = useState<string>('');
    const [isPolling, setIsPolling] = useState(false);

    useEffect(() => {
        if (activeTab === 'mobile' && !sessionId) {
            const newSessionId = uuidv4();
            setSessionId(newSessionId);
            // Construct the URL for the mobile page
            // Assuming the app is hosted at the current origin
            if (typeof window !== 'undefined') {
                const origin = window.location.origin;
                setMobileUrl(`${origin}/mobile-signature/${newSessionId}`);
            }
            setIsPolling(true);
        }
    }, [activeTab, sessionId]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPolling && sessionId) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/signature/check?sessionId=${sessionId}`);
                    const data = await res.json();
                    if (data.found && data.url) {
                        setCurrentSignature(data.url);
                        if (onSave) onSave(data.url);
                        setIsPolling(false);
                        setActiveTab('draw'); // Switch back to view/draw tab to show result
                        // Clear canvas ref if exists to avoid confusion, or load image into it
                    }
                } catch (err) {
                    console.error('Polling error', err);
                }
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [isPolling, sessionId, onSave]);

    const clear = () => {
        sigCanvas.current?.clear();
        setCurrentSignature(null);
    };

    const save = async () => {
        if (activeTab === 'upload') {
            // Upload logic already handled active file selection? 
            // We need to implement the upload logic here if not already done
            return;
        }

        if (sigCanvas.current?.isEmpty()) return;

        const dataURL = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
        if (!dataURL) return;

        try {
            const res = await fetch('/api/signature/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: dataURL }),
            });
            const data = await res.json();
            if (data.url) {
                setCurrentSignature(data.url);
                if (onSave) onSave(data.url);
            }
        } catch (err) {
            console.error('Save error', err);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            try {
                const res = await fetch('/api/signature/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64 }),
                });
                const data = await res.json();
                if (data.url) {
                    setCurrentSignature(data.url);
                    if (onSave) onSave(data.url);
                }
            } catch (err) {
                console.error('Upload error', err);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200 px-4 pt-4 gap-2 bg-gray-50/50">
                <TabButton active={activeTab === 'draw'} onClick={() => setActiveTab('draw')}>
                    <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        Draw
                    </span>
                </TabButton>
                <TabButton active={activeTab === 'upload'} onClick={() => setActiveTab('upload')}>
                    <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Upload
                    </span>
                </TabButton>
                <TabButton active={activeTab === 'mobile'} onClick={() => setActiveTab('mobile')}>
                    <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        Mobile
                    </span>
                </TabButton>
            </div>

            <div className="p-6">
                {activeTab === 'draw' && (
                    <div className="space-y-4">
                        <div className="border border-gray-200 rounded-lg bg-white relative group">
                            {currentSignature ? (
                                <div className="relative h-40 w-full flex items-center justify-center bg-gray-50">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={currentSignature} alt="Current Signature" className="max-h-full max-w-full" />
                                    <button
                                        onClick={clear}
                                        className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ) : (
                                <SignatureCanvas
                                    ref={sigCanvas}
                                    canvasProps={{
                                        className: 'w-full h-40 cursor-crosshair rounded-lg',
                                    }}
                                    backgroundColor="rgba(255, 255, 255, 0)"
                                />
                            )}
                            {!currentSignature && (
                                <div className="absolute top-2 right-2 text-xs text-gray-300 pointer-events-none">Sign Here</div>
                            )}
                        </div>
                        {!currentSignature && (
                            <div className="flex justify-end gap-2">
                                <button onClick={clear} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
                                    Clear
                                </button>
                                <button onClick={save} className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md hover:bg-brand-700 transition-colors shadow-sm">
                                    Save Signature
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'upload' && (
                    <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                        <div className="mb-4 p-3 bg-brand-50 rounded-full text-brand-600">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        </div>
                        <p className="text-sm font-medium text-gray-900 mb-1">Upload an image</p>
                        <p className="text-xs text-gray-500 mb-4">PNG, JPG up to 4MB</p>
                        <label className="relative cursor-pointer">
                            <span className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                                Choose File
                            </span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                        </label>
                    </div>
                )}

                {activeTab === 'mobile' && (
                    <div className="flex flex-col sm:flex-row items-center gap-8 justify-center py-4">
                        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                            <QRCodeSVG value={mobileUrl} size={160} />
                        </div>
                        <div className="text-center sm:text-left max-w-xs">
                            <h4 className="font-semibold text-gray-900">Sign on your phone</h4>
                            <p className="text-sm text-gray-500 mt-1 mb-4">
                                Scan the QR code with your mobile device to open the signature pad.
                            </p>
                            <div className="text-xs px-3 py-2 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-2 justify-center sm:justify-start">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                </span>
                                Waiting for device...
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
