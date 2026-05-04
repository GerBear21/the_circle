import { useEffect, useState } from 'react';
import { generateReferenceCode } from '../../lib/requestCode';

interface ReferenceCodeBannerProps {
    /** The request type key (e.g. 'capex', 'hotel_booking'). */
    requestType: string;
    /** Existing code (e.g. when editing a request). When provided, no new code is generated. */
    existingCode?: string | null;
    /** Notifies the parent when a code is assigned so it can be stored in metadata on submit. */
    onCodeAssigned?: (code: string) => void;
    /** Optional label override (defaults to "Request Reference"). */
    label?: string;
}

/**
 * Displays a human-readable unique identifier for the request at the top of a form.
 * Generates the code on mount (if one isn't supplied) and emits it via `onCodeAssigned`
 * so the parent form can persist it alongside other metadata.
 */
export default function ReferenceCodeBanner({
    requestType,
    existingCode,
    onCodeAssigned,
    label = 'Request Reference',
}: ReferenceCodeBannerProps) {
    const [code, setCode] = useState<string | null>(existingCode ?? null);
    const [copied, setCopied] = useState(false);

    // Assign a code on first mount if one wasn't provided.
    useEffect(() => {
        if (existingCode) {
            setCode(existingCode);
            return;
        }
        if (!code) {
            const generated = generateReferenceCode(requestType);
            setCode(generated);
            onCodeAssigned?.(generated);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [existingCode]);

    // If the parent swaps requestType (rare) after assignment, don't regenerate —
    // the code is meant to be stable for the lifetime of the form.

    if (!code) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            // Swallow clipboard errors silently; the code is still visible.
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[#F3EADC] to-[#F7F0E2] border border-[#C9B896]">
            <div className="w-9 h-9 rounded-lg bg-white border border-[#C9B896] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[#9A7545]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#9A7545]">
                    {label}
                </p>
                <p className="font-mono text-sm sm:text-base font-bold text-[#3F2D19] truncate">
                    {code}
                </p>
            </div>
            <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#C9B896] text-xs font-semibold text-[#5E4426] hover:bg-[#F3EADC] transition-colors"
                aria-label="Copy reference code"
            >
                {copied ? (
                    <>
                        <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied
                    </>
                ) : (
                    <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                    </>
                )}
            </button>
        </div>
    );
}
