import React from 'react';
import { useNode } from '@craftjs/core';

interface BusinessUnitFieldProps {
    label?: string;
    sublabel?: string;
    required?: boolean;
    businessUnits?: string[];
    selectedValue?: string;
    placeholder?: string;
}

export const BusinessUnitField = ({ label, sublabel, required, businessUnits = [], selectedValue, placeholder }: BusinessUnitFieldProps) => {
    const { connectors: { connect, drag }, actions: { setProp } } = useNode();

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setProp((props: any) => props.selectedValue = e.target.value);
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
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                </div>
                <select
                    className="w-full pl-9 pr-10 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
                    value={selectedValue || ''}
                    onChange={handleChange}
                    onClick={(e) => e.stopPropagation()}
                >
                    <option value="">{placeholder || 'Select business unit...'}</option>
                    {businessUnits.map((unit, index) => (
                        <option key={index} value={unit}>{unit}</option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        </div>
    );
};

export const BusinessUnitFieldSettings = () => {
    const { actions: { setProp }, label, sublabel, required, businessUnits, placeholder } = useNode((node) => ({
        label: node.data.props.label,
        sublabel: node.data.props.sublabel,
        required: node.data.props.required,
        businessUnits: node.data.props.businessUnits,
        placeholder: node.data.props.placeholder,
    }));

    const handleAddUnit = () => {
        setProp((props: any) => props.businessUnits = [...props.businessUnits, `Unit ${props.businessUnits.length + 1}`]);
    };

    const handleUnitChange = (index: number, value: string) => {
        setProp((props: any) => props.businessUnits[index] = value);
    };

    const handleRemoveUnit = (index: number) => {
        setProp((props: any) => props.businessUnits = props.businessUnits.filter((_: any, i: number) => i !== index));
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
                <label className="block text-xs font-medium text-gray-700 mb-1">Business Units</label>
                <div className="space-y-2">
                    {businessUnits.map((unit: string, index: number) => (
                        <div key={index} className="flex items-center gap-1">
                            <input
                                className="flex-1 px-2 py-1 text-sm border rounded"
                                value={unit}
                                onChange={(e) => handleUnitChange(index, e.target.value)}
                            />
                            <button
                                onClick={() => handleRemoveUnit(index)}
                                className="text-red-500 hover:text-red-700"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={handleAddUnit}
                        className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Business Unit
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

BusinessUnitField.craft = {
    displayName: 'Business Unit',
    props: {
        label: 'Business Unit',
        sublabel: '',
        required: false,
        businessUnits: ['Corporate', 'Operations', 'Finance', 'Human Resources', 'IT', 'Marketing', 'Sales'],
        selectedValue: '',
        placeholder: 'Select business unit...',
    },
    related: {
        settings: BusinessUnitFieldSettings,
    },
};
