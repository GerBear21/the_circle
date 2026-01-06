import React from 'react';
import { useEditor } from '@craftjs/core';
import {
    TextField,
    Container,
    NumberField,
    Heading,
    CheckboxGroup,
    RadioGroup,
    Rating,
    SignatureField,
    Table,
    Dropdown,
    DateField,
    TextArea,
    Divider,
    Section,
    FileAttachment,
    MultiFileAttachment,
    MultiSelect,
    WatchersField,
    BusinessUnitField,
    DepartmentField,
    CurrencyAmountField
} from './user';

export const Toolbox = () => {
    const { connectors } = useEditor();

    return (
        <div className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col gap-2 h-full overflow-y-auto">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Basic Fields</h3>

            <div
                ref={(ref: any) => connectors.create(ref, <TextField />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Text Field</span>
            </div>

            <div
                ref={(ref: any) => connectors.create(ref, <TextArea />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h10" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Text Area</span>
            </div>

            <div
                ref={(ref: any) => connectors.create(ref, <NumberField />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Number</span>
            </div>

            <div
                ref={(ref: any) => connectors.create(ref, <DateField />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Date</span>
            </div>

            <div
                ref={(ref: any) => connectors.create(ref, <Dropdown />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Dropdown</span>
            </div>

            <div className="border-t border-gray-200 my-2"></div>

            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Choice Fields</h3>

            <div
                ref={(ref: any) => connectors.create(ref, <CheckboxGroup />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Checkboxes</span>
            </div>

            <div
                ref={(ref: any) => connectors.create(ref, <RadioGroup />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth={2} />
                    <circle cx="12" cy="12" r="4" fill="currentColor" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Radio Group</span>
            </div>

            <div
                ref={(ref: any) => connectors.create(ref, <Rating />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Rating</span>
            </div>

            <div className="border-t border-gray-200 my-2"></div>

            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Advanced</h3>

            <div
                ref={(ref: any) => connectors.create(ref, <SignatureField />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Signature</span>
            </div>

            <div
                ref={(ref: any) => connectors.create(ref, <Table />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7-8v8m14-8v8M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Table</span>
            </div>

            <div
                ref={(ref: any) => connectors.create(ref, <FileAttachment />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="text-sm font-medium text-gray-700">File Attachment</span>
            </div>

            <div
                ref={(ref: any) => connectors.create(ref, <MultiFileAttachment />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Multi-File</span>
            </div>

            <div
                ref={(ref: any) => connectors.create(ref, <CurrencyAmountField />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Currency & Amount</span>
            </div>

            <div className="border-t border-gray-200 my-2"></div>

            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Organization</h3>

            <div
                ref={(ref: any) => connectors.create(ref, <BusinessUnitField />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Business Unit</span>
            </div>

            <div
                ref={(ref: any) => connectors.create(ref, <DepartmentField />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Department</span>
            </div>

            <div
                ref={(ref: any) => connectors.create(ref, <WatchersField />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Watchers/CC</span>
            </div>

            <div
                ref={(ref: any) => connectors.create(ref, <MultiSelect />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Multi-Select</span>
            </div>

            <div className="border-t border-gray-200 my-2"></div>

            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Layout</h3>

            <div
                ref={(ref: any) => connectors.create(ref, <Heading />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Heading</span>
            </div>

            <div
                ref={(ref: any) => connectors.create(ref, <Section />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Section</span>
            </div>

            <div
                ref={(ref: any) => connectors.create(ref, <Divider />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Divider</span>
            </div>

            <div
                ref={(ref: any) => connectors.create(ref, <Container />)}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-primary-300 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Container</span>
            </div>
        </div>
    );
};
