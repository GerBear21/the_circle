import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input, Modal } from '../../../components/ui';
import {
  useHrimsOrganogram,
  useHrimsEmployees,
  useHrimsBusinessUnits,
  useHrimsDepartments,
  OrganogramPosition,
  OrganogramEmployee,
  OrganogramBusinessUnit,
  OrganogramDepartment,
} from '../../../hooks/useHrimsOrganogram';

// ============================================================================
// Types
// ============================================================================

type ApproverSourceType = 'organogram' | 'manual' | 'dynamic';
type ApproverType =
  | 'organogram_position' // Specific Position from Org Chart
  | 'organogram_supervisor' // Supervisor Level
  | 'department_head' // HOD
  | 'role' // Job Title (Manual)
  | 'specific_user' // Specific Employee (Manual)
  | 'manager' // Direct Manager (Organogram)
  | 'dynamic_field'; // Form Field

interface ApprovalStep {
  id: string;
  name: string;
  type: 'approval';
  approverSource: ApproverSourceType;
  approverType: ApproverType;
  approverValue: string;
  approverLabel?: string;
  order: number;
  isParallel: boolean;
  conditions: StepCondition[];
  settings: StepSettings;
}

interface StepCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'between';
  value: string;
  value2?: string;
}

interface StepSettings {
  requireComment: boolean;
  allowDelegation: boolean;
  escalation: { enabled: boolean; hours: number; escalateTo: string };
  notifications: { onAssignment: boolean; onApproval: boolean; onRejection: boolean };
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

interface SavedWorkflow {
  id: string;
  name: string;
  description?: string;
  category?: string;
  steps: any[];
  settings: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  creator?: { display_name: string; email: string };
}

const defaultStepSettings = (): StepSettings => ({
  requireComment: false,
  allowDelegation: true,
  escalation: { enabled: false, hours: 24, escalateTo: '' },
  notifications: { onAssignment: true, onApproval: true, onRejection: true },
});

type WorkflowCategory = 'departmental' | 'multi_departmental' | 'business_unit' | 'inter_business_unit' | 'hotel_group';

const WORKFLOW_CATEGORIES: { value: WorkflowCategory; label: string; icon: string; color: string; description: string }[] = [
  { value: 'departmental', label: 'Departmental', icon: '🏢', color: 'bg-blue-100 text-blue-700', description: 'Within a single department' },
  { value: 'multi_departmental', label: 'Multi-Departmental', icon: '🏗️', color: 'bg-indigo-100 text-indigo-700', description: 'Across departments in same business unit' },
  { value: 'business_unit', label: 'Business Unit', icon: '🏨', color: 'bg-emerald-100 text-emerald-700', description: 'Entire business unit scope' },
  { value: 'inter_business_unit', label: 'Inter Business Unit', icon: '🔄', color: 'bg-amber-100 text-amber-700', description: 'Across multiple business units' },
  { value: 'hotel_group', label: 'Hotel Group', icon: '🌐', color: 'bg-purple-100 text-purple-700', description: 'Organization-wide (all business units)' },
];

export default function CustomizeWorkflowPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Workflow form state
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflowCategory, setWorkflowCategory] = useState<WorkflowCategory>('departmental');
  const [steps, setSteps] = useState<ApprovalStep[]>([]);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'design' | 'settings' | 'saved'>('design');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pickers State
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('');
  const [positionSearch, setPositionSearch] = useState('');
  const [showPositionPicker, setShowPositionPicker] = useState<string | null>(null); // stepId
  const [showEmployeePicker, setShowEmployeePicker] = useState<string | null>(null); // stepId
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');

  // HRIMS profile auto-detection
  const [hrimsProfile, setHrimsProfile] = useState<OrganogramEmployee | null>(null);
  const [hrimsBusinessUnit, setHrimsBusinessUnit] = useState<OrganogramBusinessUnit | null>(null);
  const [hrimsDetected, setHrimsDetected] = useState<boolean | null>(null);

  // Saved workflows
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);

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

  // HRIMS data hooks
  const { businessUnits } = useHrimsBusinessUnits();
  const isWideScope = workflowCategory === 'hotel_group' || workflowCategory === 'inter_business_unit';
  const { employees: hrimsEmployees, loading: loadingEmployees } = useHrimsEmployees(
    isWideScope ? undefined : (selectedBusinessUnit || undefined)
  );
  const { positions: organogramPositions, loading: loadingPositions } = useHrimsOrganogram({
    businessUnitId: isWideScope ? undefined : (selectedBusinessUnit || undefined),
  });
  const { departments } = useHrimsDepartments(isWideScope ? undefined : (selectedBusinessUnit || undefined));

  // Computed data for pickers
  const filteredPositions = useMemo(() => {
    if (!positionSearch.trim()) return organogramPositions;
    const q = positionSearch.toLowerCase();
    return organogramPositions.filter(p =>
      p.position_title.toLowerCase().includes(q) ||
      p.employee?.first_name?.toLowerCase().includes(q) ||
      p.employee?.last_name?.toLowerCase().includes(q) ||
      p.department?.name?.toLowerCase().includes(q)
    );
  }, [organogramPositions, positionSearch]);

  const filteredEmployees = useMemo(() => {
    let list = hrimsEmployees;
    if (selectedDepartment) list = list.filter(e => e.department_id === selectedDepartment);
    if (!employeeSearch.trim()) return list;
    const q = employeeSearch.toLowerCase();
    return list.filter(e =>
      e.first_name.toLowerCase().includes(q) ||
      e.last_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.job_title?.toLowerCase().includes(q)
    );
  }, [hrimsEmployees, employeeSearch, selectedDepartment]);

  const uniqueJobTitles = useMemo(() => {
    const titles = new Set<string>();
    hrimsEmployees.forEach(e => {
      if (e.job_title) titles.add(e.job_title);
    });
    return Array.from(titles).sort();
  }, [hrimsEmployees]);

  const departmentHeadOptions = useMemo(() => {
    return departments
      .filter(d => d.department_head_id)
      .map(d => {
        const head = hrimsEmployees.find(e => e.id === d.department_head_id);
        return {
          departmentId: d.id,
          departmentName: d.name,
          headName: head ? `${head.first_name} ${head.last_name}` : 'Unknown',
        };
      });
  }, [departments, hrimsEmployees]);

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  // Fetch HRIMS profile
  useEffect(() => {
    async function fetchHrims() {
      if (!session?.user?.email) return;
      try {
        const response = await fetch(`/api/hrims/employee-by-email?email=${encodeURIComponent(session.user.email)}`);
        const data = await response.json();
        if (response.ok && data.found) {
          setHrimsDetected(true);
          setHrimsProfile(data.employee);
          setHrimsBusinessUnit(data.businessUnit);
          if (data.businessUnit?.id) setSelectedBusinessUnit(data.businessUnit.id);
        } else {
          setHrimsDetected(false);
        }
      } catch (err) {
        console.error('Error fetching HRIMS profile:', err);
        setHrimsDetected(false);
      }
    }
    fetchHrims();
  }, [session?.user?.email]);

  // Fetch Saved Workflows
  const fetchSavedWorkflows = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const res = await fetch('/api/workflow-definitions');
      if (res.ok) {
        const data = await res.json();
        setSavedWorkflows(data.definitions || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user) fetchSavedWorkflows();
  }, [session?.user, fetchSavedWorkflows]);

  // Actions
  const loadWorkflow = (wf: SavedWorkflow) => {
    setWorkflowName(wf.name);
    setWorkflowDescription(wf.description || '');
    setWorkflowCategory((wf.category || 'departmental') as WorkflowCategory);
    setEditingWorkflowId(wf.id);
    setSteps(
      (wf.steps || []).map((s: any, i: number) => ({
        id: s.id || `step_${i}`,
        name: s.name || `Step ${i + 1}`,
        type: 'approval',
        approverSource: s.approverSource || 'organogram',
        approverType: s.approverType || 'organogram_position',
        approverValue: s.approverValue || '',
        approverLabel: s.approverLabel || '',
        order: i + 1,
        isParallel: s.isParallel || false,
        conditions: s.conditions || [],
        settings: s.settings || defaultStepSettings(),
      }))
    );
    if (wf.settings) setWorkflowSettings({ ...workflowSettings, ...wf.settings });
    setActiveTab('design');
    setSuccessMsg(null);
    setError(null);
  };

  const resetForm = () => {
    setWorkflowName('');
    setWorkflowDescription('');
    setWorkflowCategory('departmental');
    setSteps([]);
    setEditingWorkflowId(null);
    setExpandedStep(null);
    setError(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async () => {
    if (!workflowName.trim()) {
      setError('Workflow name is required');
      return;
    }
    if (steps.length === 0) {
      setError('Add at least one approval step');
      return;
    }
    for (const step of steps) {
      // Cast to string to avoid potential type narrowing issues with 'manager'
      const type = step.approverType as string;
      if (!step.approverValue && type !== 'manager' && type !== 'department_head') {
        if (type === 'manager') continue;
        setError(`Step "${step.name}" needs an approver selected`);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: workflowName.trim(),
        description: workflowDescription.trim() || null,
        category: workflowCategory,
        steps: steps.map((s, i) => ({
          ...s,
          order: i + 1,
        })),
        settings: workflowSettings,
      };

      const url = editingWorkflowId ? `/api/workflow-definitions/${editingWorkflowId}` : '/api/workflow-definitions';
      const res = await fetch(url, {
        method: editingWorkflowId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save workflow');

      setSuccessMsg(editingWorkflowId ? 'Workflow updated successfully!' : 'Workflow created successfully!');
      fetchSavedWorkflows();
      if (!editingWorkflowId) setEditingWorkflowId(data.definition?.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addStep = () => {
    const newStep: ApprovalStep = {
      id: `step_${Date.now()}`,
      name: `Step ${steps.length + 1}`,
      type: 'approval',
      approverSource: 'organogram',
      approverType: 'organogram_supervisor',
      approverValue: '1',
      approverLabel: 'Direct Supervisor',
      order: steps.length + 1,
      isParallel: false,
      conditions: [],
      settings: defaultStepSettings(),
    };
    setSteps([...steps, newStep]);
    setExpandedStep(newStep.id);
  };

  const updateStep = (id: string, updates: Partial<ApprovalStep>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })));
    if (expandedStep === id) setExpandedStep(null);
  };

  const moveStep = (id: string, direction: 'up' | 'down') => {
    const index = steps.findIndex(s => s.id === id);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === steps.length - 1)) return;
    const newSteps = [...steps];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[swapIndex]] = [newSteps[swapIndex], newSteps[index]];
    setSteps(newSteps.map((s, i) => ({ ...s, order: i + 1 })));
  };

  // Scoped positions for departmental category (only user's department)
  const departmentPositions = useMemo(() => {
    if (!hrimsProfile?.department_id) return [];
    return organogramPositions
      .filter(p => p.department_id === hrimsProfile.department_id)
      .sort((a, b) => a.level - b.level);
  }, [organogramPositions, hrimsProfile?.department_id]);

  // Auto-generate steps from organogram based on category
  const autoGenerateFromOrganogram = useCallback(() => {
    let positionsToUse: typeof organogramPositions = [];

    if (workflowCategory === 'departmental') {
      positionsToUse = departmentPositions;
    } else if (workflowCategory === 'multi_departmental' || workflowCategory === 'business_unit') {
      positionsToUse = organogramPositions
        .filter(p => p.business_unit_id === selectedBusinessUnit)
        .sort((a, b) => a.level - b.level);
    } else if (workflowCategory === 'hotel_group' || workflowCategory === 'inter_business_unit') {
      // For wide-scope categories, only show high-level positions (level 1)
      positionsToUse = organogramPositions
        .filter(p => p.level === 1)
        .sort((a, b) => a.level - b.level);
    } else {
      positionsToUse = [...organogramPositions].sort((a, b) => a.level - b.level);
    }

    if (positionsToUse.length === 0) {
      setError('No organogram positions found for the selected scope. Make sure your HRIMS profile is connected.');
      return;
    }

    // Build steps from top (lowest level number = highest rank) down
    const generatedSteps: ApprovalStep[] = positionsToUse.map((pos, i) => ({
      id: `step_${Date.now()}_${i}`,
      name: pos.position_title,
      type: 'approval',
      approverSource: 'organogram',
      approverType: 'organogram_position',
      approverValue: pos.position_title,
      approverLabel: pos.employee
        ? `${pos.position_title} (${pos.employee.first_name} ${pos.employee.last_name})`
        : `${pos.position_title} (Vacant)`,
      order: i + 1,
      isParallel: false,
      conditions: [],
      settings: defaultStepSettings(),
    }));

    setSteps(generatedSteps);
    setSuccessMsg(`Auto-generated ${generatedSteps.length} approval steps from organogram`);
    setTimeout(() => setSuccessMsg(null), 3000);
  }, [workflowCategory, departmentPositions, organogramPositions, selectedBusinessUnit]);

  // Determine which organogram sub-options to show based on category
  const organogramSubOptions = useMemo(() => {
    const base = [
      { id: 'organogram_position', label: 'Specific Position' },
    ];
    if (workflowCategory === 'departmental' || workflowCategory === 'multi_departmental') {
      return [
        { id: 'manager', label: 'Supervisor' },
        { id: 'department_head', label: 'Dept. Head' },
        ...base,
      ];
    }
    if (workflowCategory === 'business_unit') {
      return [
        { id: 'manager', label: 'Supervisor' },
        { id: 'department_head', label: 'Dept. Head' },
        ...base,
      ];
    }
    // hotel_group / inter_business_unit: any position
    return base;
  }, [workflowCategory]);

  // Helper Renderers
  const renderIcon = (type: ApproverSourceType) => {
    if (type === 'organogram') return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
    );
    if (type === 'manual') return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    );
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    );
  };

  const renderStepCard = (step: ApprovalStep, index: number) => {
    const isExpanded = expandedStep === step.id;
    return (
      <div key={step.id} className="relative pl-8 pb-8 last:pb-0">
        {/* Connection Line */}
        {index < steps.length - 1 && (
          <div className="absolute left-3.5 top-8 bottom-0 w-0.5 bg-gray-200" />
        )}

        {/* Step Number Bubble */}
        <div className={`absolute left-0 top-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ring-4 ring-white z-10 transition-colors ${isExpanded ? 'bg-primary-600 text-white' : 'bg-white border-2 border-gray-200 text-gray-500'
          }`}>
          {step.order}
        </div>

        <div className={`transition-all duration-200 ${isExpanded ? 'scale-100' : 'scale-[0.99]'}`}>
          <Card className={`overflow-visible border transition-colors ${isExpanded ? 'border-primary-200 ring-4 ring-primary-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
            {/* Header */}
            <div
              className="flex items-center justify-between p-1 cursor-pointer"
              onClick={() => setExpandedStep(isExpanded ? null : step.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${step.approverSource === 'organogram' ? 'bg-indigo-50 text-indigo-600' :
                  step.approverSource === 'manual' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                  {renderIcon(step.approverSource)}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">{step.name}</h4>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    {step.approverLabel || 'Assign Approver'}
                    {step.conditions.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-medium ml-2">
                        {step.conditions.length} condition{step.conditions.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={(e) => { e.stopPropagation(); moveStep(step.id, 'up'); }} disabled={index === 0} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg disabled:opacity-30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); moveStep(step.id, 'down'); }} disabled={index === steps.length - 1} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg disabled:opacity-30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); removeStep(step.id); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg ml-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>

            {/* Expanded Context */}
            {isExpanded && (
              <div className="border-t border-gray-100 p-4 space-y-6 animate-in slide-in-from-top-2 duration-200">
                {/* Source Selection - Big Cards */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'organogram', label: 'From Organogram', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', desc: 'Use HRIMS hierarchy' },
                    { id: 'manual', label: 'Role / Person', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', desc: 'Job Title or Employee' },
                    { id: 'dynamic', label: 'Dynamic', icon: 'M13 10V3L4 14h7v7l9-11h-7z', desc: 'Based on form fields' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateStep(step.id, {
                        approverSource: opt.id as any,
                        approverType: opt.id === 'organogram' ? 'manager' : opt.id === 'manual' ? 'role' : 'dynamic_field',
                        approverValue: '',
                        approverLabel: ''
                      })}
                      className={`relative p-3 rounded-xl border-2 text-left transition-all ${step.approverSource === opt.id
                        ? 'border-primary-500 bg-primary-50/50'
                        : 'border-transparent bg-gray-50 hover:bg-gray-100 hover:border-gray-200'
                        }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${step.approverSource === opt.id ? 'bg-primary-100 text-primary-600' : 'bg-white text-gray-500 shadow-sm'
                        }`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={opt.icon} /></svg>
                      </div>
                      <span className={`block text-xs font-bold ${step.approverSource === opt.id ? 'text-primary-900' : 'text-gray-700'}`}>{opt.label}</span>
                      <span className="block text-[10px] text-gray-500 leading-tight mt-0.5">{opt.desc}</span>
                    </button>
                  ))}
                </div>

                {/* Detailed Config Based on Source */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  {step.approverSource === 'organogram' && (
                    <div className="space-y-4">
                      <div className="flex gap-2 p-1 bg-white rounded-lg border border-gray-200 shadow-sm">
                        {organogramSubOptions.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => updateStep(step.id, { approverType: t.id as any, approverValue: '', approverLabel: '' })}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${step.approverType === t.id ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                              }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {step.approverType === 'manager' && (
                        <select
                          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          value={step.approverValue}
                          onChange={(e) => updateStep(step.id, { approverValue: e.target.value, approverLabel: `Level ${e.target.value} Supervisor` })}
                        >
                          <option value="">Select Level...</option>
                          <option value="1">Direct Manager (Level 1)</option>
                          <option value="2">Manager's Manager (Level 2)</option>
                          <option value="3">Level 3 Manager</option>
                        </select>
                      )}

                      {step.approverType === 'organogram_position' && (
                        <button
                          type="button"
                          onClick={() => setShowPositionPicker(step.id)}
                          className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-primary-400 group transition-all"
                        >
                          <div className="text-left">
                            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Selected Position</span>
                            <span className={`block text-sm font-medium ${step.approverValue ? 'text-primary-700' : 'text-gray-400 italic'}`}>
                              {step.approverLabel || 'Click to select position...'}
                            </span>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-primary-50 group-hover:text-primary-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          </div>
                        </button>
                      )}

                      {step.approverType === 'department_head' && (
                        <select
                          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          value={step.approverValue}
                          onChange={(e) => {
                            const d = departmentHeadOptions.find(opt => opt.departmentId === e.target.value);
                            updateStep(step.id, {
                              approverValue: e.target.value,
                              approverLabel: d ? `${d.departmentName} Head` : ''
                            });
                          }}
                        >
                          <option value="">Select Department...</option>
                          {departmentHeadOptions.map(d => (
                            <option key={d.departmentId} value={d.departmentId}>{d.departmentName} - {d.headName}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {step.approverSource === 'manual' && (
                    <div className="space-y-4">
                      <div className="flex gap-2 p-1 bg-white rounded-lg border border-gray-200 shadow-sm">
                        {[
                          { id: 'role', label: 'Job Title / Role' },
                          { id: 'specific_user', label: 'Specific Person' }
                        ].map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => updateStep(step.id, { approverType: t.id as any, approverValue: '', approverLabel: '' })}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${step.approverType === t.id ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                              }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {step.approverType === 'role' && (
                        <select
                          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          value={step.approverValue}
                          onChange={(e) => updateStep(step.id, { approverValue: e.target.value, approverLabel: e.target.value })}
                        >
                          <option value="">Select Job Title...</option>
                          {uniqueJobTitles.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      )}

                      {step.approverType === 'specific_user' && (
                        <button
                          type="button"
                          onClick={() => setShowEmployeePicker(step.id)}
                          className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-emerald-400 group transition-all"
                        >
                          <div className="text-left">
                            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Selected User</span>
                            <span className={`block text-sm font-medium ${step.approverValue ? 'text-emerald-700' : 'text-gray-400 italic'}`}>
                              {step.approverLabel || 'Click to select person...'}
                            </span>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          </div>
                        </button>
                      )}
                    </div>
                  )}

                  {step.approverSource === 'dynamic' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Form Field Name</label>
                      <input
                        type="text"
                        placeholder="e.g. project_manager_email"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        value={step.approverValue}
                        onChange={(e) => updateStep(step.id, { approverValue: e.target.value, approverLabel: `Field: ${e.target.value}` })}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        The workflow will look for an email address in this field from the request form.
                      </p>
                    </div>
                  )}
                </div>

                {/* Extra Settings */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={step.settings.requireComment}
                      onChange={(e) => updateStep(step.id, { settings: { ...step.settings, requireComment: e.target.checked } })}
                      className="rounded border-gray-300 text-primary-600"
                    />
                    <span className="text-sm text-gray-700">Require Comment</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={step.settings.allowDelegation}
                      onChange={(e) => updateStep(step.id, { settings: { ...step.settings, allowDelegation: e.target.checked } })}
                      className="rounded border-gray-300 text-primary-600"
                    />
                    <span className="text-sm text-gray-700">Allow Delegation</span>
                  </label>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  };

  // Modals
  const renderPositionPicker = () => {
    if (!showPositionPicker) return null;
    const scopeLabel = isWideScope ? ' (All Business Units)' : '';
    return (
      <Modal isOpen={!!showPositionPicker} onClose={() => { setShowPositionPicker(null); setPositionSearch(''); }} title={`Select Position from Organogram${scopeLabel}`} size="lg">
        <div className="space-y-4">
          {isWideScope && (
            <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Showing positions across all business units for {WORKFLOW_CATEGORIES.find(c => c.value === workflowCategory)?.label} scope
            </div>
          )}
          <input
            type="text"
            placeholder="Search by title, employee name, department..."
            className="w-full px-4 py-2 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={positionSearch}
            onChange={(e) => setPositionSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {loadingPositions ? (
              <div className="text-center py-6 text-gray-500">Loading...</div>
            ) : filteredPositions.length === 0 ? (
              <div className="text-center py-6 text-gray-500">No positions found.</div>
            ) : (
              filteredPositions.map(pos => (
                <button
                  key={pos.id}
                  onClick={() => {
                    updateStep(showPositionPicker, {
                      approverValue: pos.position_title,
                      approverLabel: pos.employee
                        ? `${pos.position_title} (${pos.employee.first_name} ${pos.employee.last_name})`
                        : pos.position_title
                    });
                    setShowPositionPicker(null);
                    setPositionSearch('');
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-primary-50 border border-transparent hover:border-primary-100 group transition-all text-left"
                >
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{pos.position_title}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                      {pos.employee ? (
                        <span className="text-primary-600 font-medium">{pos.employee.first_name} {pos.employee.last_name}</span>
                      ) : (
                        <span className="bg-amber-100 text-amber-700 px-1.5 rounded uppercase text-[10px] font-bold">Vacant</span>
                      )}
                      {pos.department && <span>• {pos.department.name}</span>}
                      {isWideScope && pos.business_unit && <span>• {pos.business_unit.name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isWideScope && pos.business_unit && (
                      <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded font-medium whitespace-nowrap">{pos.business_unit.name}</span>
                    )}
                    {pos.grade && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-medium">{pos.grade}</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    );
  };

  const renderEmployeePicker = () => {
    if (!showEmployeePicker) return null;
    const scopeLabel = isWideScope ? ' (All Business Units)' : '';
    return (
      <Modal isOpen={!!showEmployeePicker} onClose={() => { setShowEmployeePicker(null); setEmployeeSearch(''); }} title={`Select Employee${scopeLabel}`} size="lg">
        <div className="space-y-4">
          {isWideScope && (
            <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Showing employees across all business units for {WORKFLOW_CATEGORIES.find(c => c.value === workflowCategory)?.label} scope
            </div>
          )}
          <input
            type="text"
            placeholder="Search by name, email, job title..."
            className="w-full px-4 py-2 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {loadingEmployees ? (
              <div className="text-center py-6 text-gray-500">Loading...</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-6 text-gray-500">No employees found.</div>
            ) : (
              filteredEmployees.map(emp => {
                const empBu = isWideScope ? businessUnits.find(b => b.id === emp.business_unit_id) : null;
                return (
                  <button
                    key={emp.id}
                    onClick={() => {
                      updateStep(showEmployeePicker, {
                        approverValue: emp.email,
                        approverLabel: `${emp.first_name} ${emp.last_name}`
                      });
                      setShowEmployeePicker(null);
                      setEmployeeSearch('');
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-emerald-50 border border-transparent hover:border-emerald-100 group transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs flex-shrink-0">
                      {emp.first_name[0]}{emp.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm">{emp.first_name} {emp.last_name}</div>
                      <div className="text-xs text-gray-500 truncate">{emp.email} • {emp.job_title || 'No Job Title'}</div>
                    </div>
                    {empBu && (
                      <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded font-medium whitespace-nowrap flex-shrink-0">{empBu.name}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Modal>
    );
  };

  if (status === 'loading') return null;
  if (!session) return null;

  return (
    <AppLayout title="Workflow Designer" showBack onBack={() => router.back()} hideNav>
      <div className="min-h-screen bg-gray-50/50 pb-32">
        {/* Header Section */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                  Workflow Designer
                </h1>
                <p className="text-sm text-gray-500 mt-1">Create customized approval flows matching your exact needs</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addStep}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl shadow-lg shadow-gray-200 hover:shadow-xl hover:-translate-y-0.5 transition-all text-sm font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Step
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-6 text-sm font-medium border-b border-gray-100 -mb-4">
              {[
                { id: 'design', label: 'Flow Design' },
                { id: 'settings', label: 'Settings' },
                { id: 'saved', label: 'Template Library' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-4 border-b-2 transition-colors ${activeTab === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-6 py-8">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}
          {successMsg && (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {successMsg}
            </div>
          )}

          {activeTab === 'design' && (
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Left: General Info */}
              <div className="lg:w-1/3 space-y-4">
                <Card className="p-4" title="Workflow Properties">
                  <div className="space-y-4">
                    <Input label="Name" placeholder="e.g. Finance Approval" value={workflowName} onChange={e => setWorkflowName(e.target.value)} />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Workflow Scope</label>
                      <div className="grid grid-cols-1 gap-2">
                        {WORKFLOW_CATEGORIES.map(cat => (
                          <button
                            key={cat.value}
                            onClick={() => { setWorkflowCategory(cat.value); setSteps([]); }}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all border ${workflowCategory === cat.value
                              ? 'bg-white border-primary-500 ring-1 ring-primary-500 shadow-sm'
                              : 'bg-gray-50 border-transparent hover:bg-gray-100'
                              }`}
                          >
                            <span className="text-lg">{cat.icon}</span>
                            <div className="text-left flex-1">
                              <span className="font-medium text-gray-700 block">{cat.label}</span>
                              <span className="text-[10px] text-gray-400 leading-tight block">{cat.description}</span>
                            </div>
                            {workflowCategory === cat.value && <svg className="w-4 h-4 flex-shrink-0 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Auto-generate from Organogram */}
                <Card className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Quick Start
                  </h4>
                  <p className="text-xs text-gray-600 mb-3">
                    {workflowCategory === 'departmental'
                      ? 'Auto-generate steps from your department hierarchy (HOD down to lowest level).'
                      : workflowCategory === 'multi_departmental' || workflowCategory === 'business_unit'
                        ? 'Auto-generate steps from all positions in your business unit.'
                        : 'Auto-generate steps from the full organization organogram.'}
                  </p>
                  <button
                    type="button"
                    onClick={autoGenerateFromOrganogram}
                    disabled={loadingPositions}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all text-sm font-medium shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    {loadingPositions ? 'Loading...' : 'Generate from Organogram'}
                  </button>
                  {steps.length > 0 && (
                    <p className="text-[10px] text-indigo-600 mt-2 text-center font-medium">
                      This will replace your current {steps.length} step{steps.length > 1 ? 's' : ''}
                    </p>
                  )}
                </Card>

                {/* Organogram Status */}
                <Card className="p-4 bg-gray-50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-2 h-2 rounded-full ${hrimsDetected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <h4 className="text-sm font-semibold text-gray-900">HRIMS Connection</h4>
                  </div>
                  {hrimsDetected ? (
                    <div className="text-xs text-gray-600">
                      <p>Connected as <span className="font-medium text-gray-900">{hrimsProfile?.first_name} {hrimsProfile?.last_name}</span></p>
                      <p className="mt-1">{hrimsProfile?.job_title} • {hrimsBusinessUnit?.name}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-amber-700">Not connected to your profile automatically.</p>
                      <select
                        className="w-full text-xs p-2 rounded border"
                        value={selectedBusinessUnit}
                        onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                      >
                        <option value="">Select Business Unit...</option>
                        {businessUnits.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  )}
                </Card>
              </div>

              {/* Right: Steps Timeline */}
              <div className="lg:w-2/3">
                <div className="flex items-center gap-2 mb-6">
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600">Start</span>
                  <div className="h-0.5 flex-1 bg-gray-200" />
                  <span className="text-xs text-gray-400 font-medium">Requester Submits</span>
                </div>

                {steps.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                    <div className="w-16 h-16 mx-auto bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Start your flow</h3>
                    <p className="text-gray-500 mb-6">Add the first approval step to begin</p>
                    <Button onClick={addStep} variant="primary">Add Approval Step</Button>
                  </div>
                ) : (
                  <div className="mb-8">
                    {steps.map((step, i) => renderStepCard(step, i))}
                  </div>
                )}

                {steps.length > 0 && (
                  <div className="flex items-center gap-2 mt-6">
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">End</span>
                    <div className="h-0.5 flex-1 bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium">Request Approved</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Configuration</h3>
                <div className="space-y-4">
                  <label className="flex items-start justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-100 hover:border-gray-200 transition-all cursor-pointer">
                    <div>
                      <div className="font-medium text-gray-900">Allow Parallel Approvals</div>
                      <div className="text-xs text-gray-500 mt-0.5">Enable multiple approvers to approve simultaneously in a single step</div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={workflowSettings.allowParallelApprovals} onChange={(e) => setWorkflowSettings({ ...workflowSettings, allowParallelApprovals: e.target.checked })} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </div>
                  </label>

                  <label className="flex items-start justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-100 hover:border-gray-200 transition-all cursor-pointer">
                    <div>
                      <div className="font-medium text-gray-900">Requester Notifications</div>
                      <div className="text-xs text-gray-500 mt-0.5">Notify the requester via email when each step is completed</div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={workflowSettings.notifyRequesterOnEachStep} onChange={(e) => setWorkflowSettings({ ...workflowSettings, notifyRequesterOnEachStep: e.target.checked })} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </div>
                  </label>

                  <label className="flex items-start justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-100 hover:border-gray-200 transition-all cursor-pointer">
                    <div>
                      <div className="font-medium text-gray-900">Allow Withdrawal</div>
                      <div className="text-xs text-gray-500 mt-0.5">Requester can withdraw the request before final approval</div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={workflowSettings.allowWithdraw} onChange={(e) => setWorkflowSettings({ ...workflowSettings, allowWithdraw: e.target.checked })} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </div>
                  </label>

                  <label className="flex items-start justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-100 hover:border-gray-200 transition-all cursor-pointer">
                    <div>
                      <div className="font-medium text-gray-900">Require Attachments</div>
                      <div className="text-xs text-gray-500 mt-0.5">Force requesters to upload supporting documents</div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={workflowSettings.requireAttachments} onChange={(e) => setWorkflowSettings({ ...workflowSettings, requireAttachments: e.target.checked })} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </div>
                  </label>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">SLA & Expiration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Request Expiration (Days)</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      value={workflowSettings.expirationDays}
                      onChange={(e) => setWorkflowSettings({ ...workflowSettings, expirationDays: parseInt(e.target.value) || 30 })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Requests pending longer than this will be processed</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Action on Expiration</label>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      {['notify', 'escalate', 'reject'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => setWorkflowSettings({ ...workflowSettings, onExpiration: opt as any })}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${workflowSettings.onExpiration === opt ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'saved' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedWorkflows.map(wf => (
                <Card key={wf.id} className="cursor-pointer hover:border-primary-400 hover:shadow-md transition-all group" onClick={() => loadWorkflow(wf)}>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-primary-50 text-2xl group-hover:text-primary-600 transition-colors">
                        {WORKFLOW_CATEGORIES.find(c => c.value === wf.category)?.icon || '📝'}
                      </div>
                      {wf.is_active && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] uppercase font-bold rounded-full">Active</span>}
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1">{wf.name}</h3>
                    {wf.category && (
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium mb-1 ${WORKFLOW_CATEGORIES.find(c => c.value === wf.category)?.color || 'bg-gray-100 text-gray-600'}`}>
                        {WORKFLOW_CATEGORIES.find(c => c.value === wf.category)?.label || wf.category}
                      </span>
                    )}
                    <p className="text-sm text-gray-500 line-clamp-2 min-h-[40px]">{wf.description || 'No description'}</p>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                      <span>{wf.steps?.length || 0} steps</span>
                      <span>{new Date(wf.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </Card>
              ))}
              {savedWorkflows.length === 0 && !loadingSaved && (
                <div className="col-span-full text-center py-12 text-gray-500">No saved workflows found.</div>
              )}
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 lg:pl-72 flex justify-end gap-3 z-30">
          <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={loading} disabled={!workflowName || steps.length === 0}>
            {editingWorkflowId ? 'Update Design' : 'Save Design'}
          </Button>
        </div>

        {renderPositionPicker()}
        {renderEmployeePicker()}
      </div>
    </AppLayout>
  );
}
