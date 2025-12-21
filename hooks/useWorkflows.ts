import { useState, useEffect, useCallback } from 'react';

interface Workflow {
    id: string;
    name: string;
    description?: string;
    steps: any[];
    settings: any;
    created_at?: string;
}

interface UseWorkflowsOptions {
    autoFetch?: boolean;
}

/**
 * React hook for fetching and managing workflows
 */
export function useWorkflows(options: UseWorkflowsOptions = { autoFetch: true }) {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchWorkflows = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/workflows/list');

            if (!response.ok) {
                throw new Error('Failed to fetch workflows');
            }

            const data = await response.json();
            setWorkflows(data.workflows || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load workflows');
            console.error('Error fetching workflows:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (options.autoFetch) {
            fetchWorkflows();
        }
    }, [options.autoFetch, fetchWorkflows]);

    return {
        workflows,
        isLoading,
        error,
        refetch: fetchWorkflows,
    };
}

/**
 * Get a single workflow by ID
 */
export async function getWorkflowById(workflowId: string): Promise<Workflow | null> {
    try {
        const response = await fetch(`/api/workflows/${workflowId}`);

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (err) {
        console.error('Error fetching workflow:', err);
        return null;
    }
}
