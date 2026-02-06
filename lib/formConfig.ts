/**
 * Form Configuration System
 * 
 * This module provides a registry for form types and their field configurations.
 * When creating a new form, add its configuration here to automatically enable
 * proper display in the request details page.
 */

// Field types for rendering
export type FieldType = 
    | 'text' 
    | 'textarea' 
    | 'number' 
    | 'currency' 
    | 'date' 
    | 'boolean' 
    | 'select' 
    | 'array' 
    | 'object'
    | 'table'
    | 'budget';

// Field display configuration
export interface FieldConfig {
    key: string;
    label: string;
    type: FieldType;
    // For select fields, provide options mapping
    options?: Record<string, string>;
    // For currency fields, specify the currency field key
    currencyKey?: string;
    // For array/table fields, specify nested field configs
    nestedFields?: FieldConfig[];
    // For grouping fields into sections
    section?: string;
    // Column span (1 or 2 for full width)
    colSpan?: 1 | 2;
    // Whether to hide if empty
    hideIfEmpty?: boolean;
    // Custom formatter function name
    formatter?: string;
    // For budget fields, specify the budget items
    budgetItems?: { key: string; label: string; descriptionKey?: string }[];
}

// Section configuration for grouping fields
export interface SectionConfig {
    key: string;
    title: string;
    icon?: string;
    bgColor?: string;
    borderColor?: string;
    headerBgColor?: string;
}

// Complete form type configuration
export interface FormTypeConfig {
    type: string;
    displayName: string;
    // Primary display field (shown prominently at top)
    primaryField?: string;
    // Secondary info shown alongside primary
    secondaryFields?: string[];
    // Badge field (e.g., isExternalGuest)
    badgeField?: { key: string; trueLabel: string; falseLabel: string; trueColor: string; falseColor: string };
    // Sections for organizing fields
    sections: SectionConfig[];
    // All field configurations
    fields: FieldConfig[];
    // Fields to exclude from generic rendering (handled specially)
    excludeFromGeneric?: string[];
}

// ============ FORM TYPE CONFIGURATIONS ============

