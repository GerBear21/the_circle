import React from 'react';
import { useNode } from '@craftjs/core';
import Input from '../../ui/Input';

export const NumberField = ({ label, placeholder, required }: any) => {
    const { connectors: { connect, drag } } = useNode();

    return (
        <div
            ref={(ref: any) => connect(drag(ref))}
            className="mb-4"
        >
            <Input
                type="number"
                label={label}
                placeholder={placeholder}
                disabled
                required={required}
            />
        </div>
    );
};

export const NumberFieldSettings = () => {
    const { actions: { setProp }, label, placeholder, required } = useNode((node) => ({
        label: node.data.props.label,
        placeholder: node.data.props.placeholder,
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
            <div>
                <label className="block text-xs font-medium text-gray-700">Placeholder</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={placeholder || ''}
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

NumberField.craft = {
    displayName: 'Number Field',
    props: {
        label: 'Number Field',
        placeholder: '0',
        required: false,
    },
    related: {
        settings: NumberFieldSettings,
    },
};
