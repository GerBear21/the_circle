import React from 'react';
import { useNode } from '@craftjs/core';

export const DateField = ({ label, required }: any) => {
    const { connectors: { connect, drag } } = useNode();

    return (
        <div ref={(ref: any) => connect(drag(ref))} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
                type="date"
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
                disabled
            />
        </div>
    );
};

export const DateFieldSettings = () => {
    const { actions: { setProp }, label, required } = useNode((node) => ({
        label: node.data.props.label,
        required: node.data.props.required,
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

DateField.craft = {
    displayName: 'Date Field',
    props: {
        label: 'Date',
        required: false,
    },
    related: {
        settings: DateFieldSettings,
    },
};
