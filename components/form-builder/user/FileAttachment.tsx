import React, { useState } from 'react';
import { useNode } from '@craftjs/core';

interface FileAttachmentProps {
    label?: string;
    sublabel?: string;
    required?: boolean;
    acceptedTypes?: string;
    maxSizeMB?: number;
    fileName?: string;
    fileUrl?: string;
}

export const FileAttachment = ({ label, sublabel, required, acceptedTypes, maxSizeMB, fileName, fileUrl }: FileAttachmentProps) => {
    const { connectors: { connect, drag }, actions: { setProp } } = useNode();
    const [dragActive, setDragActive] = useState(false);

    const handleFile = (file: File) => {
        if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
            alert(`File size exceeds ${maxSizeMB}MB limit`);
            return;
        }
        setProp((props: any) => {
            props.fileName = file.name;
            props.fileUrl = URL.createObjectURL(file);
        });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files?.[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleClear = () => {
        setProp((props: any) => {
            props.fileName = '';
            props.fileUrl = '';
        });
    };

    return (
        <div ref={(ref: any) => connect(drag(ref))} className="mb-4">
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

            {fileName ? (
                <div className="border border-gray-200 rounded-lg bg-white p-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-50 rounded-lg">
                            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
                            <p className="text-xs text-gray-500">Attached file</p>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleClear(); }}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    className={`border-2 border-dashed rounded-lg bg-gray-50 min-h-[100px] flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        dragActive ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:bg-gray-100 hover:border-primary-400'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDrop}
                    onClick={(e) => e.stopPropagation()}
                >
                    <input
                        type="file"
                        className="hidden"
                        id="file-upload"
                        accept={acceptedTypes}
                        onChange={handleChange}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer text-center p-4">
                        <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="text-sm text-gray-500">Drop file here or click to upload</span>
                        {maxSizeMB && (
                            <span className="block text-xs text-gray-400 mt-1">Max size: {maxSizeMB}MB</span>
                        )}
                    </label>
                </div>
            )}
        </div>
    );
};

export const FileAttachmentSettings = () => {
    const { actions: { setProp }, label, sublabel, required, acceptedTypes, maxSizeMB } = useNode((node) => ({
        label: node.data.props.label,
        sublabel: node.data.props.sublabel,
        required: node.data.props.required,
        acceptedTypes: node.data.props.acceptedTypes,
        maxSizeMB: node.data.props.maxSizeMB,
    }));

    return (
        <div className="space-y-3 p-3">
            <div>
                <label className="block text-xs font-medium text-gray-700">Label</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={label || ''}
                    placeholder="e.g., Attachment"
                    onChange={(e) => setProp((props: any) => props.label = e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Sublabel</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={sublabel || ''}
                    placeholder="e.g., Upload supporting document"
                    onChange={(e) => setProp((props: any) => props.sublabel = e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Accepted File Types</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={acceptedTypes || ''}
                    placeholder="e.g., .pdf,.doc,.docx"
                    onChange={(e) => setProp((props: any) => props.acceptedTypes = e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Max Size (MB)</label>
                <input
                    type="number"
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={maxSizeMB || ''}
                    placeholder="e.g., 10"
                    onChange={(e) => setProp((props: any) => props.maxSizeMB = parseInt(e.target.value) || 10)}
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

FileAttachment.craft = {
    displayName: 'File Attachment',
    props: {
        label: 'Attachment',
        sublabel: '',
        required: false,
        acceptedTypes: '',
        maxSizeMB: 10,
        fileName: '',
        fileUrl: '',
    },
    related: {
        settings: FileAttachmentSettings,
    },
};
