/**
 * Dynamic Form Details Renderer
 * 
 * This component automatically renders form details based on the form configuration.
 * It handles all field types including text, dates, arrays, tables, and budget items.
 */

import { Card } from './ui';
import { 
    FormTypeConfig, 
    FieldConfig, 
    getFormConfig, 
    formatFieldValue, 
    shouldDisplayField,
    calculateBudgetTotal 
} from '../lib/formConfig';

interface DynamicFormDetailsProps {
    metadata: Record<string, any>;
    requestType: string;
    description?: string;
}

// Icon components for sections
const SectionIcons: Record<string, JSX.Element> = {
    building: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
    ),
    document: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    ),
    currency: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    user: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
    ),
    calendar: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    ),
};

// Render a single field value
function renderFieldValue(value: any, field: FieldConfig, metadata: Record<string, any>): JSX.Element {
    if (value === null || value === undefined || value === '') {
        return <span className="text-gray-400">N/A</span>;
    }

    switch (field.type) {
        case 'date':
            try {
                const date = new Date(value);
                return <span>{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>;
            } catch {
                return <span>{value}</span>;
            }

        case 'boolean':
            return <span>{value ? 'Yes' : 'No'}</span>;

        case 'select':
            return <span>{field.options?.[value] || value}</span>;

        case 'number':
            if (field.formatter === 'percentage') {
                return <span>{value}%</span>;
            }
            return <span>{typeof value === 'number' ? value.toLocaleString() : value}</span>;

        case 'currency':
            const currency = field.currencyKey ? metadata[field.currencyKey] || '$' : '$';
            return <span>{currency} {typeof value === 'number' ? value.toLocaleString() : value}</span>;

        case 'textarea':
            return <span className="whitespace-pre-wrap">{value}</span>;

        default:
            return <span>{String(value)}</span>;
    }
}

// Render a table of items (like itinerary)
function renderTable(items: any[], fields: FieldConfig[]): JSX.Element {
    const validItems = items.filter(item => 
        fields.some(f => item[f.key] !== null && item[f.key] !== undefined && item[f.key] !== '')
    );

    if (validItems.length === 0) return <span className="text-gray-400">No items</span>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                    <tr>
                        {fields.map(f => (
                            <th key={f.key} className="px-3 py-2 text-left font-semibold text-gray-700">
                                {f.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {validItems.map((item, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                            {fields.map(f => (
                                <td key={f.key} className="px-3 py-2 text-gray-900">
                                    {f.type === 'date' && item[f.key] 
                                        ? new Date(item[f.key]).toLocaleDateString('en-GB')
                                        : item[f.key] || '-'}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// Render budget table
function renderBudget(budget: Record<string, any>, budgetItems: { key: string; label: string; descriptionKey?: string }[]): JSX.Element {
    const hasData = budgetItems.some(item => {
        const itemData = budget[item.key];
        return itemData?.totalCost && parseFloat(itemData.totalCost) > 0;
    });

    if (!hasData) return <span className="text-gray-400">No budget items</span>;

    const total = calculateBudgetTotal(budget, budgetItems);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Item</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Qty</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Unit Cost</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {budgetItems.map(item => {
                        const itemData = budget[item.key];
                        if (!itemData?.totalCost || parseFloat(itemData.totalCost) <= 0) return null;
                        
                        const label = item.descriptionKey && itemData[item.descriptionKey]
                            ? `${item.label} (${itemData[item.descriptionKey]})`
                            : item.label;

                        return (
                            <tr key={item.key} className="border-t border-gray-100">
                                <td className="px-3 py-2 text-gray-900">{label}</td>
                                <td className="px-3 py-2 text-gray-900 text-right">{itemData.quantity}</td>
                                <td className="px-3 py-2 text-gray-900 text-right">${itemData.unitCost}</td>
                                <td className="px-3 py-2 text-gray-900 text-right font-medium">${itemData.totalCost}</td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot className="bg-primary-50">
                    <tr className="border-t-2 border-primary-200">
                        <td colSpan={3} className="px-3 py-3 text-right font-bold text-primary-800">Grand Total</td>
                        <td className="px-3 py-3 text-right font-bold text-primary-800">${total.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

// Render array of objects (like business units)
function renderArrayItems(items: any[], fields: FieldConfig[], config: FormTypeConfig): JSX.Element {
    if (!items || items.length === 0) return <span className="text-gray-400">No items</span>;

    return (
        <div className="space-y-4">
            {items.map((item, index) => {
                const nameField = fields.find(f => f.key === 'name');
                const itemName = nameField ? item[nameField.key] : `Item ${index + 1}`;
                const bookingMadeField = fields.find(f => f.key === 'bookingMade');

                return (
                    <div key={item.id || index} className="p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-gray-900 text-lg">{itemName}</h4>
                            {bookingMadeField && item.bookingMade && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Booking Made
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            {fields
                                .filter(f => f.key !== 'name' && f.key !== 'bookingMade')
                                .map(field => {
                                    const value = item[field.key];
                                    if (value === null || value === undefined || value === '') return null;

                                    return (
                                        <div key={field.key}>
                                            <span className="text-gray-500 block">{field.label}</span>
                                            <span className="font-medium text-gray-900">
                                                {field.type === 'date' && value
                                                    ? new Date(value).toLocaleDateString('en-GB')
                                                    : field.type === 'select' && field.options
                                                        ? field.options[value] || value
                                                        : value}
                                            </span>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// Main component
export default function DynamicFormDetails({ metadata, requestType, description }: DynamicFormDetailsProps) {
    const config = getFormConfig(requestType) || getFormConfig(metadata?.type);
    
    // If no config found, render generic fields
    if (!config) {
        return <GenericFieldsRenderer metadata={metadata} description={description} />;
    }

    const primaryValue = config.primaryField ? metadata[config.primaryField] : null;
    const badgeField = config.badgeField;
    const badgeValue = badgeField ? metadata[badgeField.key] : null;

    return (
        <div className="space-y-6">
            {/* Primary Overview Card */}
            {primaryValue && (
                <Card className="!p-0 overflow-hidden border-primary-100 shadow-sm bg-gradient-to-br from-primary-50 via-white to-accent/5">
                    <div className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">
                                    {config.displayName}
                                </span>
                                <h2 className="text-2xl font-bold text-text-primary mt-1 font-heading">
                                    {primaryValue}
                                </h2>
                                {badgeField && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                            badgeValue 
                                                ? `bg-${badgeField.trueColor}-100 text-${badgeField.trueColor}-700`
                                                : `bg-${badgeField.falseColor}-100 text-${badgeField.falseColor}-700`
                                        }`}>
                                            {SectionIcons.user}
                                            {badgeValue ? badgeField.trueLabel : badgeField.falseLabel}
                                        </span>
                                    </div>
                                )}
                            </div>
                            {config.secondaryFields && config.secondaryFields.length > 0 && (
                                <div className="text-right">
                                    {config.secondaryFields.map(fieldKey => {
                                        const field = config.fields.find(f => f.key === fieldKey);
                                        const value = metadata[fieldKey];
                                        if (!field || !value) return null;
                                        
                                        return (
                                            <div key={fieldKey}>
                                                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                                                    {field.label}
                                                </span>
                                                <div className="text-lg font-semibold text-text-primary mt-1">
                                                    {renderFieldValue(value, field, metadata)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            )}

            {/* Render sections */}
            {config.sections.map(section => {
                const sectionFields = config.fields.filter(f => f.section === section.key);
                if (sectionFields.length === 0) return null;

                // Check if any field in this section has data
                const hasData = sectionFields.some(field => {
                    const value = metadata[field.key];
                    return shouldDisplayField(value, field);
                });

                // Special handling for conditional sections (like travel document)
                if (section.key === 'travel' && !metadata.processTravelDocument) {
                    return null;
                }

                if (!hasData) return null;

                const bgColorClass = section.bgColor ? `bg-${section.bgColor}/50` : 'bg-gray-50/50';
                const borderColorClass = section.borderColor ? `border-${section.borderColor}` : 'border-gray-200';

                return (
                    <Card key={section.key} className={`!p-0 overflow-hidden ${borderColorClass} shadow-sm`}>
                        <div className={`${bgColorClass} px-6 py-4 border-b ${borderColorClass}`}>
                            <h3 className="font-semibold text-text-primary font-heading flex items-center gap-2">
                                {section.icon && SectionIcons[section.icon]}
                                {section.title}
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {sectionFields.map(field => {
                                    const value = metadata[field.key];
                                    if (!shouldDisplayField(value, field)) return null;

                                    const colSpanClass = field.colSpan === 2 ? 'md:col-span-2' : '';

                                    // Handle special field types
                                    if (field.type === 'array' && field.nestedFields) {
                                        return (
                                            <div key={field.key} className="md:col-span-2">
                                                {renderArrayItems(value, field.nestedFields, config)}
                                            </div>
                                        );
                                    }

                                    if (field.type === 'table' && field.nestedFields) {
                                        return (
                                            <div key={field.key} className="md:col-span-2">
                                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 block">
                                                    {field.label}
                                                </label>
                                                {renderTable(value, field.nestedFields)}
                                            </div>
                                        );
                                    }

                                    if (field.type === 'budget' && field.budgetItems) {
                                        return (
                                            <div key={field.key} className="md:col-span-2">
                                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 block">
                                                    {field.label}
                                                </label>
                                                {renderBudget(value, field.budgetItems)}
                                            </div>
                                        );
                                    }

                                    if (field.type === 'object' && field.nestedFields) {
                                        // Render nested object fields
                                        return (
                                            <div key={field.key} className="md:col-span-2 space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {field.nestedFields.map(nestedField => {
                                                        const nestedValue = value?.[nestedField.key];
                                                        if (!shouldDisplayField(nestedValue, nestedField)) return null;

                                                        if (nestedField.type === 'table' && nestedField.nestedFields) {
                                                            return (
                                                                <div key={nestedField.key} className="md:col-span-2">
                                                                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 block">
                                                                        {nestedField.label}
                                                                    </label>
                                                                    {renderTable(nestedValue, nestedField.nestedFields)}
                                                                </div>
                                                            );
                                                        }

                                                        if (nestedField.type === 'budget' && nestedField.budgetItems) {
                                                            return (
                                                                <div key={nestedField.key} className="md:col-span-2">
                                                                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 block">
                                                                        {nestedField.label}
                                                                    </label>
                                                                    {renderBudget(nestedValue, nestedField.budgetItems)}
                                                                </div>
                                                            );
                                                        }

                                                        const nestedColSpan = nestedField.colSpan === 2 ? 'md:col-span-2' : '';
                                                        return (
                                                            <div key={nestedField.key} className={`group ${nestedColSpan}`}>
                                                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block">
                                                                    {nestedField.label}
                                                                </label>
                                                                <div className="text-text-primary font-medium text-base border-b border-gray-100 pb-2">
                                                                    {renderFieldValue(nestedValue, nestedField, value)}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Standard field rendering
                                    return (
                                        <div key={field.key} className={`group ${colSpanClass}`}>
                                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block">
                                                {field.label}
                                            </label>
                                            <div className="text-text-primary font-medium text-base border-b border-gray-100 pb-2">
                                                {renderFieldValue(value, field, metadata)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </Card>
                );
            })}

            {/* Justification Card */}
            {(metadata.justification || description) && (
                <Card className="!p-0 overflow-hidden border-gray-200 shadow-sm">
                    <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100">
                        <h3 className="font-semibold text-text-primary font-heading">Justification & Notes</h3>
                    </div>
                    <div className="p-6 text-text-primary leading-relaxed whitespace-pre-wrap">
                        {metadata.justification || description || 'No justification provided.'}
                    </div>
                </Card>
            )}
        </div>
    );
}

// Generic fields renderer for unconfigured form types
function GenericFieldsRenderer({ metadata, description }: { metadata: Record<string, any>; description?: string }) {
    if (!metadata) return null;

    // Fields to exclude from generic rendering
    const excludeFields = ['approvers', 'approverRoles', 'useParallelApprovals', 'type', 'watchers'];

    const displayableFields = Object.entries(metadata)
        .filter(([key, value]) => {
            if (excludeFields.includes(key)) return false;
            if (value === null || value === undefined || value === '') return false;
            if (typeof value === 'object') return false; // Skip complex objects
            return true;
        });

    if (displayableFields.length === 0 && !description) {
        return (
            <Card className="!p-6 text-center text-gray-500">
                No details available for this request.
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="!p-0 overflow-hidden border-gray-200 shadow-sm">
                <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-text-primary font-heading">Request Details</h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {displayableFields.map(([key, value]) => (
                        <div key={key} className="group">
                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </label>
                            <div className="text-text-primary font-medium text-base border-b border-gray-100 pb-2">
                                {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {description && (
                <Card className="!p-0 overflow-hidden border-gray-200 shadow-sm">
                    <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100">
                        <h3 className="font-semibold text-text-primary font-heading">Description</h3>
                    </div>
                    <div className="p-6 text-text-primary leading-relaxed whitespace-pre-wrap">
                        {description}
                    </div>
                </Card>
            )}
        </div>
    );
}
