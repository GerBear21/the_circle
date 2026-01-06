import React, { useState, useEffect } from 'react';
import { useNode } from '@craftjs/core';
import { useUserSignature } from '../../../hooks/useUserSignature';

interface SignatureFieldProps {
    label?: string;
    sublabel?: string;
    required?: boolean;
    signatureData?: string;
    signatureName?: string;
}

export const SignatureField = ({ label, sublabel, required, signatureData: initialSignatureData, signatureName: initialSignatureName }: SignatureFieldProps) => {
    const { connectors: { connect, drag }, actions: { setProp } } = useNode();
    const [showModal, setShowModal] = useState(false);
    const [signatureData, setSignatureData] = useState(initialSignatureData || '');
    const [signatureName, setSignatureName] = useState(initialSignatureName || '');

    const handleSave = (data: string, name?: string) => {
        setSignatureData(data);
        if (name) setSignatureName(name);
        setProp((props: any) => {
            props.signatureData = data;
            if (name) props.signatureName = name;
        });
        setShowModal(false);
    };

    const handleClear = () => {
        setSignatureData('');
        setSignatureName('');
        setProp((props: any) => {
            props.signatureData = '';
            props.signatureName = '';
        });
    };

    return (
        <div ref={(ref: any) => connect(drag(ref))} className="mb-4">
            {/* Labels */}
            {(label || sublabel) && (
                <div className="mb-2">
                    {label && (
                        <label className="block text-sm font-medium text-gray-700">
                            {label}
                            {required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                    )}
                    {sublabel && (
                        <span className="block text-xs text-gray-500 mt-0.5">{sublabel}</span>
                    )}
                </div>
            )}

            {/* Signature Area */}
            {signatureData ? (
                <div className="border border-gray-200 rounded-lg bg-white p-3">
                    <div className="flex items-center justify-center min-h-[80px] border-b border-gray-100 pb-2 mb-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={signatureData} alt="Signature" className="max-h-[70px] object-contain" />
                    </div>
                    {signatureName && (
                        <div className="text-sm text-gray-700 text-center font-medium">{signatureName}</div>
                    )}
                    <div className="flex justify-center mt-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleClear(); }}
                            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Clear Signature
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 min-h-[100px] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-primary-400 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
                >
                    <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span className="text-sm text-gray-500">Click to add signature</span>
                </div>
            )}

            {/* Signature Modal */}
            {showModal && (
                <SignatureModal
                    onSave={handleSave}
                    onClose={() => setShowModal(false)}
                />
            )}
        </div>
    );
};

// Signature Modal Component
interface SignatureModalProps {
    onSave: (signatureData: string, name?: string) => void;
    onClose: () => void;
}

const SignatureModal = ({ onSave, onClose }: SignatureModalProps) => {
    const { signatureUrl, userName, hasSignature, loading } = useUserSignature();
    const [signatureName, setSignatureName] = useState('');

    // Pre-fill name when user has a saved signature
    useEffect(() => {
        if (userName) {
            setSignatureName(userName);
        }
    }, [userName]);

    const handleSave = () => {
        if (signatureUrl) {
            onSave(signatureUrl, signatureName || userName || undefined);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Add Signature</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                    </div>
                ) : hasSignature ? (
                    <>
                        {/* Saved signature display */}
                        <div className="mb-4 p-4 bg-primary-50 border border-primary-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm font-medium text-gray-900">Your Saved Signature</span>
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-gray-200">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={signatureUrl!} alt="Your signature" className="max-h-[80px] mx-auto object-contain" />
                            </div>
                        </div>

                        {/* Name input */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Name
                            </label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="Enter your name..."
                                value={signatureName}
                                onChange={(e) => setSignatureName(e.target.value)}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                            >
                                Add My Signature
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-6">
                        <div className="mb-4 p-3 bg-amber-50 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">No Signature Found</h4>
                        <p className="text-sm text-gray-500 mb-4">
                            You haven&apos;t set up your digital signature yet. Please go to your profile settings to create one.
                        </p>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export const SignatureFieldSettings = () => {
    const { actions: { setProp }, label, sublabel, required } = useNode((node) => ({
        label: node.data.props.label,
        sublabel: node.data.props.sublabel,
        required: node.data.props.required,
    }));

    return (
        <div className="space-y-3 p-3">
            <div>
                <label className="block text-xs font-medium text-gray-700">Label</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={label || ''}
                    placeholder="e.g., Approved by"
                    onChange={(e) => setProp((props: any) => props.label = e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Sublabel</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={sublabel || ''}
                    placeholder="e.g., Department Manager"
                    onChange={(e) => setProp((props: any) => props.sublabel = e.target.value)}
                />
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    checked={required || false}
                    onChange={(e) => setProp((props: any) => props.required = e.target.checked)}
                />
                <label className="text-sm text-gray-700">Required</label>
            </div>
        </div>
    );
};

SignatureField.craft = {
    displayName: 'Signature',
    props: {
        label: 'Signature',
        sublabel: '',
        required: false,
        signatureData: '',
        signatureName: '',
    },
    related: {
        settings: SignatureFieldSettings,
    },
};
