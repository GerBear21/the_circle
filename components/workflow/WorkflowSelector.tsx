import { useEffect, useState } from 'react';
import { useWorkflows } from '@/hooks/useWorkflows';

interface WorkflowSelectorProps {
    value: string;
    onChange: (workflowId: string) => void;
    label?: string;
    className?: string;
    showDescription?: boolean;
    required?: boolean;
}

interface Workflow {
    id: string;
    name: string;
    description?: string;
    steps: any[];
}

/**
 * Workflow Selector Component
 * 
 * A dropdown component for selecting a workflow to associate with a request.
 * Fetches available workflows from the API automatically.
 */
export function WorkflowSelector({
    value,
    onChange,
    label = 'Approval Workflow',
    className = '',
    showDescription = true,
    required = false,
}: WorkflowSelectorProps) {
    const { workflows, isLoading, error } = useWorkflows();
    const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

    // Update selected workflow details when value changes
    useEffect(() => {
        if (value && workflows.length > 0) {
            const found = workflows.find(w => w.id === value);
            setSelectedWorkflow(found || null);
        } else {
            setSelectedWorkflow(null);
        }
    }, [value, workflows]);

    if (error) {
        return (
            <div className={`${className}`}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                </label>
                <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl text-sm text-danger-600">
                    Failed to load workflows. Please refresh the page.
                </div>
            </div>
        );
    }

    return (
        <div className={`${className}`}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}
                {required && <span className="text-danger-500 ml-1">*</span>}
            </label>

            <div className="relative">
                <select
                    className="w-full px-4 py-2.5 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={isLoading}
                    required={required}
                >
                    <option value="">
                        {isLoading ? 'Loading workflows...' : 'Select a workflow (optional)'}
                    </option>
                    {workflows.map((workflow) => (
                        <option key={workflow.id} value={workflow.id}>
                            {workflow.name} ({workflow.steps?.length || 0} steps)
                        </option>
                    ))}
                </select>

                {/* Custom dropdown arrow */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {isLoading ? (
                        <svg className="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    )}
                </div>
            </div>

            {/* Selected workflow info */}
            {showDescription && selectedWorkflow && (
                <div className="mt-2 p-3 bg-primary-50/50 border border-primary-100 rounded-lg">
                    <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-primary-700">{selectedWorkflow.name}</p>
                            {selectedWorkflow.description && (
                                <p className="text-xs text-primary-600/70 mt-0.5 line-clamp-2">
                                    {selectedWorkflow.description}
                                </p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-xs text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">
                                    {selectedWorkflow.steps?.filter((s: any) => s.type === 'approval').length || 0} approval steps
                                </span>
                                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                    {selectedWorkflow.steps?.filter((s: any) => s.type === 'integration').length || 0} integrations
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hint text when no workflow selected */}
            {!value && !isLoading && workflows.length > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">
                    Select a workflow to define the approval process for this request.
                </p>
            )}

            {/* No workflows available */}
            {!isLoading && workflows.length === 0 && (
                <p className="text-xs text-gray-400 mt-1.5">
                    No workflows available.{' '}
                    <a href="/requests/new/workflow" className="text-primary-500 hover:underline">
                        Create one
                    </a>
                </p>
            )}
        </div>
    );
}

export default WorkflowSelector;
