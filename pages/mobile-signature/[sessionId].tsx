import { useRouter } from 'next/router';
import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import Head from 'next/head';

export default function MobileSignaturePage() {
    const router = useRouter();
    const { sessionId } = router.query;
    const sigCanvas = useRef<SignatureCanvas>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const clear = () => {
        sigCanvas.current?.clear();
    };

    const save = async () => {
        if (sigCanvas.current?.isEmpty()) return;
        if (!sessionId) return;

        setSubmitting(true);

        const dataURL = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');

        try {
            const res = await fetch('/api/signature/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: dataURL,
                    sessionId,
                    type: 'mobile-temp'
                }),
            });

            if (res.ok) {
                setSubmitted(true);
            } else {
                alert('Failed to save signature');
            }
        } catch (err) {
            console.error('Save error', err);
            alert('Error saving signature');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Signature Sent!</h1>
                    <p className="text-gray-600">You can check your desktop screen now.</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <Head>
                <title>Sign Here</title>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
            </Head>
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <div className="flex-1 p-4 flex flex-col items-center justify-center">
                    <h1 className="text-xl font-bold text-gray-900 mb-6">Please sign below</h1>

                    <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-6">
                        <SignatureCanvas
                            ref={sigCanvas}
                            canvasProps={{
                                className: 'w-full h-64 cursor-crosshair bg-white touch-none',
                            }}
                            backgroundColor="white"
                        />
                        <div className="border-t border-gray-100 p-2 text-center text-xs text-gray-400">
                            Draw your signature above
                        </div>
                    </div>

                    <div className="w-full max-w-md flex gap-4">
                        <button
                            onClick={clear}
                            disabled={submitting}
                            className="flex-1 py-3 px-4 bg-white border border-gray-300 rounded-xl text-gray-700 font-medium shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            Clear
                        </button>
                        <button
                            onClick={save}
                            disabled={submitting}
                            className="flex-1 py-3 px-4 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-500/30 hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {submitting ? 'Sending...' : 'Send to Desktop'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
