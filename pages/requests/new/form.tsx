import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input } from '../../../components/ui';

type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'time'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'signature'
  | 'currency'
  | 'url'
  | 'heading'
  | 'divider';

interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  accept?: string; // for file fields
  currency?: string; // for currency fields
}

interface FieldTypeConfig {
  value: FieldType;
  label: string;
  icon: string;
  description: string;
  category: 'basic' | 'advanced' | 'layout';
}

const fieldTypes: FieldTypeConfig[] = [
  // Basic Fields
  { value: 'text', label: 'Short Text', icon: 'M4 6h16M4 12h16M4 18h7', description: 'Single line text input', category: 'basic' },
  { value: 'textarea', label: 'Long Text', icon: 'M4 6h16M4 10h16M4 14h16M4 18h10', description: 'Multi-line text area', category: 'basic' },
  { value: 'number', label: 'Number', icon: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14', description: 'Numeric input', category: 'basic' },
  { value: 'email', label: 'Email', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', description: 'Email address field', category: 'basic' },
  { value: 'phone', label: 'Phone', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', description: 'Phone number field', category: 'basic' },
  { value: 'date', label: 'Date', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', description: 'Date picker', category: 'basic' },

  // Advanced Fields
  { value: 'time', label: 'Time', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', description: 'Time picker', category: 'advanced' },
  { value: 'datetime', label: 'Date & Time', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', description: 'Date and time picker', category: 'advanced' },
  { value: 'select', label: 'Dropdown', icon: 'M19 9l-7 7-7-7', description: 'Single selection dropdown', category: 'advanced' },
  { value: 'multiselect', label: 'Multi-Select', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', description: 'Multiple selection list', category: 'advanced' },
  { value: 'checkbox', label: 'Checkbox Group', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', description: 'Multiple checkboxes', category: 'advanced' },
  { value: 'radio', label: 'Radio Buttons', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', description: 'Single selection radio group', category: 'advanced' },
  { value: 'file', label: 'File Upload', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12', description: 'Upload files', category: 'advanced' },
  { value: 'signature', label: 'Signature', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', description: 'Digital signature pad', category: 'advanced' },
  { value: 'currency', label: 'Currency', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', description: 'Money/currency input', category: 'advanced' },
  { value: 'url', label: 'URL/Link', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1', description: 'Website URL field', category: 'advanced' },

  // Layout Elements
  { value: 'heading', label: 'Section Header', icon: 'M4 6h16M4 12h8m-8 6h16', description: 'Add a section heading', category: 'layout' },
  { value: 'divider', label: 'Divider', icon: 'M4 12h16', description: 'Visual separator line', category: 'layout' },
];

const currencies = ['USD', 'EUR', 'GBP', 'ZAR', 'INR', 'AUD', 'CAD', 'JPY', 'CNY'];

export default function NewFormDesignerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'basic' | 'advanced' | 'layout'>('basic');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const addField = (type: FieldType) => {
    const typeConfig = fieldTypes.find(f => f.value === type);
    const needsOptions = ['select', 'multiselect', 'checkbox', 'radio'].includes(type);
    const newField: FormField = {
      id: `field_${Date.now()}`,
      label: type === 'heading' ? 'Section Title' : type === 'divider' ? '' : `New ${typeConfig?.label} Field`,
      type,
      required: false,
      placeholder: '',
      helpText: '',
      options: needsOptions ? ['Option 1', 'Option 2', 'Option 3'] : undefined,
      currency: type === 'currency' ? 'USD' : undefined,
    };
    setFields([...fields, newField]);
    setShowFieldPicker(false);
    setExpandedFieldId(newField.id);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    if (expandedFieldId === id) setExpandedFieldId(null);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFields(newFields);
  };

  const duplicateField = (field: FormField) => {
    const newField = { ...field, id: `field_${Date.now()}`, label: `${field.label} (Copy)` };
    setFields([...fields, newField]);
  };

  const addOption = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field && field.options) {
      updateField(fieldId, { options: [...field.options, `Option ${field.options.length + 1}`] });
    }
  };

  const updateOption = (fieldId: string, optionIndex: number, value: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field && field.options) {
      const newOptions = [...field.options];
      newOptions[optionIndex] = value;
      updateField(fieldId, { options: newOptions });
    }
  };

  const removeOption = (fieldId: string, optionIndex: number) => {
    const field = fields.find(f => f.id === fieldId);
    if (field && field.options && field.options.length > 1) {
      const newOptions = field.options.filter((_, i) => i !== optionIndex);
      updateField(fieldId, { options: newOptions });
    }
  };

  const needsOptions = (type: FieldType) => ['select', 'multiselect', 'checkbox', 'radio'].includes(type);
  const isLayoutElement = (type: FieldType) => ['heading', 'divider'].includes(type);

  const handleSave = () => {
    if (!formName) return;

    // Validation: At least one signature field required
    const hasSignature = fields.some(f => f.type === 'signature');
    if (!hasSignature) {
      alert('Validation Error: The form must include at least one Signature field.');
      return;
    }

    // Prepare form data (mock save)
    // In a real app, we would save the form schema to the database here

    // Redirect to workflow selection/creation
    router.push('/requests/new/workflow');
  };

  if (status === 'loading') {
    return (
      <AppLayout title="Design Form" showBack onBack={() => router.back()}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="Design Form" showBack onBack={() => router.back()} hideNav>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-36">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-text-primary font-heading">Form Designer</h1>
          <p className="text-sm text-text-secondary mt-1">Create a custom form by adding and configuring fields</p>
        </div>

        {/* Form Details Card */}
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="font-semibold text-gray-900">Form Details</h2>
          </div>
          <div className="space-y-4">
            <Input
              label="Form Name"
              placeholder="e.g., Employee Onboarding Form"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                className="w-full px-4 py-3 min-h-[80px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                placeholder="Describe the purpose of this form..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Form Fields Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <h2 className="font-semibold text-gray-900">Form Fields</h2>
            </div>
            <span className="text-sm text-text-secondary px-2 py-1 bg-gray-100 rounded-full">
              {fields.filter(f => !isLayoutElement(f.type)).length} field{fields.filter(f => !isLayoutElement(f.type)).length !== 1 ? 's' : ''}
            </span>
          </div>

          {fields.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50">
              <div className="text-center py-10">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-100 to-accent/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium mb-1">Start building your form</p>
                <p className="text-sm text-gray-400">Click "Add Field" below to add your first field</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => {
                const typeConfig = fieldTypes.find(f => f.value === field.type);
                const isExpanded = expandedFieldId === field.id;
                const isLayout = isLayoutElement(field.type);

                if (field.type === 'divider') {
                  return (
                    <div key={field.id} className="relative group py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveField(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(index, 'down')}
                          disabled={index === fields.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <div className="flex-1 border-t-2 border-dashed border-gray-300" />
                        <button
                          type="button"
                          onClick={() => removeField(field.id)}
                          className="p-1 text-gray-400 hover:text-danger-500"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                }

                if (field.type === 'heading') {
                  return (
                    <Card key={field.id} variant="outlined" className="bg-gray-50/50">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => moveField(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => moveField(index, 'down')}
                            disabled={index === fields.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                            className="w-full text-lg font-semibold text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                            placeholder="Section Title"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeField(field.id)}
                          className="p-2 text-gray-400 hover:text-danger-500 hover:bg-danger-50 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </Card>
                  );
                }

                return (
                  <Card key={field.id} variant="outlined" className={`relative transition-all ${isExpanded ? 'ring-2 ring-primary-200 shadow-md' : ''}`}>
                    <div className="flex items-start gap-3">
                      {/* Reorder Controls */}
                      <div className="flex flex-col gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => moveField(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(index, 'down')}
                          disabled={index === fields.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {/* Field Content */}
                      <div className="flex-1">
                        {/* Field Header */}
                        <div
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={() => setExpandedFieldId(isExpanded ? null : field.id)}
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                            <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeConfig?.icon} />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 truncate">{field.label}</span>
                              {field.required && (
                                <span className="text-xs text-danger-500">*</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">{typeConfig?.label}</span>
                          </div>
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>

                        {/* Expanded Settings */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                            {/* Label */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Field Label</label>
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => updateField(field.id, { label: e.target.value })}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="Enter field label"
                              />
                            </div>

                            {/* Placeholder */}
                            {!['checkbox', 'radio', 'file', 'signature'].includes(field.type) && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder Text</label>
                                <input
                                  type="text"
                                  value={field.placeholder || ''}
                                  onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  placeholder="e.g., Enter your answer here..."
                                />
                              </div>
                            )}

                            {/* Help Text */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Help Text</label>
                              <input
                                type="text"
                                value={field.helpText || ''}
                                onChange={(e) => updateField(field.id, { helpText: e.target.value })}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="Additional instructions for this field"
                              />
                            </div>

                            {/* Currency Selector */}
                            {field.type === 'currency' && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
                                <select
                                  value={field.currency || 'USD'}
                                  onChange={(e) => updateField(field.id, { currency: e.target.value })}
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                  {currencies.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* File Accept Types */}
                            {field.type === 'file' && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Accepted File Types</label>
                                <input
                                  type="text"
                                  value={field.accept || ''}
                                  onChange={(e) => updateField(field.id, { accept: e.target.value })}
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  placeholder="e.g., .pdf,.doc,.docx"
                                />
                              </div>
                            )}

                            {/* Options Editor for select, multiselect, checkbox, radio */}
                            {needsOptions(field.type) && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-2">
                                  Options
                                </label>
                                <div className="space-y-2">
                                  {field.options?.map((option, optIndex) => (
                                    <div key={optIndex} className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-medium">
                                        {optIndex + 1}
                                      </div>
                                      <input
                                        type="text"
                                        value={option}
                                        onChange={(e) => updateOption(field.id, optIndex, e.target.value)}
                                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder={`Option ${optIndex + 1}`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeOption(field.id, optIndex)}
                                        disabled={field.options!.length <= 1}
                                        className="p-2 text-gray-400 hover:text-danger-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => addOption(field.id)}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Option
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Validation Options */}
                            {['text', 'textarea'].includes(field.type) && (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Min Length</label>
                                  <input
                                    type="number"
                                    value={field.minLength || ''}
                                    onChange={(e) => updateField(field.id, { minLength: parseInt(e.target.value) || undefined })}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    placeholder="0"
                                    min="0"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Max Length</label>
                                  <input
                                    type="number"
                                    value={field.maxLength || ''}
                                    onChange={(e) => updateField(field.id, { maxLength: parseInt(e.target.value) || undefined })}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    placeholder="Unlimited"
                                    min="0"
                                  />
                                </div>
                              </div>
                            )}

                            {['number', 'currency'].includes(field.type) && (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Minimum Value</label>
                                  <input
                                    type="number"
                                    value={field.min ?? ''}
                                    onChange={(e) => updateField(field.id, { min: parseFloat(e.target.value) || undefined })}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    placeholder="No minimum"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Maximum Value</label>
                                  <input
                                    type="number"
                                    value={field.max ?? ''}
                                    onChange={(e) => updateField(field.id, { max: parseFloat(e.target.value) || undefined })}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    placeholder="No maximum"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Required Toggle */}
                            <div className="flex items-center justify-between py-2">
                              <div>
                                <span className="text-sm font-medium text-gray-700">Required Field</span>
                                <p className="text-xs text-gray-500">Users must fill this field</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => updateField(field.id, { required: !field.required })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${field.required ? 'bg-primary-500' : 'bg-gray-200'}`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${field.required ? 'translate-x-6' : 'translate-x-1'}`}
                                />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => duplicateField(field)}
                          className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Duplicate field"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeField(field.id)}
                          className="p-2 text-gray-400 hover:text-danger-500 hover:bg-danger-50 rounded-lg transition-colors"
                          title="Remove field"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Field Section */}
        {showFieldPicker ? (
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Add Field</h3>
              <button
                type="button"
                onClick={() => setShowFieldPicker(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-lg">
              {(['basic', 'advanced', 'layout'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${activeCategory === cat
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>

            {/* Field Type Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {fieldTypes.filter(t => t.category === activeCategory).map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => addField(type.value)}
                  className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50/50 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={type.icon} />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{type.label}</p>
                    <p className="text-xs text-gray-500 truncate">{type.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        ) : (
          <button
            type="button"
            onClick={() => setShowFieldPicker(true)}
            className="w-full py-4 mb-6 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/30 transition-all flex items-center justify-center gap-2 group"
          >
            <div className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-primary-100 flex items-center justify-center transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="font-medium">Add Field</span>
          </button>
        )}

        {/* Fixed Bottom Actions */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 pb-safe lg:left-64">
          <div className="flex gap-3 max-w-4xl mx-auto">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <div className="flex-1 flex flex-col gap-1">
              <Button
                type="button"
                variant="primary"
                className="w-full"
                disabled={!formName || !fields.some(f => f.type === 'signature')}
                onClick={handleSave}
              >
                Save & Configure Workflow
              </Button>
              {(!formName || !fields.some(f => f.type === 'signature')) && (
                <p className="text-xs text-center text-amber-600">
                  {!formName ? 'Enter a form name' : 'Add a Signature field (Advanced tab)'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
