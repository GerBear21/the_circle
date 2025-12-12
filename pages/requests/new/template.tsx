import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input } from '../../../components/ui';

interface ApprovalStep {
  id: string;
  name: string;
  approverType: 'user' | 'role' | 'department' | 'manager' | 'skip_level';
  approverValue: string;
  order: number;
  isParallel: boolean;
  parallelWith?: string;
  conditions: StepCondition[];
  escalation: EscalationConfig;
  notifications: NotificationConfig;
  allowDelegation: boolean;
  requireComment: boolean;
  autoApprove: AutoApproveConfig;
}

interface StepCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'between';
  value: string;
  value2?: string;
}

interface EscalationConfig {
  enabled: boolean;
  hours: number;
  escalateTo: string;
  reminder: boolean;
  reminderHours: number;
}

interface NotificationConfig {
  onAssignment: boolean;
  onApproval: boolean;
  onRejection: boolean;
  onEscalation: boolean;
  channels: ('email' | 'push' | 'sms')[];
}

interface AutoApproveConfig {
  enabled: boolean;
  condition: 'amount_below' | 'same_approver' | 'time_elapsed';
  value: string;
}

// Form Field Types
type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'time'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'signature'
  | 'table'
  | 'section'
  | 'divider'
  | 'currency'
  | 'rating'
  | 'slider';

interface TableColumn {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  options?: string[];
  width?: string;
}

interface FieldValidation {
  required: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customMessage?: string;
}

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  defaultValue?: string;
  options?: string[];
  validation: FieldValidation;
  columns?: TableColumn[];
  minRows?: number;
  maxRows?: number;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  conditionalDisplay?: {
    enabled: boolean;
    dependsOn: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
    value: string;
  };
  width?: 'full' | 'half' | 'third';
  order: number;
}

interface WorkflowSettings {
  allowParallelApprovals: boolean;
  requireAllParallel: boolean;
  allowSkipSteps: boolean;
  allowReassignment: boolean;
  expirationDays: number;
  onExpiration: 'reject' | 'escalate' | 'notify';
  notifyRequesterOnEachStep: boolean;
  allowWithdraw: boolean;
  requireAttachments: boolean;
}

const defaultStepConfig = (): Partial<ApprovalStep> => ({
  isParallel: false,
  conditions: [],
  escalation: { enabled: false, hours: 24, escalateTo: '', reminder: true, reminderHours: 12 },
  notifications: { onAssignment: true, onApproval: true, onRejection: true, onEscalation: true, channels: ['email'] },
  allowDelegation: true,
  requireComment: false,
  autoApprove: { enabled: false, condition: 'amount_below', value: '' },
});

// Predefined Approval Workflows
interface PredefinedWorkflow {
  id: string;
  name: string;
  description: string;
  steps: Omit<ApprovalStep, 'id'>[];
}

const predefinedWorkflows: PredefinedWorkflow[] = [
  {
    id: 'capex',
    name: 'CAPEX Workflow',
    description: 'Finance Manager → GM → Procurement → Projects → MD → Finance Director → CEO',
    steps: [
      { name: 'Finance Manager Review', approverType: 'role', approverValue: 'finance', order: 1, ...defaultStepConfig() as any },
      { name: 'General Manager Approval', approverType: 'role', approverValue: 'director', order: 2, ...defaultStepConfig() as any },
      { name: 'Procurement Manager', approverType: 'role', approverValue: 'procurement', order: 3, ...defaultStepConfig() as any },
      { name: 'Projects Manager', approverType: 'department', approverValue: 'engineering', order: 4, ...defaultStepConfig() as any },
      { name: 'Managing Director', approverType: 'skip_level', approverValue: '2', order: 5, ...defaultStepConfig() as any },
      { name: 'Finance Director', approverType: 'role', approverValue: 'director', order: 6, ...defaultStepConfig() as any },
      { name: 'CEO Final Approval', approverType: 'skip_level', approverValue: '3', order: 7, requireComment: true, ...defaultStepConfig() as any },
    ],
  },
  {
    id: 'travel',
    name: 'Travel Authorization',
    description: 'Manager → HR → Finance',
    steps: [
      { name: 'Direct Manager Approval', approverType: 'manager', approverValue: 'direct', order: 1, ...defaultStepConfig() as any },
      { name: 'HR Review', approverType: 'role', approverValue: 'hr', order: 2, ...defaultStepConfig() as any },
      { name: 'Finance Approval', approverType: 'role', approverValue: 'finance', order: 3, ...defaultStepConfig() as any },
    ],
  },
  {
    id: 'standard_2step',
    name: 'Standard 2-Step Approval',
    description: 'Manager → Department Head',
    steps: [
      { name: 'Manager Approval', approverType: 'manager', approverValue: 'direct', order: 1, ...defaultStepConfig() as any },
      { name: 'Department Head Approval', approverType: 'department', approverValue: 'operations', order: 2, ...defaultStepConfig() as any },
    ],
  },
  {
    id: 'simple',
    name: 'Simple Single Approval',
    description: 'Direct Manager only',
    steps: [
      { name: 'Manager Approval', approverType: 'manager', approverValue: 'direct', order: 1, ...defaultStepConfig() as any },
    ],
  },
];

