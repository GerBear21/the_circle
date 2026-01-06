import React, { useState } from 'react';
import { useNode } from '@craftjs/core';

interface Watcher {
    email: string;
    name?: string;
}

interface WatchersFieldProps {
    label?: string;
    sublabel?: string;
    required?: boolean;
    watchers?: Watcher[];
    placeholder?: string;
}

export const WatchersField = ({ label, sublabel, required, watchers = [], placeholder }: WatchersFieldProps) => {
    const { connectors: { connect, drag }, actions: { setProp } } = useNode();
    const [inputValue, setInputValue] = useState('');

    const addWatcher = () => {
        if (!inputValue.trim()) return;
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(inputValue.trim())) {
            alert('Please enter a valid email address');
            return;
        }

        if (watchers.some(w => w.email === inputValue.trim())) {
            alert('This email is already added');
            return;
        }

        setProp((props: any) => {
            props.watchers = [...props.watchers, { email: inputValue.trim() }];
        });
        setInputValue('');
    };

    const removeWatcher = (email: string) => {
        setProp((props: any) => {
            props.watchers = props.watchers.filter((w: Watcher) => w.email !== email);
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addWatcher();
        }
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

            {/* Watchers list */}
            {watchers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {watchers.map((watcher, index) => (
                        <span
                            key={index}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-sm border border-blue-200"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {watcher.name || watcher.email}
                            <button
                                onClick={(e) => { e.stopPropagation(); removeWatcher(watcher.email); }}
                                className="hover:text-blue-900 ml-1"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Input */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <input
                        type="email"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder={placeholder || 'Enter email address...'}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); addWatcher(); }}
                    className="px-3 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export const WatchersFieldSettings = () => {
    const { actions: { setProp }, label, sublabel, required, placeholder } = useNode((node) => ({
        label: node.data.props.label,
        sublabel: node.data.props.sublabel,
        required: node.data.props.required,
        placeholder: node.data.props.placeholder,
    }));

    return (
        <div className="space-y-3 p-3">
            <div>
                <label className="block text-xs font-medium text-gray-700">Label</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={label || ''}
                    placeholder="e.g., Watchers / CC"
                    onChange={(e) => setProp((props: any) => props.label = e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Sublabel</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={sublabel || ''}
                    placeholder="e.g., People to notify"
                    onChange={(e) => setProp((props: any) => props.sublabel = e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Placeholder</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={placeholder || ''}
                    placeholder="e.g., Enter email address..."
                    onChange={(e) => setProp((props: any) => props.placeholder = e.target.value)}
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

WatchersField.craft = {
    displayName: 'Watchers/CC',
    props: {
        label: 'Watchers / CC',
        sublabel: 'People who will be notified about this request',
        required: false,
        watchers: [],
        placeholder: 'Enter email address...',
    },
    related: {
        settings: WatchersFieldSettings,
    },
};
