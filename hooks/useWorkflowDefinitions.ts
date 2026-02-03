import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export interface WorkflowStepDefinition {
  id: string;
  name: string;
  order: number;
  type: 'approval' | 'notification' | 'integration' | 'condition';
  approverType: 'specific_user' | 'role' | 'department_head' | 'manager' | 'dynamic_field';
  approverValue?: string;
  conditions?: StepCondition[];
  settings?: {
    requireComment?: boolean;
    allowDelegation?: boolean;
    autoApprove?: {
      enabled: boolean;
      condition: string;
      value: string;
    };
    escalation?: {
      enabled: boolean;
      hours: number;
      escalateTo?: string;
    };
    notifications?: {
      onAssignment: boolean;
      onApproval: boolean;
      onRejection: boolean;
    };
  };
  isParallel?: boolean;
  parallelGroup?: string;
}

export interface StepCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'between' | 'in';
  value: string | number;
  value2?: string | number;
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'file' | 'currency';
  required: boolean;
  options?: { label: string; value: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface WorkflowSettings {
  allowParallelApprovals: boolean;
  requireAllParallel: boolean;
  allowSkipSteps: boolean;
  allowReassignment: boolean;
  expirationDays: number;
  onExpiration: 'escalate' | 'auto_approve' | 'auto_reject' | 'notify';
  notifyRequesterOnEachStep: boolean;
  allowWithdraw: boolean;
  requireAttachments: boolean;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  category?: string;
  form_schema: FormField[];
  steps: WorkflowStepDefinition[];
  settings: WorkflowSettings;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    display_name: string;
    email: string;
  };
}

export function useWorkflowDefinitions(options?: { category?: string; activeOnly?: boolean }) {
  const { data: session, status: sessionStatus } = useSession();
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDefinitions = useCallback(async () => {
    if (sessionStatus === 'loading') return;
    
    if (!session?.user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (options?.category) params.append('category', options.category);
      if (options?.activeOnly !== false) params.append('active_only', 'true');
      
      const url = `/api/workflow-definitions${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch workflow definitions');
      }

      const data = await response.json();
      setDefinitions(data.definitions || []);
    } catch (err) {
      console.error('Error fetching workflow definitions:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [session?.user, sessionStatus, options?.category, options?.activeOnly]);

  useEffect(() => {
    fetchDefinitions();
  }, [fetchDefinitions]);

  const createDefinition = async (definition: {
    name: string;
    description?: string;
    category?: string;
    formSchema?: FormField[];
    steps: Omit<WorkflowStepDefinition, 'id' | 'order'>[];
    settings?: Partial<WorkflowSettings>;
  }) => {
    const response = await fetch('/api/workflow-definitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(definition),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create workflow definition');
    }

    const data = await response.json();
    await fetchDefinitions();
    return data.definition;
  };

  const updateDefinition = async (id: string, updates: Partial<WorkflowDefinition>) => {
    const response = await fetch(`/api/workflow-definitions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update workflow definition');
    }

    const data = await response.json();
    await fetchDefinitions();
    return data.definition;
  };

  const deleteDefinition = async (id: string) => {
    const response = await fetch(`/api/workflow-definitions/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete workflow definition');
    }

    await fetchDefinitions();
  };

  const createRequestFromWorkflow = async (
    workflowDefinitionId: string,
    title: string,
    description: string | null,
    formData: Record<string, any>,
    submitImmediately = false
  ) => {
    const response = await fetch('/api/requests/from-workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowDefinitionId,
        title,
        description,
        formData,
        submitImmediately,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create request');
    }

    return response.json();
  };

  return {
    definitions,
    loading: loading || sessionStatus === 'loading',
    error,
    refetch: fetchDefinitions,
    createDefinition,
    updateDefinition,
    deleteDefinition,
    createRequestFromWorkflow,
  };
}

export function useWorkflowDefinition(id: string | null) {
  const { data: session, status: sessionStatus } = useSession();
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (sessionStatus === 'loading' || !id) {
      setLoading(false);
      return;
    }

    if (!session?.user) {
      setLoading(false);
      return;
    }

    const fetchDefinition = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/workflow-definitions/${id}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch workflow definition');
        }

        const data = await response.json();
        setDefinition(data.definition);
      } catch (err) {
        console.error('Error fetching workflow definition:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchDefinition();
  }, [id, session?.user, sessionStatus]);

  return { definition, loading, error };
}
