import React, { useState } from 'react';
import { useNode } from '@craftjs/core';

interface FileItem {
    name: string;
    url: string;
    size: number;
}

interface MultiFileAttachmentProps {
    label?: string;
    sublabel?: string;
    required?: boolean;
    acceptedTypes?: string;
    maxSizeMB?: number;
    maxFiles?: number;
    files?: FileItem[];
}

export const MultiFileAttachment = ({ label, sublabel, required, acceptedTypes, maxSizeMB, maxFiles, files = [] }: MultiFileAttachmentProps) => {
    const { connectors: { connect, drag }, actions: { setProp } } = useNode();
    const [dragActive, setDragActive] = useState(false);

    const handleFiles = (fileList: FileList) => {
        const newFiles: FileItem[] = [...files];
        
        Array.from(fileList).forEach(file => {
            if (maxFiles && newFiles.length >= maxFiles) {
                alert(`Maximum ${maxFiles} files allowed`);
                return;
            }
            if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
                alert(`File "${file.name}" exceeds ${maxSizeMB}MB limit`);
                return;
            }
            newFiles.push({
                name: file.name,
                url: URL.createObjectURL(file),
                size: file.size,
            });
        });

        setProp((props: any) => {
            props.files = newFiles;
        });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files?.length) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            handleFiles(e.target.files);
        }
    };

    const handleRemove = (index: number) => {
        setProp((props: any) => {
            props.files = props.files.filter((_: any, i: number) => i !== index);
        });
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

            {/* File list */}
            {files.length > 0 && (
                <div className="space-y-2 mb-3">
                    {files.map((file, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg bg-white p-2">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-primary-50 rounded">
                                    <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleRemove(index); }}
                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload area */}
            {(!maxFiles || files.length < maxFiles) && (
                <div
                    className={`border-2 border-dashed rounded-lg bg-gray-50 min-h-[80px] flex flex-col items-center justify-center cursor-pointer transition-colors ${
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
                        id="multi-file-upload"
                        accept={acceptedTypes}
                        multiple
                        onChange={handleChange}
                    />
                    <label htmlFor="multi-file-upload" className="cursor-pointer text-center p-3">
                        <svg className="w-6 h-6 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-sm text-gray-500">Add files</span>
                        {maxFiles && (
                            <span className="block text-xs text-gray-400 mt-0.5">{files.length}/{maxFiles} files</span>
                        )}
                    </label>
                </div>
            )}
        </div>
    );
};

export const MultiFileAttachmentSettings = () => {
    const { actions: { setProp }, label, sublabel, required, acceptedTypes, maxSizeMB, maxFiles } = useNode((node) => ({
        label: node.data.props.label,
        sublabel: node.data.props.sublabel,
        required: node.data.props.required,
        acceptedTypes: node.data.props.acceptedTypes,
        maxSizeMB: node.data.props.maxSizeMB,
        maxFiles: node.data.props.maxFiles,
    }));

    return (
        <div className="space-y-3 p-3">
            <div>
                <label className="block text-xs font-medium text-gray-700">Label</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={label || ''}
                    placeholder="e.g., Attachments"
                    onChange={(e) => setProp((props: any) => props.label = e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Sublabel</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={sublabel || ''}
                    placeholder="e.g., Upload supporting documents"
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
                <label className="block text-xs font-medium text-gray-700">Max Size per File (MB)</label>
                <input
                    type="number"
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={maxSizeMB || ''}
                    placeholder="e.g., 10"
                    onChange={(e) => setProp((props: any) => props.maxSizeMB = parseInt(e.target.value) || 10)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Max Number of Files</label>
                <input
                    type="number"
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={maxFiles || ''}
                    placeholder="e.g., 5"
                    onChange={(e) => setProp((props: any) => props.maxFiles = parseInt(e.target.value) || 5)}
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

MultiFileAttachment.craft = {
    displayName: 'Multi-File Attachment',
    props: {
        label: 'Attachments',
        sublabel: '',
        required: false,
        acceptedTypes: '',
        maxSizeMB: 10,
        maxFiles: 5,
        files: [],
    },
    related: {
        settings: MultiFileAttachmentSettings,
    },
};
