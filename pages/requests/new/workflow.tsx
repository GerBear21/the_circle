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

export default function CustomizeWorkflowPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [steps, setSteps] = useState<ApprovalStep[]>([]);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'steps' | 'settings' | 'rules'>('steps');
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
    if (!workflowName || steps.length === 0) {
      setError('Workflow name and at least one approval step are required');
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
          name: workflowName,
          description: workflowDescription,
          formFields: [],
          workflowSteps: steps,
          workflowSettings: workflowSettings,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create workflow');
      }

      router.push('/admin/document-templates');
    } catch (err: any) {
      setError(err.message || 'Failed to create workflow');
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

  if (status === 'loading') {
    return (
      <AppLayout title="Customize Workflow" showBack onBack={() => router.back()}>
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
                    <option value="request_type">Request Type</option>
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
        <div className="p-4 bg-primary-50/50 rounded-xl border border-primary-100">
          <label className="flex items-center gap-3 mb-3">
            <input
              type="checkbox"
              checked={workflowSettings.allowParallelApprovals}
              onChange={(e) => setWorkflowSettings({ ...workflowSettings, allowParallelApprovals: e.target.checked })}
              className="rounded border-gray-300 text-primary-500 focus:ring-primary-500 w-5 h-5"
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
                  className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
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

  const renderBusinessRules = () => (
    <Card className="mb-4">
      <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        Business Rules
      </h3>
      <p className="text-sm text-gray-500 mb-4">Define rules that automatically route requests based on conditions</p>

      <div className="space-y-3">
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-700">Amount-based Routing</span>
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">Active</span>
          </div>
          <p className="text-xs text-gray-500">Requests over $10,000 require Director approval</p>
        </div>

        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-700">Department Override</span>
            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Inactive</span>
          </div>
          <p className="text-xs text-gray-500">Finance department requests skip manager approval</p>
        </div>

        <button
          type="button"
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/30 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Business Rule
        </button>
      </div>
    </Card>
  );

  return (
    <AppLayout title="Customize Workflow" showBack onBack={() => router.back()} hideNav>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-28">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-text-primary font-heading flex items-center gap-2">
            <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Customize Approval Workflow
          </h1>
          <p className="text-sm text-text-secondary mt-1">Configure approval steps, conditions, escalations, and business rules</p>
        </div>

        {error && (
          <Card className="mb-4 bg-danger-50 border-danger-200">
            <p className="text-danger-600 text-sm">{error}</p>
          </Card>
        )}

        <Card className="mb-4">
          <div className="space-y-4">
            <Input
              label="Workflow Name"
              placeholder="e.g., Standard Purchase Approval"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                className="w-full px-4 py-3 min-h-[80px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                placeholder="Describe when this workflow should be used..."
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4">
          {[
            { id: 'steps', label: 'Approval Steps', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
            { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
            { id: 'rules', label: 'Business Rules', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
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
        {activeTab === 'rules' && renderBusinessRules()}

        {activeTab === 'steps' && (
          <>
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
                  {steps.map((step, index) => (
                    <Card key={step.id} variant="outlined" className={`relative transition-all ${expandedStep === step.id ? 'ring-2 ring-primary-200' : ''}`}>
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveStep(step.id, 'up')}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${step.isParallel ? 'bg-primary-100' : 'bg-primary-100'}`}>
                            <span className="text-sm font-bold text-primary-600">{step.order}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => moveStep(step.id, 'down')}
                            disabled={index === steps.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
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
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
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
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/30 transition-colors flex items-center justify-center gap-2"
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
              className="flex-1 !bg-primary-600 hover:!bg-primary-700"
              disabled={!workflowName || steps.length === 0 || loading}
              onClick={handleSubmit}
              isLoading={loading}
            >
              Save Workflow
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
