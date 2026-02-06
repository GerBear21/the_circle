# Adding New Form Types

This guide explains how to add a new form type to the approval system so that it automatically displays all its fields correctly in the request details page.

## Overview

The system uses a **Form Configuration Registry** (`lib/formConfig.ts`) that defines how each form type should display its fields. When you create a new form, you need to:

1. Create the form page (e.g., `pages/requests/new/your-form.tsx`)
2. Add a configuration entry in `lib/formConfig.ts`
3. The request details page will automatically render your form's fields

## Step-by-Step Guide

### 1. Create Your Form Page

Create your form in `pages/requests/new/`. Make sure to:

- Set a unique `requestType` when submitting (e.g., `'leave_request'`)
- Store all form data in the `metadata` field
- Include `type` in metadata matching your `requestType`

```typescript
// Example: pages/requests/new/leave-request.tsx
const response = await fetch('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        title: `Leave Request: ${formData.leaveType}`,
        description: formData.reason,
        priority: 'normal',
        category: 'hr',
        requestType: 'leave_request',  // Unique identifier
        status: 'pending',
        metadata: {
            type: 'leave_request',     // Must match requestType
            leaveType: formData.leaveType,
            startDate: formData.startDate,
            endDate: formData.endDate,
            numberOfDays: formData.numberOfDays,
            reason: formData.reason,
            approvers: approversArray,
            approverRoles: selectedApprovers,
            useParallelApprovals,
        },
    }),
});
```

### 2. Add Form Configuration

Open `lib/formConfig.ts` and add your form configuration to the `formConfigs` object:

```typescript
export const formConfigs: Record<string, FormTypeConfig> = {
    // ... existing configs ...

    // Your new form configuration
    leave_request: {
        type: 'leave_request',
        displayName: 'Leave Request',
        
        // Primary field shown prominently at top
        primaryField: 'leaveType',
        
        // Secondary fields shown alongside primary
        secondaryFields: ['numberOfDays'],
        
        // Optional badge field for boolean indicators
        badgeField: {
            key: 'isEmergency',
            trueLabel: 'Emergency Leave',
            falseLabel: 'Planned Leave',
            trueColor: 'red',
            falseColor: 'green',
        },
        
        // Sections for organizing fields
        sections: [
            { key: 'overview', title: 'Leave Overview', bgColor: 'primary-50', borderColor: 'primary-100' },
            { key: 'dates', title: 'Leave Dates', bgColor: 'gray-50', borderColor: 'gray-200' },
            { key: 'details', title: 'Additional Details', bgColor: 'gray-50', borderColor: 'gray-200' },
        ],
        
        // Field configurations
        fields: [
            { key: 'leaveType', label: 'Leave Type', type: 'select', section: 'overview', options: {
                annual: 'Annual Leave',
                sick: 'Sick Leave',
                maternity: 'Maternity Leave',
                paternity: 'Paternity Leave',
                unpaid: 'Unpaid Leave',
            }},
            { key: 'startDate', label: 'Start Date', type: 'date', section: 'dates' },
            { key: 'endDate', label: 'End Date', type: 'date', section: 'dates' },
            { key: 'numberOfDays', label: 'Number of Days', type: 'number', section: 'dates' },
            { key: 'reason', label: 'Reason', type: 'textarea', section: 'details', colSpan: 2 },
            { key: 'handoverNotes', label: 'Handover Notes', type: 'textarea', section: 'details', colSpan: 2, hideIfEmpty: true },
        ],
        
        // Fields to exclude from generic fallback rendering
        excludeFromGeneric: ['leaveType', 'startDate', 'endDate', 'numberOfDays', 'reason', 'handoverNotes', 'approvers', 'approverRoles', 'useParallelApprovals', 'type'],
    },
};
```

## Field Types

The system supports the following field types:

