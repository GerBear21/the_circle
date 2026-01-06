import React, { useState } from 'react';
import { useNode } from '@craftjs/core';

interface MultiSelectProps {
    label?: string;
    sublabel?: string;
    required?: boolean;
    options?: string[];
    selectedValues?: string[];
    placeholder?: string;
}

export const MultiSelect = ({ label, sublabel, required, options = [], selectedValues = [], placeholder }: MultiSelectProps) => {
    const { connectors: { connect, drag }, actions: { setProp } } = useNode();
    const [isOpen, setIsOpen] = useState(false);

    const toggleOption = (option: string) => {
        const newValues = selectedValues.includes(option)
            ? selectedValues.filter(v => v !== option)
            : [...selectedValues, option];
        setProp((props: any) => props.selectedValues = newValues);
    };

    const removeValue = (option: string) => {
        setProp((props: any) => props.selectedValues = props.selectedValues.filter((v: string) => v !== option));
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

            <div className="relative">
                <div
                    className="w-full px-3 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer flex flex-wrap gap-1 items-center"
                    onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                >
                    {selectedValues.length > 0 ? (
                        selectedValues.map((value, index) => (
                            <span
                                key={index}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-sm"
                            >
                                {value}
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeValue(value); }}
                                    className="hover:text-primary-900"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </span>
                        ))
                    ) : (
                        <span className="text-gray-400">{placeholder || 'Select options...'}</span>
                    )}
                    <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                {isOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {options.map((option, index) => (
                            <div
                                key={index}
                                className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-gray-50 ${
                                    selectedValues.includes(option) ? 'bg-primary-50' : ''
                                }`}
                                onClick={(e) => { e.stopPropagation(); toggleOption(option); }}
                            >
                                <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                                    selectedValues.includes(option) ? 'bg-primary-600 border-primary-600' : 'border-gray-300'
                                }`}>
                                    {selectedValues.includes(option) && (
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                <span className="text-sm text-gray-700">{option}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export const MultiSelectSettings = () => {
    const { actions: { setProp }, label, sublabel, required, options, placeholder } = useNode((node) => ({
        label: node.data.props.label,
        sublabel: node.data.props.sublabel,
        required: node.data.props.required,
        options: node.data.props.options,
        placeholder: node.data.props.placeholder,
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
                <label className="block text-xs font-medium text-gray-700">Sublabel</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={sublabel || ''}
                    onChange={(e) => setProp((props: any) => props.sublabel = e.target.value)}
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

MultiSelect.craft = {
    displayName: 'Multi-Select',
    props: {
        label: 'Multi-Select',
        sublabel: '',
        required: false,
        options: ['Option 1', 'Option 2', 'Option 3'],
        selectedValues: [],
        placeholder: 'Select options...',
    },
    related: {
        settings: MultiSelectSettings,
    },
};
