import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
    startWorkflowExecution,
    continueWorkflowAfterApproval,
    WorkflowDefinition,
    ExecutionContext,
    StepExecutionResult
} from '@/lib/workflowExecutor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        if (!supabaseAdmin) {
            return res.status(500).json({ error: 'Database configuration missing' });
        }

        const session = await getServerSession(req, res, authOptions);

        if (!session?.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = session.user as any;
        const { action, workflowId, requestId, requestData, stepIndex, approved } = req.body || {};

        if (!action) {
            return res.status(400).json({ error: 'Action is required (start, continue, or resume)' });
        }

        // Fetch the workflow definition
        if (!workflowId) {
            return res.status(400).json({ error: 'Workflow ID is required' });
        }

        const { data: workflowData, error: workflowError } = await supabaseAdmin
            .from('workflows')
            .select('*')
            .eq('id', workflowId)
            .single();

        if (workflowError || !workflowData) {
            return res.status(404).json({ error: 'Workflow not found', details: workflowError?.message });
        }

        const workflow: WorkflowDefinition = {
            id: workflowData.id,
            name: workflowData.name,
            description: workflowData.description,
            steps: workflowData.steps || [],
            settings: workflowData.settings || {},
        };

        let results: StepExecutionResult[];

        switch (action) {
            case 'start':
                // Start a new workflow execution
                if (!requestId) {
                    return res.status(400).json({ error: 'Request ID is required to start workflow' });
                }

                results = await startWorkflowExecution(
                    workflow,
                    requestId,
                    requestData || {},
                    user.id,
                    user.org_id || ''
                );

                // Log the execution start
                await logWorkflowExecution(workflowId, requestId, 'started', results);
                break;

            case 'continue':
                // Continue workflow after approval
                if (stepIndex === undefined || approved === undefined) {
                    return res.status(400).json({ error: 'Step index and approval status required' });
                }

                const context: ExecutionContext = {
                    requestId: requestId || '',
                    requestData: requestData || {},
                    userId: user.id,
                    organizationId: user.org_id || '',
                    currentStepIndex: stepIndex,
                    previousResults: req.body.previousResults || {},
                };

                results = await continueWorkflowAfterApproval(workflow, context, approved);

                // Log the continuation
                await logWorkflowExecution(workflowId, requestId, approved ? 'approved' : 'rejected', results);
                break;

            case 'status':
                // Get workflow execution status
                const { data: executions, error: execError } = await supabaseAdmin
                    .from('workflow_executions')
                    .select('*')
                    .eq('workflow_id', workflowId)
                    .eq('request_id', requestId)
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (execError) {
                    return res.status(500).json({ error: 'Failed to fetch execution status', details: execError.message });
                }

                return res.status(200).json({ executions });

            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }

        return res.status(200).json({
            success: true,
            results,
            message: `Workflow ${action} completed`,
        });

    } catch (err) {
        console.error('Workflow execution error:', err);
        return res.status(500).json({
            error: 'Internal server error',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}

/**
 * Log workflow execution to database
 */
async function logWorkflowExecution(
    workflowId: string,
    requestId: string,
    action: string,
    results: StepExecutionResult[]
) {
    if (!supabaseAdmin) return;

    try {
        // Try to insert into workflow_executions table
        // If the table doesn't exist, this will fail silently
        await supabaseAdmin
            .from('workflow_executions')
            .insert({
                workflow_id: workflowId,
                request_id: requestId,
                action,
                results: results,
                created_at: new Date().toISOString(),
            });
    } catch (err) {
        // Log but don't fail - execution logging is optional
        console.warn('Failed to log workflow execution (table may not exist):', err);
    }
}
