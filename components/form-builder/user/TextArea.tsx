import React from 'react';
import { useNode } from '@craftjs/core';

export const TextArea = ({ label, placeholder, required, rows }: any) => {
    const { connectors: { connect, drag } } = useNode();

    return (
        <div ref={(ref: any) => connect(drag(ref))} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none disabled:bg-gray-100"
                placeholder={placeholder}
                rows={rows}
                disabled
            />
        </div>
    );
};

export const TextAreaSettings = () => {
    const { actions: { setProp }, label, placeholder, required, rows } = useNode((node) => ({
        label: node.data.props.label,
        placeholder: node.data.props.placeholder,
        required: node.data.props.required,
        rows: node.data.props.rows,
    }));

    return (
        <div className="space-y-3 p-3">
            <div>
                <label className="block text-xs font-medium text-gray-700">Label</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={label || ''}
                    onChange={(e) => setProp((props: any) => props.label = e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Placeholder</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={placeholder || ''}
                    onChange={(e) => setProp((props: any) => props.placeholder = e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Rows</label>
                <input
                    type="number"
                    min="2"
                    max="20"
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={rows || 4}
                    onChange={(e) => setProp((props: any) => props.rows = parseInt(e.target.value))}
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

TextArea.craft = {
    displayName: 'Text Area',
    props: {
        label: 'Description',
        placeholder: 'Enter detailed text...',
        required: false,
        rows: 4,
    },
    related: {
        settings: TextAreaSettings,
    },
};
