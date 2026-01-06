import { useState, useCallback } from 'react';
import { StepExecutionResult } from '@/lib/workflowExecutor';

interface UseWorkflowExecutionOptions {
    onSuccess?: (results: StepExecutionResult[]) => void;
    onError?: (error: string) => void;
}

interface WorkflowExecutionState {
    isLoading: boolean;
    error: string | null;
    results: StepExecutionResult[] | null;
}

interface ExecuteOptions {
    workflowId: string;
    requestId: string;
    requestData?: Record<string, any>;
}

interface ContinueOptions {
    workflowId: string;
    requestId: string;
    stepIndex: number;
    approved: boolean;
    requestData?: Record<string, any>;
    previousResults?: Record<string, any>;
}

/**
 * React hook for executing workflows
 */
export function useWorkflowExecution(options: UseWorkflowExecutionOptions = {}) {
    const [state, setState] = useState<WorkflowExecutionState>({
        isLoading: false,
        error: null,
        results: null,
    });

    /**
     * Start a new workflow execution
     */
    const startWorkflow = useCallback(async (executeOptions: ExecuteOptions) => {
        setState({ isLoading: true, error: null, results: null });

        try {
            const response = await fetch('/api/workflows/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    workflowId: executeOptions.workflowId,
                    requestId: executeOptions.requestId,
                    requestData: executeOptions.requestData || {},
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start workflow');
            }

            setState({ isLoading: false, error: null, results: data.results });
            options.onSuccess?.(data.results);
            return data.results;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setState({ isLoading: false, error: errorMessage, results: null });
            options.onError?.(errorMessage);
            throw err;
        }
    }, [options]);

    /**
     * Continue workflow after an approval step
     */
    const continueWorkflow = useCallback(async (continueOptions: ContinueOptions) => {
        setState({ isLoading: true, error: null, results: null });

        try {
            const response = await fetch('/api/workflows/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'continue',
                    workflowId: continueOptions.workflowId,
                    requestId: continueOptions.requestId,
                    stepIndex: continueOptions.stepIndex,
                    approved: continueOptions.approved,
                    requestData: continueOptions.requestData || {},
                    previousResults: continueOptions.previousResults || {},
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to continue workflow');
            }

            setState({ isLoading: false, error: null, results: data.results });
            options.onSuccess?.(data.results);
            return data.results;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setState({ isLoading: false, error: errorMessage, results: null });
            options.onError?.(errorMessage);
            throw err;
        }
    }, [options]);

    /**
     * Get workflow execution status
     */
    const getStatus = useCallback(async (workflowId: string, requestId: string) => {
        try {
            const response = await fetch('/api/workflows/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'status',
                    workflowId,
                    requestId,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get workflow status');
            }

            return data.executions;
        } catch (err) {
            console.error('Error getting workflow status:', err);
            throw err;
        }
    }, []);

    /**
     * Reset state
     */
    const reset = useCallback(() => {
        setState({ isLoading: false, error: null, results: null });
    }, []);

    return {
        ...state,
        startWorkflow,
        continueWorkflow,
        getStatus,
        reset,
    };
}

/**
 * Check if all integration steps completed successfully
 */
export function allIntegrationsSucceeded(results: StepExecutionResult[]): boolean {
    return results
        .filter(r => r.stepType === 'integration')
        .every(r => r.success);
}

/**
 * Get the next pending approval step
 */
export function getNextApprovalStep(results: StepExecutionResult[]): StepExecutionResult | null {
    return results.find(r => r.stepType === 'approval' && r.requiresUserAction) || null;
}

/**
 * Check if workflow is complete
 */
export function isWorkflowComplete(results: StepExecutionResult[]): boolean {
    return results.some(r => r.stepId === 'workflow_complete');
}

/**
 * Check if workflow was rejected
 */
export function isWorkflowRejected(results: StepExecutionResult[]): boolean {
    return results.some(r => r.stepId === 'workflow_rejected');
}