export default function NewTemplatePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [steps, setSteps] = useState<ApprovalStep[]>([]);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'fields' | 'steps' | 'settings'>('fields');
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowSettings, setWorkflowSettings] = useState<WorkflowSettings>({
    allowParallelApprovals: false,
    requireAllParallel: true,
    allowSkipSteps: false,
    allowReassignment: true,
    expirationDays: 30,
    onExpiration: 'notify',
    notifyRequesterOnEachStep: true,
    allowWithdraw: true,
    requireAttachments: false,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const handleSubmit = async () => {
    if (!templateName || steps.length === 0) {
      setError('Template name and at least one approval step are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: templateName,
          description: templateDescription,
          formFields: formFields,
          workflowSteps: steps,
          workflowSettings: workflowSettings,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create template');
      }

      router.push('/admin/document-templates');
    } catch (err: any) {
      setError(err.message || 'Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  const addStep = () => {
    const newStep: ApprovalStep = {
      id: `step_${Date.now()}`,
      name: `Step ${steps.length + 1}`,
      approverType: 'role',
      approverValue: '',
      order: steps.length + 1,
      ...defaultStepConfig(),
    } as ApprovalStep;
    setSteps([...steps, newStep]);
    setExpandedStep(newStep.id);
  };

  const handleSelectWorkflow = (workflowId: string | null) => {
    setSelectedWorkflowId(workflowId);
    if (workflowId === null) {
      // "Create custom" selected - clear steps
      setSteps([]);
      return;
    }
    const workflow = predefinedWorkflows.find(w => w.id === workflowId);
    if (workflow) {
      // Convert predefined steps into actual ApprovalStep with unique IDs
      const newSteps: ApprovalStep[] = workflow.steps.map((step, index) => ({
        ...step,
        id: `step_${Date.now()}_${index}`,
      })) as ApprovalStep[];
      setSteps(newSteps);
    }
  };

  const updateStep = (id: string, updates: Partial<ApprovalStep>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })));
    if (expandedStep === id) setExpandedStep(null);
  };

  const addCondition = (stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;
    const newCondition: StepCondition = {
      id: `cond_${Date.now()}`,
      field: '',
      operator: 'equals',
      value: '',
    };
    updateStep(stepId, { conditions: [...step.conditions, newCondition] });
  };

  const updateCondition = (stepId: string, conditionId: string, updates: Partial<StepCondition>) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;
    updateStep(stepId, {
      conditions: step.conditions.map(c => c.id === conditionId ? { ...c, ...updates } : c),
    });
  };

  const removeCondition = (stepId: string, conditionId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;
    updateStep(stepId, { conditions: step.conditions.filter(c => c.id !== conditionId) });
  };

  // Form Field Functions
  const fieldTypeConfig: Record<FieldType, { label: string; icon: string; color: string; category: string }> = {
    text: { label: 'Short Text', icon: 'M4 6h16M4 12h16M4 18h7', color: 'primary', category: 'Basic' },
    textarea: { label: 'Long Text', icon: 'M4 6h16M4 10h16M4 14h16M4 18h10', color: 'primary', category: 'Basic' },
    number: { label: 'Number', icon: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14', color: 'accent', category: 'Basic' },
    email: { label: 'Email', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'primary', category: 'Basic' },
    phone: { label: 'Phone', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', color: 'primary', category: 'Basic' },
    date: { label: 'Date', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'success', category: 'Date & Time' },
    time: { label: 'Time', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'success', category: 'Date & Time' },
    datetime: { label: 'Date & Time', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'success', category: 'Date & Time' },
    select: { label: 'Dropdown', icon: 'M19 9l-7 7-7-7', color: 'warning', category: 'Choice' },
    multiselect: { label: 'Multi-Select', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16', color: 'warning', category: 'Choice' },
    checkbox: { label: 'Checkbox', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'warning', category: 'Choice' },
    radio: { label: 'Radio Buttons', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'warning', category: 'Choice' },
    file: { label: 'File Upload', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12', color: 'accent', category: 'Advanced' },
    signature: { label: 'Signature', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', color: 'accent', category: 'Advanced' },
    table: { label: 'Table / Checklist', icon: 'M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', color: 'accent', category: 'Advanced' },
    section: { label: 'Section Header', icon: 'M4 6h16M4 12h8m-8 6h16', color: 'gray', category: 'Layout' },
    divider: { label: 'Divider', icon: 'M20 12H4', color: 'gray', category: 'Layout' },
    currency: { label: 'Currency', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'success', category: 'Basic' },
    rating: { label: 'Rating', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z', color: 'warning', category: 'Advanced' },
    slider: { label: 'Slider', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4', color: 'accent', category: 'Advanced' },
  };

  const addFormField = (type: FieldType) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type,
      label: fieldTypeConfig[type].label,
      placeholder: '',
      helpText: '',
      validation: { required: false },
      order: formFields.length + 1,
      width: 'full',
      ...(type === 'table' ? {
        columns: [
          { id: `col_${Date.now()}`, name: 'Item', type: 'text' as const },
          { id: `col_${Date.now() + 1}`, name: 'Status', type: 'checkbox' as const },
        ],
        minRows: 1,
        maxRows: 10,
      } : {}),
      ...(type === 'select' || type === 'multiselect' || type === 'radio' ? {
        options: ['Option 1', 'Option 2', 'Option 3'],
      } : {}),
      ...(type === 'file' ? {
        acceptedFileTypes: ['.pdf', '.doc', '.docx', '.jpg', '.png'],
        maxFileSize: 10,
      } : {}),
      ...(type === 'slider' ? {
        validation: { required: false, min: 0, max: 100 },
      } : {}),
      ...(type === 'rating' ? {
        validation: { required: false, max: 5 },
      } : {}),
    };
    setFormFields([...formFields, newField]);
    setShowFieldPicker(false);
    setExpandedField(newField.id);
  };

  const updateFormField = (id: string, updates: Partial<FormField>) => {
    setFormFields(formFields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFormField = (id: string) => {
    setFormFields(formFields.filter(f => f.id !== id).map((f, i) => ({ ...f, order: i + 1 })));
    if (expandedField === id) setExpandedField(null);
  };

  const moveFormField = (id: string, direction: 'up' | 'down') => {
    const index = formFields.findIndex(f => f.id === id);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === formFields.length - 1)) return;
    const newFields = [...formFields];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newFields[index], newFields[swapIndex]] = [newFields[swapIndex], newFields[index]];
    setFormFields(newFields.map((f, i) => ({ ...f, order: i + 1 })));
  };

  const addTableColumn = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    if (!field || !field.columns) return;
    const newColumn: TableColumn = {
      id: `col_${Date.now()}`,
      name: `Column ${field.columns.length + 1}`,
      type: 'text',
    };
    updateFormField(fieldId, { columns: [...field.columns, newColumn] });
  };

  const updateTableColumn = (fieldId: string, columnId: string, updates: Partial<TableColumn>) => {
    const field = formFields.find(f => f.id === fieldId);
    if (!field || !field.columns) return;
    updateFormField(fieldId, {
      columns: field.columns.map(c => c.id === columnId ? { ...c, ...updates } : c),
    });
  };

  const removeTableColumn = (fieldId: string, columnId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    if (!field || !field.columns) return;
    updateFormField(fieldId, { columns: field.columns.filter(c => c.id !== columnId) });
  };

  const addOption = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    if (!field) return;
    const options = field.options || [];
    updateFormField(fieldId, { options: [...options, `Option ${options.length + 1}`] });
  };

  const updateOption = (fieldId: string, index: number, value: string) => {
    const field = formFields.find(f => f.id === fieldId);
    if (!field || !field.options) return;
    const newOptions = [...field.options];
    newOptions[index] = value;
    updateFormField(fieldId, { options: newOptions });
  };

  const removeOption = (fieldId: string, index: number) => {
    const field = formFields.find(f => f.id === fieldId);
    if (!field || !field.options) return;
    updateFormField(fieldId, { options: field.options.filter((_, i) => i !== index) });
  };

  if (status === 'loading') {
    return (
      <AppLayout title="Create Template" showBack onBack={() => router.back()}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  const renderStepConfig = (step: ApprovalStep) => {
    if (expandedStep !== step.id) return null;

    return (
      <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
        {/* Conditions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Conditions</label>
            <button
              type="button"
              onClick={() => addCondition(step.id)}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              + Add Condition
            </button>
          </div>
          {step.conditions.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No conditions - step will always be included</p>
          ) : (
            <div className="space-y-2">
              {step.conditions.map((cond) => (
                <div key={cond.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <select
                    className="flex-1 px-2 py-1.5 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={cond.field}
                    onChange={(e) => updateCondition(step.id, cond.id, { field: e.target.value })}
                  >
                    <option value="">Select field...</option>
                    <option value="amount">Amount</option>
                    <option value="category">Category</option>
                    <option value="department">Department</option>
                    <option value="priority">Priority</option>
                  </select>
                  <select
                    className="px-2 py-1.5 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={cond.operator}
                    onChange={(e) => updateCondition(step.id, cond.id, { operator: e.target.value as any })}
                  >
                    <option value="equals">equals</option>
                    <option value="not_equals">not equals</option>
                    <option value="greater_than">greater than</option>
                    <option value="less_than">less than</option>
                    <option value="contains">contains</option>
                    <option value="between">between</option>
                  </select>
                  <input
                    type="text"
                    className="w-24 px-2 py-1.5 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Value"
                    value={cond.value}
                    onChange={(e) => updateCondition(step.id, cond.id, { value: e.target.value })}
                  />
                  {cond.operator === 'between' && (
                    <input
                      type="text"
                      className="w-24 px-2 py-1.5 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="Value 2"
                      value={cond.value2 || ''}
                      onChange={(e) => updateCondition(step.id, cond.id, { value2: e.target.value })}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeCondition(step.id, cond.id)}
                    className="p-1 text-gray-400 hover:text-danger-500"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Escalation */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Escalation</label>
          <div className="p-3 bg-warning-50/50 rounded-lg border border-warning-100">
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={step.escalation.enabled}
                onChange={(e) => updateStep(step.id, { escalation: { ...step.escalation, enabled: e.target.checked } })}
                className="rounded border-gray-300 text-warning-500 focus:ring-warning-500"
              />
              <span className="text-sm text-gray-700">Enable auto-escalation</span>
            </label>
            {step.escalation.enabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Escalate after (hours)</label>
                  <input
                    type="number"
                    className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-warning-500"
                    value={step.escalation.hours}
                    onChange={(e) => updateStep(step.id, { escalation: { ...step.escalation, hours: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Escalate to</label>
                  <select
                    className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-warning-500"
                    value={step.escalation.escalateTo}
                    onChange={(e) => updateStep(step.id, { escalation: { ...step.escalation, escalateTo: e.target.value } })}
                  >
                    <option value="">Select...</option>
                    <option value="skip_level">Skip-level Manager</option>
                    <option value="department_head">Department Head</option>
                    <option value="admin">System Admin</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 col-span-2">
                  <input
                    type="checkbox"
                    checked={step.escalation.reminder}
                    onChange={(e) => updateStep(step.id, { escalation: { ...step.escalation, reminder: e.target.checked } })}
                    className="rounded border-gray-300 text-warning-500 focus:ring-warning-500"
                  />
                  <span className="text-xs text-gray-600">Send reminder {step.escalation.reminderHours}h before escalation</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Notifications</label>
          <div className="p-3 bg-primary-50/50 rounded-lg border border-primary-100">
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { key: 'onAssignment', label: 'On assignment' },
                { key: 'onApproval', label: 'On approval' },
                { key: 'onRejection', label: 'On rejection' },
                { key: 'onEscalation', label: 'On escalation' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={step.notifications[key as keyof NotificationConfig] as boolean}
                    onChange={(e) => updateStep(step.id, { notifications: { ...step.notifications, [key]: e.target.checked } })}
                    className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-xs text-gray-600">{label}</span>
                </label>
              ))}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Channels</label>
              <div className="flex gap-3">
                {['email', 'push', 'sms'].map((channel) => (
                  <label key={channel} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={step.notifications.channels.includes(channel as any)}
                      onChange={(e) => {
                        const channels = e.target.checked
                          ? [...step.notifications.channels, channel as any]
                          : step.notifications.channels.filter(c => c !== channel);
                        updateStep(step.id, { notifications: { ...step.notifications, channels } });
                      }}
                      className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-xs text-gray-600 capitalize">{channel}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Options */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Options</label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={step.allowDelegation}
                onChange={(e) => updateStep(step.id, { allowDelegation: e.target.checked })}
                className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-xs text-gray-600">Allow delegation</span>
            </label>
            <label className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={step.requireComment}
                onChange={(e) => updateStep(step.id, { requireComment: e.target.checked })}
                className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-xs text-gray-600">Require comment</span>
            </label>
          </div>
        </div>

        {/* Auto-Approve */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Auto-Approve</label>
          <div className="p-3 bg-success-50/50 rounded-lg border border-success-100">
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={step.autoApprove.enabled}
                onChange={(e) => updateStep(step.id, { autoApprove: { ...step.autoApprove, enabled: e.target.checked } })}
                className="rounded border-gray-300 text-success-500 focus:ring-success-500"
              />
              <span className="text-sm text-gray-700">Enable auto-approve</span>
            </label>
            {step.autoApprove.enabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Condition</label>
                  <select
                    className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-success-500"
                    value={step.autoApprove.condition}
                    onChange={(e) => updateStep(step.id, { autoApprove: { ...step.autoApprove, condition: e.target.value as any } })}
                  >
                    <option value="amount_below">Amount below</option>
                    <option value="same_approver">Same as previous approver</option>
                    <option value="time_elapsed">Time elapsed (hours)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Value</label>
                  <input
                    type="text"
                    className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-success-500"
                    placeholder={step.autoApprove.condition === 'amount_below' ? 'e.g., 1000' : 'e.g., 48'}
                    value={step.autoApprove.value}
                    onChange={(e) => updateStep(step.id, { autoApprove: { ...step.autoApprove, value: e.target.value } })}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderWorkflowSettings = () => (
    <Card className="mb-4">
      <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Workflow Settings
      </h3>

      <div className="space-y-4">
        {/* Parallel Approvals */}
        <div className="p-4 bg-accent/10 rounded-xl border border-accent/20">
          <label className="flex items-center gap-3 mb-3">
            <input
              type="checkbox"
              checked={workflowSettings.allowParallelApprovals}
              onChange={(e) => setWorkflowSettings({ ...workflowSettings, allowParallelApprovals: e.target.checked })}
              className="rounded border-gray-300 text-accent focus:ring-accent w-5 h-5"
            />
            <div>
              <span className="font-medium text-gray-800">Allow Parallel Approvals</span>
              <p className="text-xs text-gray-500">Multiple approvers can review simultaneously</p>
            </div>
          </label>
          {workflowSettings.allowParallelApprovals && (
            <div className="ml-8 mt-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={workflowSettings.requireAllParallel}
                  onChange={(e) => setWorkflowSettings({ ...workflowSettings, requireAllParallel: e.target.checked })}
                  className="rounded border-gray-300 text-accent focus:ring-accent"
                />
                <span className="text-sm text-gray-600">Require all parallel approvers (vs. any one)</span>
              </label>
            </div>
          )}
        </div>

        {/* Permissions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <input
              type="checkbox"
              checked={workflowSettings.allowSkipSteps}
              onChange={(e) => setWorkflowSettings({ ...workflowSettings, allowSkipSteps: e.target.checked })}
              className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Allow Skip Steps</span>
              <p className="text-xs text-gray-400">Admins can skip approval steps</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <input
              type="checkbox"
              checked={workflowSettings.allowReassignment}
              onChange={(e) => setWorkflowSettings({ ...workflowSettings, allowReassignment: e.target.checked })}
              className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Allow Reassignment</span>
              <p className="text-xs text-gray-400">Approvers can reassign to others</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <input
              type="checkbox"
              checked={workflowSettings.allowWithdraw}
              onChange={(e) => setWorkflowSettings({ ...workflowSettings, allowWithdraw: e.target.checked })}
              className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Allow Withdraw</span>
              <p className="text-xs text-gray-400">Requesters can withdraw pending requests</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <input
              type="checkbox"
              checked={workflowSettings.notifyRequesterOnEachStep}
              onChange={(e) => setWorkflowSettings({ ...workflowSettings, notifyRequesterOnEachStep: e.target.checked })}
              className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Notify on Each Step</span>
              <p className="text-xs text-gray-400">Update requester after each approval</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <input
              type="checkbox"
              checked={workflowSettings.requireAttachments}
              onChange={(e) => setWorkflowSettings({ ...workflowSettings, requireAttachments: e.target.checked })}
              className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Require Attachments</span>
              <p className="text-xs text-gray-400">Requests must include files</p>
            </div>
          </label>
        </div>

        {/* Expiration */}
        <div className="p-4 bg-danger-50/50 rounded-xl border border-danger-100">
          <h4 className="font-medium text-gray-800 mb-3">Request Expiration</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Expire after (days)</label>
              <input
                type="number"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-danger-500"
                value={workflowSettings.expirationDays}
                onChange={(e) => setWorkflowSettings({ ...workflowSettings, expirationDays: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">On expiration</label>
              <select
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-danger-500"
                value={workflowSettings.onExpiration}
                onChange={(e) => setWorkflowSettings({ ...workflowSettings, onExpiration: e.target.value as any })}
              >
                <option value="notify">Notify only</option>
                <option value="reject">Auto-reject</option>
                <option value="escalate">Escalate to admin</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <AppLayout title="Create Template" showBack onBack={() => router.back()} hideNav>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-28">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-text-primary font-heading">Create Approval Template</h1>
          <p className="text-sm text-text-secondary mt-1">Define a reusable approval workflow with custom rules</p>
        </div>

        {error && (
          <Card className="mb-4 bg-danger-50 border-danger-200">
            <p className="text-danger-600 text-sm">{error}</p>
          </Card>
        )}

        <Card className="mb-4">
          <div className="space-y-4">
            <Input
              label="Template Name"
              placeholder="e.g., Budget Approval Workflow"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                className="w-full px-4 py-3 min-h-[80px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                placeholder="Describe when this template should be used..."
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4">
          {[
            { id: 'fields', label: 'Form Fields', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
            { id: 'steps', label: 'Approval Steps', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
            { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'settings' && renderWorkflowSettings()}

        {activeTab === 'fields' && (
          <>
            {/* Field Picker Modal */}
            {showFieldPicker && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowFieldPicker(false)}>
                <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-lg text-text-primary">Add Form Field</h3>
                    <button
                      type="button"
                      onClick={() => setShowFieldPicker(false)}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-4 overflow-y-auto max-h-[60vh]">
                    {['Basic', 'Date & Time', 'Choice', 'Advanced', 'Layout'].map((category) => (
                      <div key={category} className="mb-6 last:mb-0">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{category}</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {(Object.entries(fieldTypeConfig) as [FieldType, typeof fieldTypeConfig[FieldType]][])
                            .filter(([_, config]) => config.category === category)
                            .map(([type, config]) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => addFormField(type)}
                                className={`flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-${config.color}-300 hover:bg-${config.color}-50/50 transition-all text-left`}
                              >
                                <div className={`w-10 h-10 rounded-lg bg-${config.color}-100 flex items-center justify-center flex-shrink-0`}>
                                  <svg className={`w-5 h-5 text-${config.color}-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
                                  </svg>
                                </div>
                                <span className="text-sm font-medium text-gray-700">{config.label}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-text-primary">Form Fields</h2>
                <span className="text-sm text-text-secondary">{formFields.length} field{formFields.length !== 1 ? 's' : ''}</span>
              </div>

              {formFields.length === 0 ? (
                <Card className="border-dashed border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-white">
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-100 to-accent/20 flex items-center justify-center">
                      <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-700 font-semibold text-lg">Build Your Form</p>
                    <p className="text-sm text-gray-500 mt-1 mb-6 max-w-sm mx-auto">Start adding fields to create your custom form template. Choose from 16+ field types.</p>

                    {/* Quick Add Buttons */}
                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                      {(['text', 'number', 'date', 'select', 'file', 'table'] as FieldType[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => addFormField(type)}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-primary-300 hover:bg-primary-50/50 transition-all shadow-sm"
                        >
                          <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={fieldTypeConfig[type].icon} />
                          </svg>
                          {fieldTypeConfig[type].label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowFieldPicker(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/25"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Browse All Field Types
                    </button>
                  </div>
                </Card>
              ) : (
                <div className="space-y-3">
                  {formFields.map((field, index) => (
                    <Card key={field.id} variant="outlined" className={`relative transition-all ${expandedField === field.id ? 'ring-2 ring-primary-200' : ''}`}>
                      <div className="flex items-start gap-3">
                        {/* Drag handle and field icon */}
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${fieldTypeConfig[field.type].color === 'primary' ? 'bg-primary-100' :
                            fieldTypeConfig[field.type].color === 'accent' ? 'bg-accent/20' :
                              fieldTypeConfig[field.type].color === 'success' ? 'bg-success-100' :
                                fieldTypeConfig[field.type].color === 'warning' ? 'bg-warning-100' :
                                  'bg-gray-100'
                            }`}>
                            <svg className={`w-5 h-5 ${fieldTypeConfig[field.type].color === 'primary' ? 'text-primary-600' :
                              fieldTypeConfig[field.type].color === 'accent' ? 'text-accent' :
                                fieldTypeConfig[field.type].color === 'success' ? 'text-success-600' :
                                  fieldTypeConfig[field.type].color === 'warning' ? 'text-warning-600' :
                                    'text-gray-600'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={fieldTypeConfig[field.type].icon} />
                            </svg>
                          </div>
                          {/* Move buttons */}
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => moveFormField(field.id, 'up')}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => moveFormField(field.id, 'down')}
                              disabled={index === formFields.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Field content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="text"
                              className="flex-1 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="Field label"
                              value={field.label}
                              onChange={(e) => updateFormField(field.id, { label: e.target.value })}
                            />
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-md whitespace-nowrap">
                              {fieldTypeConfig[field.type].label}
                            </span>
                            <button
                              type="button"
                              onClick={() => setExpandedField(expandedField === field.id ? null : field.id)}
                              className={`p-2 rounded-lg transition-colors ${expandedField === field.id ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                              title="Configure field"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                          </div>

                          {/* Quick badges */}
                          <div className="flex flex-wrap gap-1.5">
                            {field.validation.required && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-danger-100 text-danger-700 text-xs rounded-full">
                                Required
                              </span>
                            )}
                            {field.width !== 'full' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                {field.width === 'half' ? '50% width' : '33% width'}
                              </span>
                            )}
                            {field.conditionalDisplay?.enabled && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                Conditional
                              </span>
                            )}
                            {field.type === 'table' && field.columns && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/20 text-accent text-xs rounded-full">
                                {field.columns.length} columns
                              </span>
                            )}
                          </div>

                          {/* Expanded field configuration */}
                          {expandedField === field.id && (
                            <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                              {/* Basic settings */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {field.type !== 'section' && field.type !== 'divider' && (
                                  <>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">Placeholder</label>
                                      <input
                                        type="text"
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Enter placeholder text..."
                                        value={field.placeholder || ''}
                                        onChange={(e) => updateFormField(field.id, { placeholder: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">Help Text</label>
                                      <input
                                        type="text"
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Additional instructions..."
                                        value={field.helpText || ''}
                                        onChange={(e) => updateFormField(field.id, { helpText: e.target.value })}
                                      />
                                    </div>
                                  </>
                                )}
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Field Width</label>
                                  <select
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    value={field.width}
                                    onChange={(e) => updateFormField(field.id, { width: e.target.value as any })}
                                  >
                                    <option value="full">Full Width</option>
                                    <option value="half">Half Width (50%)</option>
                                    <option value="third">Third Width (33%)</option>
                                  </select>
                                </div>
                              </div>

                              {/* Validation settings */}
                              {field.type !== 'section' && field.type !== 'divider' && (
                                <div>
                                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Validation</label>
                                  <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                                    <label className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={field.validation.required}
                                        onChange={(e) => updateFormField(field.id, { validation: { ...field.validation, required: e.target.checked } })}
                                        className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                                      />
                                      <span className="text-sm text-gray-700">Required field</span>
                                    </label>

                                    {(field.type === 'text' || field.type === 'textarea') && (
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="block text-xs text-gray-500 mb-1">Min Length</label>
                                          <input
                                            type="number"
                                            className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                            value={field.validation.minLength || ''}
                                            onChange={(e) => updateFormField(field.id, { validation: { ...field.validation, minLength: parseInt(e.target.value) || undefined } })}
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs text-gray-500 mb-1">Max Length</label>
                                          <input
                                            type="number"
                                            className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                            value={field.validation.maxLength || ''}
                                            onChange={(e) => updateFormField(field.id, { validation: { ...field.validation, maxLength: parseInt(e.target.value) || undefined } })}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {(field.type === 'number' || field.type === 'currency' || field.type === 'slider') && (
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="block text-xs text-gray-500 mb-1">Min Value</label>
                                          <input
                                            type="number"
                                            className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                            value={field.validation.min ?? ''}
                                            onChange={(e) => updateFormField(field.id, { validation: { ...field.validation, min: parseFloat(e.target.value) || undefined } })}
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs text-gray-500 mb-1">Max Value</label>
                                          <input
                                            type="number"
                                            className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                            value={field.validation.max ?? ''}
                                            onChange={(e) => updateFormField(field.id, { validation: { ...field.validation, max: parseFloat(e.target.value) || undefined } })}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {field.type === 'rating' && (
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-1">Max Stars</label>
                                        <select
                                          className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                          value={field.validation.max || 5}
                                          onChange={(e) => updateFormField(field.id, { validation: { ...field.validation, max: parseInt(e.target.value) } })}
                                        >
                                          <option value={3}>3 Stars</option>
                                          <option value={5}>5 Stars</option>
                                          <option value={10}>10 Stars</option>
                                        </select>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Options for select/radio/checkbox fields */}
                              {(field.type === 'select' || field.type === 'multiselect' || field.type === 'radio') && (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Options</label>
                                    <button
                                      type="button"
                                      onClick={() => addOption(field.id)}
                                      className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                    >
                                      + Add Option
                                    </button>
                                  </div>
                                  <div className="space-y-2">
                                    {(field.options || []).map((option, optIndex) => (
                                      <div key={optIndex} className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-6">{optIndex + 1}.</span>
                                        <input
                                          type="text"
                                          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                          value={option}
                                          onChange={(e) => updateOption(field.id, optIndex, e.target.value)}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => removeOption(field.id, optIndex)}
                                          className="p-1.5 text-gray-400 hover:text-danger-500"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Table/Checklist configuration */}
                              {field.type === 'table' && (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Table Columns</label>
                                    <button
                                      type="button"
                                      onClick={() => addTableColumn(field.id)}
                                      className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                    >
                                      + Add Column
                                    </button>
                                  </div>
                                  <div className="space-y-2 mb-4">
                                    {(field.columns || []).map((col, colIndex) => (
                                      <div key={col.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                        <span className="text-xs text-gray-400 w-6">{colIndex + 1}.</span>
                                        <input
                                          type="text"
                                          className="flex-1 px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                          placeholder="Column name"
                                          value={col.name}
                                          onChange={(e) => updateTableColumn(field.id, col.id, { name: e.target.value })}
                                        />
                                        <select
                                          className="px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                          value={col.type}
                                          onChange={(e) => updateTableColumn(field.id, col.id, { type: e.target.value as any })}
                                        >
                                          <option value="text">Text</option>
                                          <option value="number">Number</option>
                                          <option value="date">Date</option>
                                          <option value="select">Dropdown</option>
                                          <option value="checkbox">Checkbox</option>
                                        </select>
                                        <button
                                          type="button"
                                          onClick={() => removeTableColumn(field.id, col.id)}
                                          disabled={(field.columns?.length || 0) <= 1}
                                          className="p-1.5 text-gray-400 hover:text-danger-500 disabled:opacity-30"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Min Rows</label>
                                      <input
                                        type="number"
                                        className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                        value={field.minRows || 1}
                                        min={1}
                                        onChange={(e) => updateFormField(field.id, { minRows: parseInt(e.target.value) || 1 })}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Max Rows</label>
                                      <input
                                        type="number"
                                        className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                        value={field.maxRows || 10}
                                        min={1}
                                        onChange={(e) => updateFormField(field.id, { maxRows: parseInt(e.target.value) || 10 })}
                                      />
                                    </div>
                                  </div>

                                  {/* Table Preview */}
                                  <div className="mt-4">
                                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Preview</label>
                                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                                      <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            {(field.columns || []).map((col) => (
                                              <th key={col.id} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                {col.name}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          <tr className="border-t border-gray-100">
                                            {(field.columns || []).map((col) => (
                                              <td key={col.id} className="px-3 py-2">
                                                {col.type === 'checkbox' ? (
                                                  <input type="checkbox" disabled className="rounded border-gray-300" />
                                                ) : col.type === 'select' ? (
                                                  <select disabled className="w-full px-2 py-1 text-xs rounded border border-gray-200 bg-gray-50">
                                                    <option>Select...</option>
                                                  </select>
                                                ) : (
                                                  <input
                                                    type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                                                    disabled
                                                    className="w-full px-2 py-1 text-xs rounded border border-gray-200 bg-gray-50"
                                                    placeholder={col.type === 'date' ? '' : 'Enter...'}
                                                  />
                                                )}
                                              </td>
                                            ))}
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* File upload settings */}
                              {field.type === 'file' && (
                                <div>
                                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">File Settings</label>
                                  <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Accepted File Types</label>
                                      <input
                                        type="text"
                                        className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                        placeholder=".pdf, .doc, .jpg"
                                        value={(field.acceptedFileTypes || []).join(', ')}
                                        onChange={(e) => updateFormField(field.id, { acceptedFileTypes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Max File Size (MB)</label>
                                      <input
                                        type="number"
                                        className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                        value={field.maxFileSize || 10}
                                        min={1}
                                        onChange={(e) => updateFormField(field.id, { maxFileSize: parseInt(e.target.value) || 10 })}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Conditional Display */}
                              <div>
                                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Conditional Display</label>
                                <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-100">
                                  <label className="flex items-center gap-2 mb-3">
                                    <input
                                      type="checkbox"
                                      checked={field.conditionalDisplay?.enabled || false}
                                      onChange={(e) => updateFormField(field.id, {
                                        conditionalDisplay: {
                                          enabled: e.target.checked,
                                          dependsOn: field.conditionalDisplay?.dependsOn || '',
                                          operator: field.conditionalDisplay?.operator || 'equals',
                                          value: field.conditionalDisplay?.value || ''
                                        }
                                      })}
                                      className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                                    />
                                    <span className="text-sm text-gray-700">Show this field conditionally</span>
                                  </label>
                                  {field.conditionalDisplay?.enabled && (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                      <select
                                        className="px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        value={field.conditionalDisplay.dependsOn}
                                        onChange={(e) => updateFormField(field.id, { conditionalDisplay: { ...field.conditionalDisplay!, dependsOn: e.target.value } })}
                                      >
                                        <option value="">Select field...</option>
                                        {formFields.filter(f => f.id !== field.id).map(f => (
                                          <option key={f.id} value={f.id}>{f.label}</option>
                                        ))}
                                      </select>
                                      <select
                                        className="px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        value={field.conditionalDisplay.operator}
                                        onChange={(e) => updateFormField(field.id, { conditionalDisplay: { ...field.conditionalDisplay!, operator: e.target.value as any } })}
                                      >
                                        <option value="equals">equals</option>
                                        <option value="not_equals">not equals</option>
                                        <option value="contains">contains</option>
                                        <option value="greater_than">greater than</option>
                                        <option value="less_than">less than</option>
                                      </select>
                                      <input
                                        type="text"
                                        className="px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        placeholder="Value"
                                        value={field.conditionalDisplay.value}
                                        onChange={(e) => updateFormField(field.id, { conditionalDisplay: { ...field.conditionalDisplay!, value: e.target.value } })}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => removeFormField(field.id)}
                          className="p-2 text-gray-400 hover:text-danger-500 hover:bg-danger-50 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowFieldPicker(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/30 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Form Field
            </button>
          </>
        )}

        {activeTab === 'steps' && (
          <>
            {/* Workflow Selection */}
            <Card className="mb-4">
              <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Select Workflow Template
              </h3>
              <p className="text-sm text-text-secondary mb-4">Choose a predefined workflow or create your own custom approval flow.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {predefinedWorkflows.map((workflow) => (
                  <button
                    key={workflow.id}
                    type="button"
                    onClick={() => handleSelectWorkflow(workflow.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${selectedWorkflowId === workflow.id
                      ? 'border-primary-500 bg-primary-50/50 ring-2 ring-primary-200'
                      : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-medium text-gray-900">{workflow.name}</span>
                      {selectedWorkflowId === workflow.id && (
                        <svg className="w-5 h-5 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{workflow.description}</p>
                    <span className="inline-block mt-2 text-xs font-medium text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">
                      {workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleSelectWorkflow(null)}
                className={`w-full p-3 rounded-xl border-2 border-dashed text-center transition-all ${selectedWorkflowId === null && steps.length === 0
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-gray-300 text-gray-500 hover:border-accent hover:text-accent hover:bg-accent/5'
                  }`}
              >
                <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="text-sm font-medium">Create Custom Workflow</span>
              </button>
            </Card>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-text-primary">Approval Steps</h2>
                <span className="text-sm text-text-secondary">{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
              </div>

              {steps.length === 0 ? (
                <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50">
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <p className="text-gray-500 font-medium">No approval steps defined</p>
                    <p className="text-sm text-gray-400 mt-1">Add steps to define the approval workflow</p>
                  </div>
                </Card>
              ) : (
                <div className="space-y-3">
                  {steps.map((step) => (
                    <Card key={step.id} variant="outlined" className={`relative transition-all ${expandedStep === step.id ? 'ring-2 ring-primary-200' : ''}`}>
                      <div className="flex items-start gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${step.isParallel ? 'bg-accent/20' : 'bg-success-100'}`}>
                          <span className={`text-sm font-bold ${step.isParallel ? 'text-accent' : 'text-success-600'}`}>{step.order}</span>
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Step name"
                              value={step.name}
                              onChange={(e) => updateStep(step.id, { name: e.target.value })}
                              className="flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                              className={`p-2 rounded-lg transition-colors ${expandedStep === step.id ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                              title="Configure step"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                              </svg>
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">
                                Approver Type
                              </label>
                              <select
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                value={step.approverType}
                                onChange={(e) => updateStep(step.id, { approverType: e.target.value as any })}
                              >
                                <option value="user">Specific User</option>
                                <option value="role">Role</option>
                                <option value="department">Department Head</option>
                                <option value="manager">Direct Manager</option>
                                <option value="skip_level">Skip-level Manager</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">
                                {step.approverType === 'user' ? 'User' : step.approverType === 'role' ? 'Role' : step.approverType === 'manager' ? 'Relationship' : step.approverType === 'skip_level' ? 'Level' : 'Department'}
                              </label>
                              <select
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                value={step.approverValue}
                                onChange={(e) => updateStep(step.id, { approverValue: e.target.value })}
                              >
                                <option value="">Select...</option>
                                {step.approverType === 'role' && (
                                  <>
                                    <option value="manager">Manager</option>
                                    <option value="director">Director</option>
                                    <option value="finance">Finance Team</option>
                                    <option value="hr">HR Team</option>
                                    <option value="legal">Legal Team</option>
                                    <option value="procurement">Procurement</option>
                                  </>
                                )}
                                {step.approverType === 'department' && (
                                  <>
                                    <option value="engineering">Engineering</option>
                                    <option value="marketing">Marketing</option>
                                    <option value="sales">Sales</option>
                                    <option value="operations">Operations</option>
                                    <option value="finance">Finance</option>
                                    <option value="hr">Human Resources</option>
                                  </>
                                )}
                                {step.approverType === 'user' && (
                                  <>
                                    <option value="user1">John Doe</option>
                                    <option value="user2">Jane Smith</option>
                                    <option value="user3">Mike Johnson</option>
                                  </>
                                )}
                                {step.approverType === 'manager' && (
                                  <>
                                    <option value="direct">Direct Manager</option>
                                    <option value="cost_center">Cost Center Owner</option>
                                  </>
                                )}
                                {step.approverType === 'skip_level' && (
                                  <>
                                    <option value="1">1 Level Up</option>
                                    <option value="2">2 Levels Up</option>
                                    <option value="3">3 Levels Up</option>
                                  </>
                                )}
                              </select>
                            </div>
                          </div>

                          {/* Quick badges showing step config */}
                          <div className="flex flex-wrap gap-1.5">
                            {step.conditions.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {step.conditions.length} condition{step.conditions.length > 1 ? 's' : ''}
                              </span>
                            )}
                            {step.escalation.enabled && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-warning-100 text-warning-700 text-xs rounded-full">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {step.escalation.hours}h escalation
                              </span>
                            )}
                            {step.autoApprove.enabled && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success-100 text-success-700 text-xs rounded-full">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Auto-approve
                              </span>
                            )}
                            {step.requireComment && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                </svg>
                                Comment required
                              </span>
                            )}
                          </div>

                          {renderStepConfig(step)}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStep(step.id)}
                          className="p-2 text-gray-400 hover:text-danger-500 hover:bg-danger-50 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={addStep}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-success-400 hover:text-success-600 hover:bg-success-50/30 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Approval Step
            </button>
          </>
        )}

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
            <Button
              type="button"
              variant="primary"
              className="flex-1"
              disabled={!templateName || steps.length === 0 || loading}
              onClick={handleSubmit}
              isLoading={loading}
            >
              Save Template
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
