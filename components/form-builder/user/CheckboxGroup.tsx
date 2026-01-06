import React from 'react';
import { useNode } from '@craftjs/core';

export const CheckboxGroup = ({ label, options, required }: any) => {
    const { connectors: { connect, drag } } = useNode();

    return (
        <div ref={(ref: any) => connect(drag(ref))} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="space-y-2">
                {options.map((option: string, index: number) => (
                    <div key={index} className="flex items-center">
                        <input
                            type="checkbox"
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            disabled
                        />
                        <label className="ml-2 block text-sm text-gray-900">
                            {option}
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const CheckboxGroupSettings = () => {
    const { actions: { setProp }, label, options, required, connectors: { connect } } = useNode((node) => ({
        label: node.data.props.label,
        options: node.data.props.options,
        required: node.data.props.required,
    }));

    const handleAddOption = () => {
        setProp((props: any) => props.options = [...props.options, `Option ${props.options.length + 1}`]);
    };

    const handleOptionChange = (index: number, value: string) => {
        setProp((props: any) => props.options[index] = value);
    };

    const handleRemoveOption = (index: number) => {
        setProp((props: any) => props.options = props.options.filter((_: any, i: number) => i !== index));
    };

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
                <label className="block text-xs font-medium text-gray-700 mb-1">Options</label>
                <div className="space-y-2">
                    {options.map((option: string, index: number) => (
                        <div key={index} className="flex items-center gap-1">
                            <input
                                className="flex-1 px-2 py-1 text-sm border rounded"
                                value={option}
                                onChange={(e) => handleOptionChange(index, e.target.value)}
                            />
                            <button
                                onClick={() => handleRemoveOption(index)}
                                className="text-red-500 hover:text-red-700"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={handleAddOption}
                        className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Option
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t">
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

CheckboxGroup.craft = {
    displayName: 'Checkbox Group',
    props: {
        label: 'Select Options',
        options: ['Option 1', 'Option 2'],
        required: false,
    },
    related: {
        settings: CheckboxGroupSettings,
    },
};
