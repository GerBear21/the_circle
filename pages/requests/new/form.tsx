import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input, Modal } from '../../../components/ui';
import {
  useHrimsBusinessUnits,
  useHrimsDepartments,
  OrganogramBusinessUnit,
  OrganogramDepartment,
} from '../../../hooks/useHrimsOrganogram';

// ============================================================================
// Types
// ============================================================================

type FieldType =
  | 'text' | 'textarea' | 'number' | 'email' | 'phone'
  | 'date' | 'time' | 'datetime'
  | 'select' | 'multiselect' | 'checkbox' | 'radio'
  | 'file' | 'signature' | 'table' | 'currency'
  | 'heading' | 'section' | 'divider' | 'information'
  | 'fill_in_blank' | 'spinner'
  | 'rating' | 'ranking' | 'likert';

type RatingStyle = 'stars' | 'number' | 'scale';

interface TableColumn {
  id: string;
  name: string;
  type: string;
  width?: string;
  options?: string[];
}

interface SectionChild {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  options?: string[];
  columns?: TableColumn[];
  width?: 'full' | 'half';
  order: number;
}

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  options?: string[];
  columns?: TableColumn[];
  width?: 'full' | 'half';
  order: number;
  // Heading specific
  headingLevel?: 'h2' | 'h3' | 'h4';
  // Section specific
  sectionHeader?: string;
  subheading?: string;
  sectionHelperText?: string;
  children?: SectionChild[];
  // Fill in the blank
  blankTemplate?: string;
  // Spinner
  minValue?: number;
  maxValue?: number;
  stepValue?: number;
  // Rating specific
  ratingStyle?: RatingStyle;
  ratingMax?: number;
  ratingLabels?: { low: string; high: string };
  // Ranking
  rankItems?: string[];
  // Likert
  likertRows?: string[];
  likertColumns?: string[];
  // Table enhancements
  tableMinRows?: number;
  tableMaxRows?: number;
  tableShowRowNumbers?: boolean;
  tableAllowAddRows?: boolean;
  // Page assignment for multi-page forms
  page?: number;
  // Date/time default values
  dateDefaultValue?: DateDefaultValue;
  // Information field
  informationText?: string;
  informationType?: 'info' | 'warning' | 'success' | 'error';
}

type FormScope = 'departmental' | 'business_unit' | 'multi_business_unit' | 'hotel_group';

type FormLayout = 'single_page' | 'multi_page';

type AudienceType = 'everyone' | 'departmental' | 'individuals' | 'groups' | 'organogram';

type DateDefaultValue = 'none' | 'current_date' | 'current_time' | 'current_datetime';

type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