| Type | Description | Example |
|------|-------------|---------|
| `text` | Simple text field | Names, titles |
| `textarea` | Multi-line text | Descriptions, reasons |
| `number` | Numeric value | Quantities, amounts |
| `currency` | Monetary value with currency | Budgets, costs |
| `date` | Date field (auto-formatted) | Start/end dates |
| `boolean` | Yes/No field | Checkboxes, toggles |
| `select` | Dropdown with options | Categories, types |
| `array` | List of objects | Business units, items |
| `table` | Tabular data | Itineraries, line items |
| `budget` | Budget breakdown table | Travel budgets |
| `object` | Nested object with fields | Embedded forms |

## Field Configuration Options

```typescript
interface FieldConfig {
    key: string;           // Field name in metadata
    label: string;         // Display label
    type: FieldType;       // One of the types above
    
    // Optional properties
    section?: string;      // Which section to display in
    colSpan?: 1 | 2;       // Column span (2 = full width)
    hideIfEmpty?: boolean; // Hide if value is empty
    options?: Record<string, string>;  // For select fields
    currencyKey?: string;  // For currency fields
    nestedFields?: FieldConfig[];      // For array/table/object
    budgetItems?: { key: string; label: string; descriptionKey?: string }[];  // For budget
    formatter?: string;    // 'percentage' for number fields
}
```

## Section Configuration

```typescript
interface SectionConfig {
    key: string;           // Unique section identifier
    title: string;         // Section header text
    icon?: string;         // Optional icon: 'building', 'document', 'currency', 'user', 'calendar'
    bgColor?: string;      // Background color class (e.g., 'primary-50')
    borderColor?: string;  // Border color class (e.g., 'primary-100')
}
```

## Complex Field Examples

### Array of Objects (like Business Units)

```typescript
{
    key: 'items',
    label: 'Line Items',
    type: 'array',
    section: 'items',
    nestedFields: [
        { key: 'name', label: 'Item Name', type: 'text' },
        { key: 'quantity', label: 'Quantity', type: 'number' },
        { key: 'unitPrice', label: 'Unit Price', type: 'currency' },
        { key: 'total', label: 'Total', type: 'currency' },
    ]
}
```

### Table (like Itinerary)

```typescript
{
    key: 'schedule',
    label: 'Schedule',
    type: 'table',
    section: 'schedule',
    nestedFields: [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'activity', label: 'Activity', type: 'text' },
        { key: 'location', label: 'Location', type: 'text' },
    ]
}
```

### Budget Table

```typescript
{
    key: 'budget',
    label: 'Budget Breakdown',
    type: 'budget',
    section: 'financial',
    budgetItems: [
        { key: 'materials', label: 'Materials' },
        { key: 'labor', label: 'Labor' },
        { key: 'equipment', label: 'Equipment' },
        { key: 'other', label: 'Other', descriptionKey: 'description' },
    ]
}
```

Budget items expect this structure in metadata:
```typescript
budget: {
    materials: { quantity: '10', unitCost: '100', totalCost: '1000' },
    labor: { quantity: '5', unitCost: '200', totalCost: '1000' },
    // ...
}
```

## Fallback Behavior

If a form type doesn't have a configuration in `formConfigs`, the system will:

1. Display all non-object fields from metadata
2. Exclude system fields (approvers, type, etc.)
3. Auto-format field labels from camelCase
4. Show a generic "Request Details" card

This ensures new forms work immediately, even before you add their configuration.

## Testing Your Configuration

1. Create a test request using your new form
2. Navigate to `/requests/[id]` to view it
3. Verify all fields display correctly
4. Check that sections are organized properly
5. Test with empty/null values to ensure proper handling

## Tips

- **Start simple**: Add basic fields first, then add complex ones
- **Use sections**: Group related fields for better UX
- **Test edge cases**: Empty arrays, null values, missing fields
- **Match types**: Ensure `requestType` matches the config key
- **Exclude system fields**: Always exclude approvers, type, etc. from generic rendering