export const formConfigs: Record<string, FormTypeConfig> = {
    // Hotel Booking Form Configuration
    hotel_booking: {
        type: 'hotel_booking',
        displayName: 'Hotel Booking',
        primaryField: 'guestNames',
        secondaryFields: ['allocationType'],
        badgeField: {
            key: 'isExternalGuest',
            trueLabel: 'External Guest',
            falseLabel: 'Staff Member',
            trueColor: 'amber',
            falseColor: 'emerald',
        },
        sections: [
            { key: 'guest', title: 'Guest Information', bgColor: 'primary-50', borderColor: 'primary-100' },
            { key: 'booking', title: 'Booking Details', bgColor: 'gray-50', borderColor: 'gray-200' },
            { key: 'businessUnits', title: 'Business Units', icon: 'building', bgColor: 'emerald-50', borderColor: 'emerald-100' },
            { key: 'travel', title: 'Local Travel Authorization', icon: 'document', bgColor: 'blue-50', borderColor: 'blue-100' },
        ],
        fields: [
            { key: 'guestNames', label: 'Guest Names', type: 'text', section: 'guest' },
            { key: 'isExternalGuest', label: 'Guest Type', type: 'boolean', section: 'guest' },
            { key: 'allocationType', label: 'Allocation Type', type: 'select', section: 'guest', options: {
                marketing_domestic: 'Marketing – Domestic',
                marketing_international: 'Marketing – International',
                administration: 'Administration',
                promotions: 'Promotions',
                personnel: 'Personnel',
            }},
            { key: 'percentageDiscount', label: 'Percentage Discount', type: 'number', section: 'booking', formatter: 'percentage' },
            { key: 'reason', label: 'Reason for Complimentary', type: 'textarea', section: 'booking', colSpan: 2 },
            { key: 'selectedBusinessUnits', label: 'Business Units', type: 'array', section: 'businessUnits', nestedFields: [
                { key: 'name', label: 'Business Unit', type: 'text' },
                { key: 'arrivalDate', label: 'Arrival Date', type: 'date' },
                { key: 'departureDate', label: 'Departure Date', type: 'date' },
                { key: 'numberOfNights', label: 'No. of Nights', type: 'number' },
                { key: 'numberOfRooms', label: 'No. of Rooms', type: 'number' },
                { key: 'accommodationType', label: 'Accommodation Type', type: 'select', options: {
                    accommodation_only: 'Accommodation Only (Bed only)',
                    accommodation_and_breakfast: 'Bed & Breakfast',
                    accommodation_and_meals: 'Accommodation & Meals',
                    accommodation_meals_drink: 'Accommodation, Meals & Soft Drink',
                }},
                { key: 'specialArrangements', label: 'Special Arrangements', type: 'text' },
                { key: 'bookingMade', label: 'Booking Made', type: 'boolean' },
            ]},
            // Travel document fields (conditional on processTravelDocument)
            { key: 'travelDocument', label: 'Travel Document', type: 'object', section: 'travel', nestedFields: [
                { key: 'dateOfIntendedTravel', label: 'Date of Intended Travel', type: 'date' },
                { key: 'travelMode', label: 'Travel Mode', type: 'text' },
                { key: 'purposeOfTravel', label: 'Purpose of Travel', type: 'textarea', colSpan: 2 },
                { key: 'accompanyingAssociates', label: 'Accompanying Associates', type: 'textarea', colSpan: 2 },
                { key: 'itinerary', label: 'Travel Itinerary', type: 'table', nestedFields: [
                    { key: 'date', label: 'Date', type: 'date' },
                    { key: 'from', label: 'From', type: 'text' },
                    { key: 'to', label: 'To', type: 'text' },
                    { key: 'km', label: 'KM', type: 'number' },
                    { key: 'justification', label: 'Justification', type: 'text' },
                ]},
                { key: 'budget', label: 'Travel Budget', type: 'budget', budgetItems: [
                    { key: 'fuel', label: 'Fuel (Litres)' },
                    { key: 'aaRates', label: 'AA Rates (KM)' },
                    { key: 'airBusTickets', label: 'Air/Bus Tickets' },
                    { key: 'conferencingCost', label: 'Conferencing Cost' },
                    { key: 'tollgates', label: 'Tollgates' },
                    { key: 'other', label: 'Other', descriptionKey: 'description' },
                ]},
            ]},
        ],
        excludeFromGeneric: ['guestNames', 'isExternalGuest', 'allocationType', 'percentageDiscount', 'reason', 'selectedBusinessUnits', 'travelDocument', 'processTravelDocument', 'approvers', 'approverRoles', 'useParallelApprovals'],
    },

    // Travel Authorization Form Configuration
    travel_authorization: {
        type: 'travel_authorization',
        displayName: 'Travel Authorization',
        primaryField: 'purposeOfTravel',
        secondaryFields: ['dateOfIntendedTravel', 'travelMode'],
        sections: [
            { key: 'overview', title: 'Travel Overview', bgColor: 'blue-50', borderColor: 'blue-100' },
            { key: 'details', title: 'Travel Details', bgColor: 'gray-50', borderColor: 'gray-200' },
            { key: 'itinerary', title: 'Travel Itinerary', bgColor: 'gray-50', borderColor: 'gray-200' },
            { key: 'budget', title: 'Travel Budget', icon: 'currency', bgColor: 'primary-50', borderColor: 'primary-100' },
        ],
        fields: [
            { key: 'dateOfIntendedTravel', label: 'Date of Intended Travel', type: 'date', section: 'details' },
            { key: 'travelMode', label: 'Travel Mode', type: 'text', section: 'details' },
            { key: 'purposeOfTravel', label: 'Purpose of Travel', type: 'textarea', section: 'details', colSpan: 2 },
            { key: 'accompanyingAssociates', label: 'Accompanying Associates', type: 'textarea', section: 'details', colSpan: 2, hideIfEmpty: true },
            { key: 'itinerary', label: 'Travel Itinerary', type: 'table', section: 'itinerary', nestedFields: [
                { key: 'date', label: 'Date', type: 'date' },
                { key: 'from', label: 'From', type: 'text' },
                { key: 'to', label: 'To', type: 'text' },
                { key: 'km', label: 'KM', type: 'number' },
                { key: 'justification', label: 'Justification', type: 'text' },
            ]},
            { key: 'budget', label: 'Travel Budget', type: 'budget', section: 'budget', budgetItems: [
                { key: 'fuel', label: 'Fuel (Litres)' },
                { key: 'aaRates', label: 'AA Rates (KM)' },
                { key: 'airBusTickets', label: 'Air/Bus Tickets' },
                { key: 'conferencingCost', label: 'Conferencing Cost' },
                { key: 'tollgates', label: 'Tollgates' },
                { key: 'other', label: 'Other', descriptionKey: 'description' },
            ]},
            { key: 'grandTotal', label: 'Grand Total', type: 'currency', section: 'budget' },
        ],
        excludeFromGeneric: ['dateOfIntendedTravel', 'travelMode', 'purposeOfTravel', 'accompanyingAssociates', 'itinerary', 'budget', 'grandTotal', 'acceptConditions', 'approvers', 'approverRoles', 'useParallelApprovals', 'type'],
    },

    // CAPEX Form Configuration
    capex: {
        type: 'capex',
        displayName: 'Capital Expenditure',
        primaryField: 'projectName',
        secondaryFields: ['unit'],
        sections: [
            { key: 'project', title: 'Project Overview', bgColor: 'primary-50', borderColor: 'primary-100' },
            { key: 'financial', title: 'Financial Information', bgColor: 'gray-50', borderColor: 'gray-200' },
            { key: 'details', title: 'Request Details', bgColor: 'gray-50', borderColor: 'gray-200' },
            { key: 'justification', title: 'Justification', bgColor: 'gray-50', borderColor: 'gray-200' },
        ],
        fields: [
            { key: 'projectName', label: 'Project Name', type: 'text', section: 'project' },
            { key: 'unit', label: 'Business Unit', type: 'text', section: 'project' },
            { key: 'amount', label: 'Amount', type: 'currency', section: 'project', currencyKey: 'currency' },
            { key: 'currency', label: 'Currency', type: 'select', section: 'project', options: { USD: 'USD', ZIG: 'ZIG' }},
            { key: 'npv', label: 'NPV', type: 'currency', section: 'financial', currencyKey: 'currency' },
            { key: 'irr', label: 'IRR', type: 'number', section: 'financial', formatter: 'percentage' },
            { key: 'paybackPeriod', label: 'Payback Period', type: 'text', section: 'financial' },
            { key: 'budgetType', label: 'Budget Type', type: 'select', section: 'financial', options: {
                budgeted: 'Budgeted',
                unbudgeted: 'Unbudgeted',
            }},
            { key: 'fundingSource', label: 'Funding Source', type: 'text', section: 'financial' },
            { key: 'evaluation', label: 'Financial Evaluation', type: 'textarea', section: 'financial', colSpan: 2 },
            { key: 'justification', label: 'Justification', type: 'textarea', section: 'justification', colSpan: 2 },
        ],
        excludeFromGeneric: ['projectName', 'unit', 'amount', 'currency', 'npv', 'irr', 'paybackPeriod', 'budgetType', 'fundingSource', 'evaluation', 'justification', 'approvers', 'approverRoles', 'useParallelApprovals', 'type'],
    },
};

