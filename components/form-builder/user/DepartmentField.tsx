import React from 'react';
import { useNode } from '@craftjs/core';

interface DepartmentFieldProps {
    label?: string;
    sublabel?: string;
    required?: boolean;
    departments?: string[];
    selectedValue?: string;
    placeholder?: string;
}

export const DepartmentField = ({ label, sublabel, required, departments = [], selectedValue, placeholder }: DepartmentFieldProps) => {
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </div>
                <select
                    className="w-full pl-9 pr-10 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
                    value={selectedValue || ''}
                    onChange={handleChange}
                    onClick={(e) => e.stopPropagation()}
                >
                    <option value="">{placeholder || 'Select department...'}</option>
                    {departments.map((dept, index) => (
                        <option key={index} value={dept}>{dept}</option>
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

export const DepartmentFieldSettings = () => {
    const { actions: { setProp }, label, sublabel, required, departments, placeholder } = useNode((node) => ({
        label: node.data.props.label,
        sublabel: node.data.props.sublabel,
        required: node.data.props.required,
        departments: node.data.props.departments,
        placeholder: node.data.props.placeholder,
    }));

    const handleAddDepartment = () => {
        setProp((props: any) => props.departments = [...props.departments, `Department ${props.departments.length + 1}`]);
    };

    const handleDepartmentChange = (index: number, value: string) => {
        setProp((props: any) => props.departments[index] = value);
    };

    const handleRemoveDepartment = (index: number) => {
        setProp((props: any) => props.departments = props.departments.filter((_: any, i: number) => i !== index));
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
                <label className="block text-xs font-medium text-gray-700 mb-1">Departments</label>
                <div className="space-y-2">
                    {departments.map((dept: string, index: number) => (
                        <div key={index} className="flex items-center gap-1">
                            <input
                                className="flex-1 px-2 py-1 text-sm border rounded"
                                value={dept}
                                onChange={(e) => handleDepartmentChange(index, e.target.value)}
                            />
                            <button
                                onClick={() => handleRemoveDepartment(index)}
                                className="text-red-500 hover:text-red-700"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={handleAddDepartment}
                        className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Department
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

DepartmentField.craft = {
    displayName: 'Department',
    props: {
        label: 'Department',
        sublabel: '',
        required: false,
        departments: ['Accounting', 'Administration', 'Engineering', 'Human Resources', 'IT', 'Legal', 'Marketing', 'Operations', 'Procurement', 'Sales'],
        selectedValue: '',
        placeholder: 'Select department...',
    },
    related: {
        settings: DepartmentFieldSettings,
    },
};