interface SavedWorkflow {
  id: string;
  name: string;
  description?: string;
  category?: string;
  steps: any[];
  settings: any;
  is_active: boolean;
  created_at: string;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

// ============================================================================
// Constants
// ============================================================================

const FIELD_TYPES: { value: FieldType; label: string; icon: string; category: string; description?: string }[] = [
  { value: 'text', label: 'Short Text', icon: 'M4 6h16M4 12h16M4 18h7', category: 'Basic', description: 'Single line text input' },
  { value: 'textarea', label: 'Long Text', icon: 'M4 6h16M4 10h16M4 14h16M4 18h10', category: 'Basic', description: 'Multi-line text area' },
  { value: 'number', label: 'Number', icon: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14', category: 'Basic', description: 'Numeric input' },
  { value: 'email', label: 'Email', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', category: 'Basic', description: 'Email address field' },
  { value: 'phone', label: 'Phone', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', category: 'Basic', description: 'Phone number input' },
  { value: 'fill_in_blank', label: 'Fill in the Blank', icon: 'M4 6h16M4 12h6m2 0h6M4 18h16', category: 'Basic', description: 'Sentence with blanks to fill' },
  { value: 'date', label: 'Date', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', category: 'Date & Time', description: 'Date picker' },
  { value: 'time', label: 'Time', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', category: 'Date & Time', description: 'Time picker' },
  { value: 'datetime', label: 'Date & Time', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', category: 'Date & Time', description: 'Combined date and time' },
  { value: 'select', label: 'Dropdown', icon: 'M19 9l-7 7-7-7', category: 'Choice', description: 'Single selection dropdown' },
  { value: 'multiselect', label: 'Multi-Select', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16', category: 'Choice', description: 'Multiple selection list' },
  { value: 'checkbox', label: 'Checkbox', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', category: 'Choice', description: 'Checkbox group' },
  { value: 'radio', label: 'Radio Buttons', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', category: 'Choice', description: 'Single choice radio buttons' },
  { value: 'spinner', label: 'Spinner', icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6', category: 'Choice', description: 'Numeric spinner with +/- buttons' },
  { value: 'rating', label: 'Rating', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z', category: 'Rating & Ranking', description: 'Stars, number, or scale rating' },
  { value: 'ranking', label: 'Ranking', icon: 'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12', category: 'Rating & Ranking', description: 'Drag to rank items in order' },
  { value: 'likert', label: 'Likert Scale', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7', category: 'Rating & Ranking', description: 'Agreement scale matrix' },
  { value: 'file', label: 'File Upload', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12', category: 'Advanced', description: 'Upload files' },
  { value: 'signature', label: 'Signature', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', category: 'Advanced', description: 'Digital signature pad' },
  { value: 'currency', label: 'Currency', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', category: 'Advanced', description: 'Currency amount input' },
  { value: 'table', label: 'Input Table', icon: 'M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', category: 'Advanced', description: 'Customizable data table' },
  { value: 'heading', label: 'Heading', icon: 'M4 6h16M4 12h8m-8 6h16', category: 'Layout', description: 'Section heading text' },
  { value: 'section', label: 'Section', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2', category: 'Layout', description: 'Group fields with header & subheading' },
  { value: 'divider', label: 'Divider', icon: 'M20 12H4', category: 'Layout', description: 'Visual separator line' },
  { value: 'information', label: 'Information Box', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', category: 'Layout', description: 'Display informational text to users' },
];

const SCOPE_OPTIONS: { value: FormScope; label: string; icon: string; color: string; description: string }[] = [
  { value: 'departmental', label: 'Departmental', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', color: 'bg-blue-50 text-blue-600 border-blue-200', description: 'Available only within a specific department' },
  { value: 'business_unit', label: 'Business Unit', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', description: 'Available across a specific business unit' },
  { value: 'multi_business_unit', label: 'Multi-Business Units', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', color: 'bg-teal-50 text-teal-600 border-teal-200', description: 'Available across multiple selected business units' },
  { value: 'hotel_group', label: 'Hotel Group (All)', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-purple-50 text-purple-600 border-purple-200', description: 'Available to everyone in the organization' },
];

const REQUESTOR_FIELD_OPTIONS = [
  { id: 'full_name', label: 'Full Name', always: false },
  { id: 'email', label: 'Email Address', always: false },
  { id: 'department', label: 'Department', always: false },
  { id: 'business_unit', label: 'Business Unit', always: false },
  { id: 'job_title', label: 'Job Title', always: false },
  { id: 'employee_id', label: 'Employee ID', always: false },
  { id: 'phone', label: 'Phone Number', always: false },
  { id: 'date', label: 'Request Date', always: false },
];

const AUDIENCE_OPTIONS: { value: AudienceType; label: string; icon: string; description: string }[] = [
  { value: 'everyone', label: 'Everyone', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', description: 'All users can fill this form' },
  { value: 'departmental', label: 'By Department', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5', description: 'Only specific departments' },
  { value: 'individuals', label: 'Specific Individuals', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', description: 'Hand-pick who can fill this form' },
  { value: 'groups', label: 'Groups of People', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', description: 'Assign to predefined groups' },
  { value: 'organogram', label: 'From Organogram', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2', description: 'Select positions from organogram' },
];

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string; description: string }[] = [
  { value: 'none', label: 'One-time', description: 'Single submission' },
  { value: 'daily', label: 'Daily', description: 'Required every day' },
  { value: 'weekly', label: 'Weekly', description: 'Required every week' },
  { value: 'biweekly', label: 'Bi-weekly', description: 'Every two weeks' },
  { value: 'monthly', label: 'Monthly', description: 'Required every month' },
  { value: 'quarterly', label: 'Quarterly', description: 'Every three months' },
  { value: 'yearly', label: 'Yearly', description: 'Required annually' },
];

// ============================================================================
// Component
// ============================================================================

export default function NewFormDesignerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Wizard step
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Step 1: Form details
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formVersion, setFormVersion] = useState('1.0');
  const [approvalDate, setApprovalDate] = useState('');
  const [formScope, setFormScope] = useState<FormScope>('hotel_group');
  const [scopeDepartmentId, setScopeDepartmentId] = useState('');
  const [scopeBusinessUnitId, setScopeBusinessUnitId] = useState('');
  const [scopeMultiBusinessUnitIds, setScopeMultiBusinessUnitIds] = useState<string[]>([]);
  const [requestorFields, setRequestorFields] = useState<string[]>(['full_name', 'email', 'department', 'business_unit', 'date']);
  const [autofillRequestorInfo, setAutofillRequestorInfo] = useState(true);

  // Form layout
  const [formLayout, setFormLayout] = useState<FormLayout>('single_page');
  const [totalPages, setTotalPages] = useState(1);

  // Step 2: Form fields
  const [fields, setFields] = useState<FormField[]>([]);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [fieldPickerSearch, setFieldPickerSearch] = useState('');

  // Step 3: Settings (audience, recurrence, response settings)
  const [audienceType, setAudienceType] = useState<AudienceType>('everyone');
  const [audienceDepartmentIds, setAudienceDepartmentIds] = useState<string[]>([]);
  const [audienceIndividualEmails, setAudienceIndividualEmails] = useState('');
  const [audienceGroupName, setAudienceGroupName] = useState('');
  const [audiencePositions, setAudiencePositions] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [allowSubmitAnother, setAllowSubmitAnother] = useState(false);
  const [thankYouMessage, setThankYouMessage] = useState('Thank you for your submission! Your response has been recorded.');
  const [notifyOnResponse, setNotifyOnResponse] = useState(true);

  // Step 4: Workflow
  const [workflowMode, setWorkflowMode] = useState<'none' | 'select' | 'create' | 'individual_signatory' | 'self_sign'>('select');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [signatoryEmail, setSignatoryEmail] = useState('');
  const [signatoryName, setSignatoryName] = useState('');
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [workflowSearch, setWorkflowSearch] = useState('');

  // General
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // HRIMS data
  const { businessUnits } = useHrimsBusinessUnits();
  const { departments } = useHrimsDepartments(scopeBusinessUnitId || undefined);
  const { departments: allDepartments } = useHrimsDepartments(undefined);

  // Auth
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  // Fetch saved workflows
  const fetchWorkflows = useCallback(async () => {
    setLoadingWorkflows(true);
    try {
      const res = await fetch('/api/workflow-definitions?active_only=true');
      if (res.ok) {
        const data = await res.json();
        setSavedWorkflows(data.definitions || []);
      }
    } catch (err) {
      console.error('Error fetching workflows:', err);
    } finally {
      setLoadingWorkflows(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user) fetchWorkflows();
  }, [session?.user, fetchWorkflows]);

  // Filtered workflows
  const filteredWorkflows = useMemo(() => {
    if (!workflowSearch.trim()) return savedWorkflows;
    const q = workflowSearch.toLowerCase();
    return savedWorkflows.filter(w =>
      w.name.toLowerCase().includes(q) ||
      w.description?.toLowerCase().includes(q) ||
      w.category?.toLowerCase().includes(q)
    );
  }, [savedWorkflows, workflowSearch]);

  // Field actions
  const addField = (type: FieldType) => {
    const config = FIELD_TYPES.find(f => f.value === type);
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type,
      label: config?.label || type,
      placeholder: '',
      required: false,
      order: fields.length + 1,
      width: 'full',
      page: formLayout === 'multi_page' ? 1 : undefined,
      ...(type === 'select' || type === 'multiselect' || type === 'radio' || type === 'checkbox'
        ? { options: ['Option 1', 'Option 2'] } : {}),
      ...(type === 'table' ? {
        columns: [
          { id: `col_${Date.now()}`, name: 'Column 1', type: 'text' },
          { id: `col_${Date.now() + 1}`, name: 'Column 2', type: 'text' },
        ],
        tableMinRows: 1,
        tableMaxRows: 20,
        tableShowRowNumbers: true,
        tableAllowAddRows: true,
      } : {}),
      ...(type === 'heading' ? { headingLevel: 'h2' as const } : {}),
      ...(type === 'section' ? {
        sectionHeader: 'Section Title',
        subheading: '',
        sectionHelperText: '',
        children: [],
      } : {}),
      ...(type === 'fill_in_blank' ? { blankTemplate: 'I, ___, hereby confirm that ___.' } : {}),
      ...(type === 'spinner' ? { minValue: 0, maxValue: 100, stepValue: 1 } : {}),
      ...(type === 'rating' ? { ratingStyle: 'stars' as RatingStyle, ratingMax: 5, ratingLabels: { low: 'Poor', high: 'Excellent' } } : {}),
      ...(type === 'ranking' ? { rankItems: ['Item 1', 'Item 2', 'Item 3'] } : {}),
      ...(type === 'likert' ? {
        likertRows: ['Statement 1', 'Statement 2', 'Statement 3'],
        likertColumns: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
      } : {}),
    };
    setFields([...fields, newField]);
    setShowFieldPicker(false);
    setFieldPickerSearch('');
    setExpandedField(newField.id);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id).map((f, i) => ({ ...f, order: i + 1 })));
    if (expandedField === id) setExpandedField(null);
  };

  const duplicateField = (id: string) => {
    const original = fields.find(f => f.id === id);
    if (!original) return;
    const dup: FormField = { ...original, id: `field_${Date.now()}`, label: `${original.label} (copy)`, order: fields.length + 1 };
    setFields([...fields, dup]);
    setExpandedField(dup.id);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFields(newFields.map((f, i) => ({ ...f, order: i + 1 })));
  };

  // Requestor field toggle
  const toggleRequestorField = (fieldId: string) => {
    setRequestorFields(prev =>
      prev.includes(fieldId) ? prev.filter(f => f !== fieldId) : [...prev, fieldId]
    );
  };

  // Multi-business unit toggle
  const toggleMultiBusinessUnit = (buId: string) => {
    setScopeMultiBusinessUnitIds(prev =>
      prev.includes(buId) ? prev.filter(id => id !== buId) : [...prev, buId]
    );
  };

  // Audience department toggle
  const toggleAudienceDepartment = (deptId: string) => {
    setAudienceDepartmentIds(prev =>
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    );
  };

  // Filtered field types for picker search
  const filteredFieldTypes = useMemo(() => {
    if (!fieldPickerSearch.trim()) return FIELD_TYPES;
    const q = fieldPickerSearch.toLowerCase();
    return FIELD_TYPES.filter(f =>
      f.label.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q) ||
      f.description?.toLowerCase().includes(q)
    );
  }, [fieldPickerSearch]);

  // Validation per step
  const canProceed = (step: WizardStep): boolean => {
    if (step === 1) return !!formName.trim() && !!formScope;
    if (step === 2) return fields.length > 0;
    if (step === 3) return true;
    if (step === 4) {
      // No workflow required for 'none' or 'self_sign' modes
      if (workflowMode === 'none' || workflowMode === 'self_sign') return true;
      // Individual signatory requires email
      if (workflowMode === 'individual_signatory') return !!signatoryEmail.trim();
      // Select mode requires workflow selection
      if (workflowMode === 'select') return !!selectedWorkflowId;
      // Create mode always requires going to workflow builder
      return false;
    }
    return true;
  };

  // Submit
  const handleSubmit = async () => {
    if (!formName.trim()) { setError('Form name is required'); return; }
    if (fields.length === 0) { setError('Add at least one form field'); return; }
    if (workflowMode === 'select' && !selectedWorkflowId) { setError('Select a workflow'); return; }
    if (workflowMode === 'individual_signatory' && !signatoryEmail.trim()) { setError('Signatory email is required'); return; }

    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        name: formName.trim(),
        formVersion,
        approvalDate: approvalDate || null,
        scope: formScope,
        scopeDepartmentId: formScope === 'departmental' ? scopeDepartmentId || null : null,
        scopeBusinessUnitId: formScope === 'business_unit' ? scopeBusinessUnitId || null : null,
        scopeMultiBusinessUnitIds: formScope === 'multi_business_unit' ? scopeMultiBusinessUnitIds : null,
        requestorFields,
        autofillRequestorInfo,
        formLayout,
        totalPages: formLayout === 'multi_page' ? totalPages : 1,
        audienceType,
        audienceDepartmentIds: audienceType === 'departmental' ? audienceDepartmentIds : null,
        audienceIndividualEmails: audienceType === 'individuals' ? audienceIndividualEmails.split(',').map(e => e.trim()).filter(Boolean) : null,
        audienceGroupName: audienceType === 'groups' ? audienceGroupName : null,
        audiencePositions: audienceType === 'organogram' ? audiencePositions.split(',').map(p => p.trim()).filter(Boolean) : null,
        recurrence,
        allowSubmitAnother,
        thankYouMessage,
        notifyOnResponse,
        formFields: fields.map((f, i) => ({ ...f, order: i + 1 })),
        // Workflow configuration
        workflowMode,
        workflowDefinitionId: workflowMode === 'select' ? selectedWorkflowId : null,
        signatoryEmail: workflowMode === 'individual_signatory' ? signatoryEmail.trim() : null,
        signatoryName: workflowMode === 'individual_signatory' ? signatoryName.trim() || null : null,
      };

      const res = await fetch('/api/form-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save form template');

      setSuccessMsg('Form template created successfully!');
      setTimeout(() => {
        router.push('/requests/new');
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  // ============================================================================
  // Step Renderers
  // ============================================================================

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8 px-2">
      {[
        { step: 1 as WizardStep, label: 'Details' },
        { step: 2 as WizardStep, label: 'Fields' },
        { step: 3 as WizardStep, label: 'Settings' },
        { step: 4 as WizardStep, label: 'Workflow' },
        { step: 5 as WizardStep, label: 'Review' },
      ].map(({ step, label }, i) => (
        <div key={step} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-shrink-0">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                currentStep === step
                  ? 'bg-primary-600 text-white ring-4 ring-primary-100'
                  : currentStep > step
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {currentStep > step ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : step}
            </div>
            <span className={`text-[11px] mt-1.5 font-medium ${currentStep >= step ? 'text-primary-700' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
          {i < 4 && (
            <div className={`flex-1 h-0.5 mx-2 mt-[-18px] rounded ${currentStep > step ? 'bg-primary-400' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );

  // Step 1: Form Details & Scope
  const renderStep1 = () => (
    <div className="space-y-6">
      {/* RTG Logo Preview Banner — original colors, bigger, centered, white background */}
      <Card className="!p-0 overflow-hidden">
        <div className="bg-gray-50 px-6 py-6 flex flex-col items-center text-center border-b border-gray-200">
          <img src="/images/RTG_LOGO.png" alt="RTG Logo" className="h-20 w-auto mb-3" />
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Rainbow Tourism Group</p>
          <p className="text-gray-800 text-base font-semibold mt-1">{formName || 'Your Form Title'}</p>
        </div>
        <div className="p-1.5 bg-gray-100 text-center">
          <p className="text-[10px] text-gray-500 font-medium">The RTG logo will appear at the top of every form in its original colours</p>
        </div>
      </Card>

      {/* Form Name & Description */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Form Information
        </h3>
        <div className="space-y-4">
          <Input
            label="Form Name *"
            placeholder="e.g. Leave Request Form, Overtime Authorization..."
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full px-4 py-3 min-h-[80px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="Describe the purpose of this form..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
            />
          </div>

          {/* Form Version and Approval Date */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Form Version</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                placeholder="e.g. 1.0, 2.1..."
                value={formVersion}
                onChange={(e) => setFormVersion(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 mt-1">Version number for tracking form revisions</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Approval Date</label>
              <input
                type="date"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                value={approvalDate}
                onChange={(e) => setApprovalDate(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 mt-1">Date when this form version was approved</p>
            </div>
          </div>

          {/* Department Selection */}
          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              value={scopeDepartmentId}
              onChange={(e) => setScopeDepartmentId(e.target.value)}
            >
              <option value="">Select Department...</option>
              {allDepartments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">The department this form belongs to</p>
          </div>
        </div>
      </Card>

      {/* Scope Selection */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          Form Scope — Who can access this form?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SCOPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFormScope(opt.value)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                formScope === opt.value
                  ? `${opt.color} border-current ring-2 ring-offset-1`
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <svg className={`w-7 h-7 mb-2 ${formScope === opt.value ? '' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={opt.icon} />
              </svg>
              <span className="block text-sm font-bold">{opt.label}</span>
              <span className="block text-[11px] text-gray-500 mt-0.5 leading-tight">{opt.description}</span>
            </button>
          ))}
        </div>

        {formScope === 'business_unit' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Business Unit</label>
            <select
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={scopeBusinessUnitId}
              onChange={(e) => setScopeBusinessUnitId(e.target.value)}
            >
              <option value="">All Business Units</option>
              {businessUnits.map(bu => (
                <option key={bu.id} value={bu.id}>{bu.name}</option>
              ))}
            </select>
          </div>
        )}

        {formScope === 'multi_business_unit' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Business Units</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
              {businessUnits.map(bu => (
                <button
                  key={bu.id}
                  type="button"
                  onClick={() => toggleMultiBusinessUnit(bu.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left ${
                    scopeMultiBusinessUnitIds.includes(bu.id)
                      ? 'bg-teal-50 text-teal-700 border-teal-300'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {scopeMultiBusinessUnitIds.includes(bu.id) ? (
                      <svg className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-3.5 h-3.5 rounded border border-gray-300 flex-shrink-0" />
                    )}
                    {bu.name}
                  </span>
                </button>
              ))}
            </div>
            {scopeMultiBusinessUnitIds.length > 0 && (
              <p className="text-xs text-teal-600 mt-2 font-medium">{scopeMultiBusinessUnitIds.length} business unit{scopeMultiBusinessUnitIds.length !== 1 ? 's' : ''} selected</p>
            )}
          </div>
        )}

        {formScope === 'departmental' && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Unit</label>
              <select
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={scopeBusinessUnitId}
                onChange={(e) => { setScopeBusinessUnitId(e.target.value); setScopeDepartmentId(''); }}
              >
                <option value="">Select Business Unit first...</option>
                {businessUnits.map(bu => (
                  <option key={bu.id} value={bu.id}>{bu.name}</option>
                ))}
              </select>
            </div>
            {scopeBusinessUnitId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={scopeDepartmentId}
                  onChange={(e) => setScopeDepartmentId(e.target.value)}
                >
                  <option value="">Select Department...</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Requestor Info Fields */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Requestor Information Fields
        </h3>
        <p className="text-xs text-gray-500 mb-3">Select which requestor fields to include on the form. None are mandatory by default.</p>

        {/* Autofill toggle */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 mb-4 border border-gray-100">
          <div>
            <span className="text-sm font-medium text-gray-800">Auto-fill from profile</span>
            <p className="text-[11px] text-gray-500 mt-0.5">Automatically populate requestor fields from the user&apos;s profile</p>
          </div>
          <button
            type="button"
            onClick={() => setAutofillRequestorInfo(!autofillRequestorInfo)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autofillRequestorInfo ? 'bg-primary-500' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${autofillRequestorInfo ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {REQUESTOR_FIELD_OPTIONS.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggleRequestorField(opt.id)}
              className={`px-3 py-2.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                requestorFields.includes(opt.id)
                  ? 'bg-primary-50 text-primary-700 border-primary-200'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {requestorFields.includes(opt.id) ? (
                  <svg className="w-3.5 h-3.5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <div className="w-3.5 h-3.5 rounded border border-gray-300" />
                )}
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Form Layout */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
          </svg>
          Form Layout
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => { setFormLayout('single_page'); setTotalPages(1); }}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              formLayout === 'single_page'
                ? 'border-primary-500 bg-primary-50/50 ring-2 ring-primary-100'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <svg className={`w-7 h-7 mb-2 ${formLayout === 'single_page' ? 'text-primary-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="block text-sm font-bold">Single Page</span>
            <span className="block text-[11px] text-gray-500 mt-0.5">All fields on one page</span>
          </button>
          <button
            type="button"
            onClick={() => { setFormLayout('multi_page'); setTotalPages(Math.max(2, totalPages)); }}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              formLayout === 'multi_page'
                ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-100'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <svg className={`w-7 h-7 mb-2 ${formLayout === 'multi_page' ? 'text-indigo-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
            <span className="block text-sm font-bold">Multi-Page</span>
            <span className="block text-[11px] text-gray-500 mt-0.5">Split across multiple pages</span>
          </button>
        </div>
        {formLayout === 'multi_page' && (
          <div className="mt-4 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Number of pages:</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTotalPages(Math.max(2, totalPages - 1))}
                className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50"
              >-</button>
              <span className="w-10 text-center text-sm font-bold text-gray-900">{totalPages}</span>
              <button
                type="button"
                onClick={() => setTotalPages(Math.min(20, totalPages + 1))}
                className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50"
              >+</button>
            </div>
            <span className="text-xs text-gray-400">You can assign fields to pages in the next step</span>
          </div>
        )}
      </Card>
    </div>
  );

  // Step 2: Form Fields
  const renderFieldEditor = (field: FormField) => {
    const isLayoutType = ['heading', 'section', 'divider', 'information'].includes(field.type);
    return (
      <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-gray-50/30">
        {field.type !== 'divider' && (
          <Input label="Field Label" placeholder="Enter field label" value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} />
        )}
        {!isLayoutType && (
          <>
            <Input label="Placeholder" placeholder="Placeholder text..." value={field.placeholder || ''} onChange={(e) => updateField(field.id, { placeholder: e.target.value })} />
            <Input label="Help Text" placeholder="Optional help text for the user" value={field.helpText || ''} onChange={(e) => updateField(field.id, { helpText: e.target.value })} />
          </>
        )}
        <div className="flex flex-wrap items-center gap-4">
          {!isLayoutType && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={field.required} onChange={(e) => updateField(field.id, { required: e.target.checked })} className="rounded border-gray-300 text-primary-500 focus:ring-primary-500" />
              Required
            </label>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Width:</span>
            <select className="px-2 py-1 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500" value={field.width || 'full'} onChange={(e) => updateField(field.id, { width: e.target.value as any })}>
              <option value="full">Full Width</option>
              <option value="half">Half Width</option>
            </select>
          </div>
          {formLayout === 'multi_page' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Page:</span>
              <select className="px-2 py-1 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500" value={field.page || 1} onChange={(e) => updateField(field.id, { page: parseInt(e.target.value) })}>
                {Array.from({ length: totalPages }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Page {i + 1}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Heading specific */}
        {field.type === 'heading' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Level:</span>
            <select className="px-2 py-1 text-xs rounded-lg border border-gray-300" value={field.headingLevel || 'h2'} onChange={(e) => updateField(field.id, { headingLevel: e.target.value as any })}>
              <option value="h2">Heading 2 (Large)</option>
              <option value="h3">Heading 3 (Medium)</option>
              <option value="h4">Heading 4 (Small)</option>
            </select>
          </div>
        )}

        {/* Section specific */}
        {field.type === 'section' && (
          <div className="space-y-3 p-3 bg-white rounded-lg border border-gray-200">
            <Input label="Section Header" placeholder="Section title..." value={field.sectionHeader || ''} onChange={(e) => updateField(field.id, { sectionHeader: e.target.value })} />
            <Input label="Subheading" placeholder="Optional subheading..." value={field.subheading || ''} onChange={(e) => updateField(field.id, { subheading: e.target.value })} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Helper Text</label>
              <textarea className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[50px]" placeholder="Instructions or guidance for this section..." value={field.sectionHelperText || ''} onChange={(e) => updateField(field.id, { sectionHelperText: e.target.value })} />
            </div>
            <p className="text-[10px] text-gray-400 italic">Note: Section is a visual container. Fields placed after this section will appear inside it until another section or the form ends.</p>
          </div>
        )}

        {/* Information field specific */}
        {field.type === 'information' && (
          <div className="space-y-3 p-3 bg-white rounded-lg border border-gray-200">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Information Text</label>
              <textarea className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[80px]" placeholder="Enter the information message to display to users..." value={field.informationText || ''} onChange={(e) => updateField(field.id, { informationText: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-600">Style:</span>
              {(['info', 'warning', 'success', 'error'] as const).map(type => (
                <button key={type} type="button" onClick={() => updateField(field.id, { informationType: type })} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${field.informationType === type ? 'bg-primary-50 text-primary-700 border-primary-300' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Options for select, multiselect, radio, checkbox */}
        {(field.type === 'select' || field.type === 'multiselect' || field.type === 'radio' || field.type === 'checkbox') && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Options (one per line)</label>
            <textarea 
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[120px]" 
              value={(field.options || []).join('\n')} 
              onChange={(e) => updateField(field.id, { options: e.target.value.split('\n') })} 
              placeholder="Option 1&#10;Option 2&#10;Option 3"
            />
            <p className="text-[10px] text-gray-400 mt-1">Press Enter to add a new option. Empty lines will be ignored when the form is displayed.</p>
          </div>
        )}

        {/* Fill in the blank */}
        {field.type === 'fill_in_blank' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Template (use ___ for blanks)</label>
            <textarea className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[60px]" placeholder="I, ___, hereby confirm that ___." value={field.blankTemplate || ''} onChange={(e) => updateField(field.id, { blankTemplate: e.target.value })} />
            <p className="text-[10px] text-gray-400 mt-1">Use three underscores (___) to mark each blank that the user needs to fill in.</p>
          </div>
        )}

        {/* Spinner */}
        {field.type === 'spinner' && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Min Value</label>
              <input type="number" className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500" value={field.minValue ?? 0} onChange={(e) => updateField(field.id, { minValue: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Value</label>
              <input type="number" className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500" value={field.maxValue ?? 100} onChange={(e) => updateField(field.id, { maxValue: parseFloat(e.target.value) || 100 })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Step</label>
              <input type="number" className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500" value={field.stepValue ?? 1} onChange={(e) => updateField(field.id, { stepValue: parseFloat(e.target.value) || 1 })} />
            </div>
          </div>
        )}

        {/* Rating */}
        {field.type === 'rating' && (
          <div className="space-y-3 p-3 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-600">Style:</span>
              {(['stars', 'number', 'scale'] as RatingStyle[]).map(style => (
                <button key={style} type="button" onClick={() => updateField(field.id, { ratingStyle: style })} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${field.ratingStyle === style ? 'bg-primary-50 text-primary-700 border-primary-300' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                  {style === 'stars' ? 'Stars' : style === 'number' ? 'Number' : 'Scale'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-gray-600">Max rating:</label>
              <input type="number" min={2} max={10} className="w-16 px-2 py-1 text-sm rounded border border-gray-300" value={field.ratingMax || 5} onChange={(e) => updateField(field.id, { ratingMax: parseInt(e.target.value) || 5 })} />
            </div>
            {field.ratingStyle === 'scale' && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Low label" placeholder="e.g. Poor" value={field.ratingLabels?.low || ''} onChange={(e) => updateField(field.id, { ratingLabels: { low: e.target.value, high: field.ratingLabels?.high || '' } })} />
                <Input label="High label" placeholder="e.g. Excellent" value={field.ratingLabels?.high || ''} onChange={(e) => updateField(field.id, { ratingLabels: { low: field.ratingLabels?.low || '', high: e.target.value } })} />
              </div>
            )}
            {/* Preview */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 mb-1.5 font-medium">Preview:</p>
              {field.ratingStyle === 'stars' && (
                <div className="flex gap-1">{Array.from({ length: field.ratingMax || 5 }, (_, i) => (
                  <svg key={i} className={`w-6 h-6 ${i < 3 ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                ))}</div>
              )}
              {field.ratingStyle === 'number' && (
                <div className="flex gap-1">{Array.from({ length: field.ratingMax || 5 }, (_, i) => (
                  <span key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold border ${i < 3 ? 'bg-primary-50 text-primary-600 border-primary-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>{i + 1}</span>
                ))}</div>
              )}
              {field.ratingStyle === 'scale' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">{field.ratingLabels?.low || 'Low'}</span>
                  <div className="flex gap-1 flex-1">{Array.from({ length: field.ratingMax || 5 }, (_, i) => (
                    <div key={i} className={`flex-1 h-3 rounded-full ${i < 3 ? 'bg-primary-400' : 'bg-gray-200'}`} />
                  ))}</div>
                  <span className="text-[10px] text-gray-500">{field.ratingLabels?.high || 'High'}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ranking */}
        {field.type === 'ranking' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Items to rank (one per line)</label>
            <textarea className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[80px]" value={(field.rankItems || []).join('\n')} onChange={(e) => updateField(field.id, { rankItems: e.target.value.split('\n').filter(s => s.trim()) })} />
            <p className="text-[10px] text-gray-400 mt-1">Users will drag items to rank them in order of preference.</p>
          </div>
        )}

        {/* Likert */}
        {field.type === 'likert' && (
          <div className="space-y-3 p-3 bg-white rounded-lg border border-gray-200">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Statements / Rows (one per line)</label>
              <textarea className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[60px]" value={(field.likertRows || []).join('\n')} onChange={(e) => updateField(field.id, { likertRows: e.target.value.split('\n').filter(s => s.trim()) })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Scale Columns (one per line)</label>
              <textarea className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[60px]" value={(field.likertColumns || []).join('\n')} onChange={(e) => updateField(field.id, { likertColumns: e.target.value.split('\n').filter(s => s.trim()) })} />
            </div>
            {/* Preview */}
            {(field.likertRows?.length || 0) > 0 && (field.likertColumns?.length || 0) > 0 && (
              <div className="pt-2 border-t border-gray-100 overflow-x-auto">
                <p className="text-[10px] text-gray-400 mb-1.5 font-medium">Preview:</p>
                <table className="w-full text-[10px]">
                  <thead>
                    <tr>
                      <th className="text-left p-1 text-gray-500"></th>
                      {(field.likertColumns || []).map((col, i) => (
                        <th key={i} className="p-1 text-center text-gray-500 font-medium">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(field.likertRows || []).slice(0, 2).map((row, ri) => (
                      <tr key={ri} className="border-t border-gray-100">
                        <td className="p-1 text-gray-700">{row}</td>
                        {(field.likertColumns || []).map((_, ci) => (
                          <td key={ci} className="p-1 text-center"><div className="w-3 h-3 rounded-full border border-gray-300 mx-auto" /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Date/Time/DateTime default values */}
        {(field.type === 'date' || field.type === 'time' || field.type === 'datetime') && (
          <div className="space-y-3 p-3 bg-white rounded-lg border border-gray-200">
            <label className="block text-xs font-bold text-gray-700">Default Value</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'none', label: 'No default', icon: 'M6 18L18 6M6 6l12 12' },
                { value: 'current_date', label: 'Current Date', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
                { value: 'current_time', label: 'Current Time', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                { value: 'current_datetime', label: 'Current Date & Time', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2z' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateField(field.id, { dateDefaultValue: opt.value as DateDefaultValue })}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all ${
                    (field.dateDefaultValue || 'none') === opt.value
                      ? 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'bg-white border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <svg className={`w-4 h-4 ${(field.dateDefaultValue || 'none') === opt.value ? 'text-primary-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={opt.icon} />
                  </svg>
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400">The selected value will be pre-filled when the form is opened</p>
          </div>
        )}

        {/* Table — improved UI */}
        {field.type === 'table' && (
          <div className="space-y-3 p-3 bg-white rounded-lg border border-gray-200">
            <label className="block text-xs font-bold text-gray-700">Table Columns</label>
            <div className="space-y-2">
              {(field.columns || []).map((col, ci) => (
                <div key={col.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  <span className="text-[10px] text-gray-400 font-bold w-5">{ci + 1}</span>
                  <input type="text" className="flex-1 px-2 py-1.5 text-sm rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500" placeholder="Column name" value={col.name} onChange={(e) => { const cols = [...(field.columns || [])]; cols[ci] = { ...cols[ci], name: e.target.value }; updateField(field.id, { columns: cols }); }} />
                  <select className="px-2 py-1.5 text-xs rounded border border-gray-300" value={col.type} onChange={(e) => { const cols = [...(field.columns || [])]; cols[ci] = { ...cols[ci], type: e.target.value }; updateField(field.id, { columns: cols }); }}>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="select">Dropdown</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="currency">Currency</option>
                    <option value="email">Email</option>
                  </select>
                  <input type="text" className="w-16 px-2 py-1.5 text-xs rounded border border-gray-300" placeholder="Width" value={col.width || ''} onChange={(e) => { const cols = [...(field.columns || [])]; cols[ci] = { ...cols[ci], width: e.target.value }; updateField(field.id, { columns: cols }); }} />
                  <button type="button" onClick={() => { const cols = (field.columns || []).filter(c => c.id !== col.id); updateField(field.id, { columns: cols }); }} className="p-1 text-gray-400 hover:text-red-500 rounded">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => { const cols = [...(field.columns || []), { id: `col_${Date.now()}`, name: `Column ${(field.columns || []).length + 1}`, type: 'text' }]; updateField(field.id, { columns: cols }); }} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Column
              </button>
            </div>
            <div className="border-t border-gray-100 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Min Rows</label>
                <input type="number" min={0} className="w-full px-2 py-1 text-xs rounded border border-gray-300" value={field.tableMinRows ?? 1} onChange={(e) => updateField(field.id, { tableMinRows: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Max Rows</label>
                <input type="number" min={1} className="w-full px-2 py-1 text-xs rounded border border-gray-300" value={field.tableMaxRows ?? 20} onChange={(e) => updateField(field.id, { tableMaxRows: parseInt(e.target.value) || 20 })} />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={field.tableShowRowNumbers ?? true} onChange={(e) => updateField(field.id, { tableShowRowNumbers: e.target.checked })} className="rounded border-gray-300 text-primary-500 focus:ring-primary-500" />
                Row numbers
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={field.tableAllowAddRows ?? true} onChange={(e) => updateField(field.id, { tableAllowAddRows: e.target.checked })} className="rounded border-gray-300 text-primary-500 focus:ring-primary-500" />
                Allow add rows
              </label>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStep2 = () => (
    <div className="space-y-4">
      {/* Form Preview Header — original logo colors, centered, white background */}
      <Card className="!p-0 overflow-hidden">
        <div className="bg-gray-50 px-5 py-4 flex flex-col items-center text-center border-b border-gray-200">
          <img src="/images/RTG_LOGO.png" alt="RTG Logo" className="h-14 w-auto mb-2" />
          <p className="text-gray-800 text-sm font-semibold">{formName || 'Untitled Form'}</p>
          <p className="text-gray-500 text-[10px]">Design your form fields below</p>
        </div>
      </Card>

      {/* Requestor Info Preview */}
      {requestorFields.length > 0 && (
        <Card className="bg-gray-50/50 border-dashed border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Requestor Information {autofillRequestorInfo ? '(auto-filled)' : ''}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {requestorFields.map(f => {
              const opt = REQUESTOR_FIELD_OPTIONS.find(o => o.id === f);
              return (
                <div key={f} className="bg-white rounded-lg px-3 py-2 border border-gray-200">
                  <span className="text-[10px] text-gray-400 block">{opt?.label}</span>
                  <span className="text-xs text-gray-300 italic">{autofillRequestorInfo ? 'Auto-filled' : 'Manual entry'}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Fields List */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Custom Fields
        </h3>
        <span className="text-sm text-gray-500">{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
      </div>

      {fields.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50">
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <p className="text-gray-500 font-medium">No custom fields yet</p>
            <p className="text-sm text-gray-400 mt-1">Click &quot;Add Field&quot; below to start building your form</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => {
            const config = FIELD_TYPES.find(f => f.value === field.type);
            const isExpanded = expandedField === field.id;
            return (
              <Card key={field.id} className={`!p-0 overflow-hidden transition-all ${isExpanded ? 'ring-2 ring-primary-200' : ''}`}>
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/50" onClick={() => setExpandedField(isExpanded ? null : field.id)}>
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={(e) => { e.stopPropagation(); moveField(index, 'up'); }} disabled={index === 0} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); moveField(index, 'down'); }} disabled={index === fields.length - 1} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config?.icon || ''} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 block truncate">{field.label}</span>
                    <span className="text-[10px] text-gray-400">{config?.label}{field.required ? ' · Required' : ''}{formLayout === 'multi_page' && field.page ? ` · Page ${field.page}` : ''}</span>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); duplicateField(field.id); }} className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg" title="Duplicate">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeField(field.id); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {isExpanded && renderFieldEditor(field)}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Field Button / Picker */}
      {showFieldPicker ? (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Select Field Type</h3>
            <button type="button" onClick={() => { setShowFieldPicker(false); setFieldPickerSearch(''); }} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search field types..." className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" value={fieldPickerSearch} onChange={(e) => setFieldPickerSearch(e.target.value)} autoFocus />
          </div>
          {['Basic', 'Date & Time', 'Choice', 'Rating & Ranking', 'Advanced', 'Layout'].map(cat => {
            const catFields = filteredFieldTypes.filter(f => f.category === cat);
            if (catFields.length === 0) return null;
            return (
              <div key={cat} className="mb-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{cat}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {catFields.map(ft => (
                    <button key={ft.value} type="button" onClick={() => addField(ft.value)} className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50/50 transition-colors text-left group">
                      <svg className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ft.icon} />
                      </svg>
                      <div>
                        <span className="text-xs font-semibold text-gray-700 block">{ft.label}</span>
                        {ft.description && <span className="text-[10px] text-gray-400 leading-tight block mt-0.5">{ft.description}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </Card>
      ) : (
        <button type="button" onClick={() => setShowFieldPicker(true)} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/30 transition-colors flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Field
        </button>
      )}
    </div>
  );

  // Step 3: Settings (Audience, Recurrence, Response, Notifications)
  const renderStep3 = () => (
    <div className="space-y-6">
      {/* Who Can Fill This Form */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Who Can Fill This Form
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {AUDIENCE_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => setAudienceType(opt.value)} className={`p-3 rounded-xl border-2 text-left transition-all ${audienceType === opt.value ? 'border-primary-500 bg-primary-50/50 ring-2 ring-primary-100' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
              <div className="flex items-center gap-3">
                <svg className={`w-6 h-6 flex-shrink-0 ${audienceType === opt.value ? 'text-primary-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={opt.icon} />
                </svg>
                <div>
                  <span className="block text-sm font-bold">{opt.label}</span>
                  <span className="block text-[11px] text-gray-500 leading-tight">{opt.description}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {audienceType === 'departmental' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Departments</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
              {allDepartments.map(dept => (
                <button key={dept.id} type="button" onClick={() => toggleAudienceDepartment(dept.id)} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left ${audienceDepartmentIds.includes(dept.id) ? 'bg-primary-50 text-primary-700 border-primary-300' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                  <span className="flex items-center gap-1.5">
                    {audienceDepartmentIds.includes(dept.id) ? (
                      <svg className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <div className="w-3.5 h-3.5 rounded border border-gray-300 flex-shrink-0" />
                    )}
                    {dept.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {audienceType === 'individuals' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Addresses (comma-separated)</label>
            <textarea className="w-full px-4 py-3 min-h-[80px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-sm" placeholder="john@rtg.co.zw, jane@rtg.co.zw..." value={audienceIndividualEmails} onChange={(e) => setAudienceIndividualEmails(e.target.value)} />
          </div>
        )}

        {audienceType === 'groups' && (
          <div className="mt-4">
            <Input label="Group Name" placeholder="e.g. Finance Team, Hotel Managers..." value={audienceGroupName} onChange={(e) => setAudienceGroupName(e.target.value)} />
          </div>
        )}

        {audienceType === 'organogram' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Position Titles (comma-separated)</label>
            <textarea className="w-full px-4 py-3 min-h-[80px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-sm" placeholder="General Manager, Human Resources Director, Finance Manager..." value={audiencePositions} onChange={(e) => setAudiencePositions(e.target.value)} />
            <p className="text-[10px] text-gray-400 mt-1">Enter organogram position titles. These will be matched against the HRIMS organogram.</p>
          </div>
        )}
      </Card>

      {/* Form Schedule / Recurrence */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Form Schedule
        </h3>
        <p className="text-xs text-gray-500 mb-3">Define how often this form needs to be filled in.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {RECURRENCE_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => setRecurrence(opt.value)} className={`p-3 rounded-xl border-2 text-center transition-all ${recurrence === opt.value ? 'border-primary-500 bg-primary-50/50 ring-1 ring-primary-200' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
              <span className="block text-sm font-bold">{opt.label}</span>
              <span className="block text-[10px] text-gray-500 mt-0.5">{opt.description}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Response Settings */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Response Settings
        </h3>

        {/* Allow submit another */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 mb-4 border border-gray-100">
          <div>
            <span className="text-sm font-medium text-gray-800">Allow submit another response</span>
            <p className="text-[11px] text-gray-500 mt-0.5">Let users submit the form multiple times</p>
          </div>
          <button type="button" onClick={() => setAllowSubmitAnother(!allowSubmitAnother)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${allowSubmitAnother ? 'bg-primary-500' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${allowSubmitAnother ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Notify on response */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 mb-4 border border-gray-100">
          <div>
            <span className="text-sm font-medium text-gray-800">Notify me on each response</span>
            <p className="text-[11px] text-gray-500 mt-0.5">Receive a notification every time someone submits this form</p>
          </div>
          <button type="button" onClick={() => setNotifyOnResponse(!notifyOnResponse)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifyOnResponse ? 'bg-primary-500' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${notifyOnResponse ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Thank you message */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Thank You / Confirmation Message</label>
          <textarea className="w-full px-4 py-3 min-h-[80px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-sm" placeholder="Thank you for your submission!" value={thankYouMessage} onChange={(e) => setThankYouMessage(e.target.value)} />
          <p className="text-[10px] text-gray-400 mt-1">This message will be shown to users after they submit the form.</p>
        </div>
      </Card>
    </div>
  );

  // Step 4: Workflow Selection
  const renderStep4 = () => (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          Approval Workflow
        </h3>
        <p className="text-sm text-gray-500 mb-4">Choose how this form should be approved. Some forms may not need approval, while others may have a single approver or require the submitter to sign.</p>
        
        {/* Workflow Mode Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* No Approval */}
          <button 
            type="button" 
            onClick={() => setWorkflowMode('none')} 
            className={`p-4 rounded-xl border-2 text-left transition-all ${workflowMode === 'none' ? 'border-gray-500 bg-gray-50/50 ring-2 ring-gray-100' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
          >
            <svg className={`w-7 h-7 mb-2 ${workflowMode === 'none' ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <span className="block text-sm font-bold text-gray-900">No Approval</span>
            <span className="block text-[11px] text-gray-500 mt-0.5">Form submissions don&apos;t need approval</span>
          </button>

          {/* Individual Signatory */}
          <button 
            type="button" 
            onClick={() => setWorkflowMode('individual_signatory')} 
            className={`p-4 rounded-xl border-2 text-left transition-all ${workflowMode === 'individual_signatory' ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-100' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
          >
            <svg className={`w-7 h-7 mb-2 ${workflowMode === 'individual_signatory' ? 'text-amber-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="block text-sm font-bold text-gray-900">Individual Approver</span>
            <span className="block text-[11px] text-gray-500 mt-0.5">One specific person approves/signs</span>
          </button>

          {/* Self Sign */}
          <button 
            type="button" 
            onClick={() => setWorkflowMode('self_sign')} 
            className={`p-4 rounded-xl border-2 text-left transition-all ${workflowMode === 'self_sign' ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-100' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
          >
            <svg className={`w-7 h-7 mb-2 ${workflowMode === 'self_sign' ? 'text-teal-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="block text-sm font-bold text-gray-900">Self Sign</span>
            <span className="block text-[11px] text-gray-500 mt-0.5">The person filling the form signs it</span>
          </button>

          {/* Use Existing Workflow */}
          <button 
            type="button" 
            onClick={() => setWorkflowMode('select')} 
            className={`p-4 rounded-xl border-2 text-left transition-all ${workflowMode === 'select' ? 'border-primary-500 bg-primary-50/50 ring-2 ring-primary-100' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
          >
            <svg className={`w-7 h-7 mb-2 ${workflowMode === 'select' ? 'text-primary-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
            <span className="block text-sm font-bold text-gray-900">Multi-Step Workflow</span>
            <span className="block text-[11px] text-gray-500 mt-0.5">Complex approval chain</span>
          </button>
        </div>

        {/* Create New Workflow Button */}
        <div className="border-t border-gray-100 pt-4">
          <button 
            type="button" 
            onClick={() => { setWorkflowMode('create'); router.push('/requests/new/workflow?returnTo=form'); }} 
            className="w-full p-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/30 text-left transition-all flex items-center gap-3"
          >
            <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <div>
              <span className="block text-sm font-bold text-gray-800">Create New Workflow</span>
              <span className="block text-[11px] text-gray-500">Design a custom multi-step approval flow</span>
            </div>
          </button>
        </div>
      </Card>

      {/* Individual Signatory Configuration */}
      {workflowMode === 'individual_signatory' && (
        <Card>
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Signatory Details
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Signatory Email *</label>
              <input
                type="email"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                placeholder="approver@company.com"
                value={signatoryEmail}
                onChange={(e) => setSignatoryEmail(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 mt-1">The person who will receive and sign this form</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Signatory Name (Optional)</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                placeholder="e.g. John Smith"
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 mt-1">Display name for the signatory</p>
            </div>
          </div>
        </Card>
      )}

      {/* Workflow Selection List */}
      {workflowMode === 'select' && (
        <div className="space-y-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Search workflows..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" value={workflowSearch} onChange={(e) => setWorkflowSearch(e.target.value)} />
          </div>
          {loadingWorkflows ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Loading workflows...</p>
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <Card className="text-center py-8">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
              <p className="text-gray-500 font-medium">No workflows found</p>
              <p className="text-sm text-gray-400 mt-1">Create a workflow first using the &quot;Create New Workflow&quot; option</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredWorkflows.map(wf => (
                <Card key={wf.id} className={`cursor-pointer transition-all ${selectedWorkflowId === wf.id ? '!border-primary-500 ring-2 ring-primary-100 bg-primary-50/30' : 'hover:border-gray-300'}`} onClick={() => setSelectedWorkflowId(wf.id)}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedWorkflowId === wf.id ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">{wf.name}</h4>
                      <p className="text-xs text-gray-500 truncate">{wf.description || `${wf.steps?.length || 0} approval steps`}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {wf.category && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-medium">{wf.category}</span>}
                        <span className="text-[10px] text-gray-400">{wf.steps?.length || 0} steps</span>
                      </div>
                    </div>
                    {selectedWorkflowId === wf.id && (
                      <svg className="w-6 h-6 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Step 5: Review & Save
  const renderStep5 = () => {
    const selectedWf = savedWorkflows.find(w => w.id === selectedWorkflowId);
    const scopeLabel = SCOPE_OPTIONS.find(s => s.value === formScope)?.label || formScope;
    const audienceLabel = AUDIENCE_OPTIONS.find(a => a.value === audienceType)?.label || audienceType;
    const recurrenceLabel = RECURRENCE_OPTIONS.find(r => r.value === recurrence)?.label || recurrence;

    return (
      <div className="space-y-4">
        {/* Form Preview */}
        <Card className="!p-0 overflow-hidden">
          <div className="bg-gray-50 px-6 py-6 flex flex-col items-center text-center border-b border-gray-200">
            <img src="/images/RTG_LOGO.png" alt="RTG Logo" className="h-20 w-auto mb-3" />
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Rainbow Tourism Group</p>
            <p className="text-gray-800 text-lg font-bold mt-1">{formName}</p>
          </div>
          <div className="p-5 space-y-4">
            {formDescription && <p className="text-sm text-gray-600 italic">{formDescription}</p>}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Scope</span>
                <span className="text-sm font-medium text-gray-800">{scopeLabel}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Layout</span>
                <span className="text-sm font-medium text-gray-800">{formLayout === 'single_page' ? 'Single Page' : `${totalPages} Pages`}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Fields</span>
                <span className="text-sm font-medium text-gray-800">{fields.length} custom fields</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Schedule</span>
                <span className="text-sm font-medium text-gray-800">{recurrenceLabel}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Version</span>
                <span className="text-sm font-medium text-gray-800">{formVersion || 'N/A'}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Approved</span>
                <span className="text-sm font-medium text-gray-800">{approvalDate ? new Date(approvalDate).toLocaleDateString() : 'Not set'}</span>
              </div>
            </div>

            {/* Audience */}
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <span className="text-[10px] text-blue-500 uppercase font-bold block">Audience</span>
              <span className="text-sm font-medium text-blue-800">{audienceLabel}</span>
            </div>

            {/* Requestor Fields */}
            {requestorFields.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Requestor Information {autofillRequestorInfo ? '(Auto-filled)' : '(Manual)'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {requestorFields.map(f => (
                    <span key={f} className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-full font-medium">{REQUESTOR_FIELD_OPTIONS.find(o => o.id === f)?.label}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Fields Summary */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Form Fields</p>
              <div className="space-y-1.5">
                {fields.map((f, i) => (
                  <div key={f.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-gray-800">{f.label}</span>
                    <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{FIELD_TYPES.find(ft => ft.value === f.type)?.label}</span>
                    {f.required && <span className="text-[10px] text-red-500 font-medium">Required</span>}
                    {formLayout === 'multi_page' && f.page && <span className="text-[10px] text-indigo-500 font-medium">Page {f.page}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Response Settings */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Submit Another</span>
                <span className="text-sm font-medium text-gray-800">{allowSubmitAnother ? 'Yes' : 'No'}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Notifications</span>
                <span className="text-sm font-medium text-gray-800">{notifyOnResponse ? 'On' : 'Off'}</span>
              </div>
            </div>

            {/* Thank you message preview */}
            {thankYouMessage && (
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                <span className="text-[10px] text-emerald-500 uppercase font-bold block mb-1">Thank You Message</span>
                <span className="text-sm text-emerald-800">{thankYouMessage}</span>
              </div>
            )}

            {/* Workflow */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Approval Workflow</p>
              {workflowMode === 'none' && (
                <div className="bg-gray-100 rounded-lg p-3 border border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">No Approval Required</span>
                  <span className="text-xs text-gray-500 block mt-0.5">Form submissions are recorded without approval</span>
                </div>
              )}
              {workflowMode === 'self_sign' && (
                <div className="bg-teal-50 rounded-lg p-3 border border-teal-100">
                  <span className="text-sm font-semibold text-teal-800">Self Sign</span>
                  <span className="text-xs text-teal-600 block mt-0.5">The person filling the form will sign it</span>
                </div>
              )}
              {workflowMode === 'individual_signatory' && (
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                  <span className="text-sm font-semibold text-amber-800">Individual Signatory</span>
                  <span className="text-xs text-amber-600 block mt-0.5">
                    {signatoryName ? `${signatoryName} (${signatoryEmail})` : signatoryEmail}
                  </span>
                </div>
              )}
              {workflowMode === 'select' && selectedWf && (
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                  <span className="text-sm font-semibold text-indigo-800">{selectedWf.name}</span>
                  <span className="text-xs text-indigo-600 block mt-0.5">{selectedWf.steps?.length || 0} approval steps</span>
                </div>
              )}
              {workflowMode === 'select' && !selectedWf && (
                <p className="text-sm text-red-400 italic">No workflow selected</p>
              )}
            </div>
          </div>
        </Card>

        {successMsg && (
          <Card className="bg-emerald-50 border-emerald-200">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-emerald-700 font-medium">{successMsg}</p>
            </div>
          </Card>
        )}
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <AppLayout title="Design Form Template" showBack onBack={() => router.back()} hideNav>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-32 sm:pb-36">
        {renderStepIndicator()}

        {error && (
          <Card className="mb-4 bg-danger-50 border-danger-200">
            <div className="flex items-center justify-between">
              <p className="text-danger-600 text-sm">{error}</p>
              <button type="button" onClick={() => setError(null)} className="text-danger-400 hover:text-danger-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </Card>
        )}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 pb-safe lg:left-64 z-20">
          <div className="flex gap-3 max-w-4xl mx-auto">
            {currentStep > 1 ? (
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setCurrentStep((currentStep - 1) as WizardStep)}>
                Back
              </Button>
            ) : (
              <Button type="button" variant="secondary" className="flex-1" onClick={() => router.back()}>
                Cancel
              </Button>
            )}

            {currentStep < 5 ? (
              <Button type="button" variant="primary" className="flex-1" disabled={!canProceed(currentStep)} onClick={() => setCurrentStep((currentStep + 1) as WizardStep)}>
                Next Step
              </Button>
            ) : (
              <Button type="button" variant="primary" className="flex-1" disabled={loading || !!successMsg} onClick={handleSubmit} isLoading={loading}>
                {successMsg ? 'Saved!' : 'Publish Form Template'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