// Get form config by type
export function getFormConfig(type: string): FormTypeConfig | null {
    return formConfigs[type] || null;
}

// Get all registered form types
export function getRegisteredFormTypes(): string[] {
    return Object.keys(formConfigs);
}

// Helper to format field values
export function formatFieldValue(value: any, field: FieldConfig): string {
    if (value === null || value === undefined || value === '') return 'N/A';

    switch (field.type) {
        case 'date':
            try {
                return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            } catch {
                return value;
            }
        case 'boolean':
            return value ? 'Yes' : 'No';
        case 'select':
            return field.options?.[value] || value;
        case 'number':
            if (field.formatter === 'percentage') {
                return `${value}%`;
            }
            return typeof value === 'number' ? value.toLocaleString() : value;
        case 'currency':
            return typeof value === 'number' ? `$${value.toLocaleString()}` : `$${value}`;
        default:
            return String(value);
    }
}

// Helper to check if a field should be displayed
export function shouldDisplayField(value: any, field: FieldConfig): boolean {
    if (field.hideIfEmpty && (value === null || value === undefined || value === '')) {
        return false;
    }
    if (field.type === 'array' && (!Array.isArray(value) || value.length === 0)) {
        return false;
    }
    if (field.type === 'object' && (!value || typeof value !== 'object')) {
        return false;
    }
    return true;
}

// Calculate budget total
export function calculateBudgetTotal(budget: Record<string, any>, budgetItems: { key: string }[]): number {
    return budgetItems.reduce((sum, item) => {
        const itemData = budget[item.key];
        const totalCost = parseFloat(itemData?.totalCost) || 0;
        return sum + totalCost;
    }, 0);
}
