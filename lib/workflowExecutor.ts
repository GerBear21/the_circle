/**
 * Workflow Execution Service
 * 
 * This service handles the execution of workflow steps including:
 * - Approval steps (managed by the approval system)
 * - Integration steps (n8n, Teams, Slack, Outlook, Webhook)
 */

import { triggerN8nWorkflow } from './n8n';

// Types matching the workflow builder
export interface WorkflowStep {
    id: string;
    name: string;
    type: 'approval' | 'integration';
    order: number;

    // Approval specific
    approverType?: string;
    approverValue?: string;
    isParallel?: boolean;
    parallelWith?: string;
    autoApprove?: {
        enabled: boolean;
        condition: string;
        value: string;
    };
    allowDelegation?: boolean;
    requireComment?: boolean;
    escalation?: {
        enabled: boolean;
        hours: number;
        escalateTo: string;
        reminder: boolean;
        reminderHours: number;
    };
    notifications?: {
        onAssignment: boolean;
        onApproval: boolean;
        onRejection: boolean;
        onEscalation: boolean;
        channels: string[];
    };

    // Integration specific
    integration?: {
        provider: 'teams' | 'slack' | 'outlook' | 'n8n' | 'webhook';
        action: string;
        config: Record<string, any>;
    };

    // Common
    conditions: Array<{
        id: string;
        field: string;
        operator: string;
        value: string;
        value2?: string;
    }>;
}

export interface WorkflowDefinition {
    id: string;
    name: string;
    description?: string;
    steps: WorkflowStep[];
    settings: {
        allowParallelApprovals: boolean;
        requireAllParallel: boolean;
        allowSkipSteps: boolean;
        allowReassignment: boolean;
        expirationDays: number;
        onExpiration: string;
        notifyRequesterOnEachStep: boolean;
        allowWithdraw: boolean;
        requireAttachments: boolean;
    };
}

export interface ExecutionContext {
    requestId: string;
    requestData: Record<string, any>;
    userId: string;
    organizationId: string;
    currentStepIndex: number;
    previousResults: Record<string, any>;
}

export interface StepExecutionResult {
    success: boolean;
    stepId: string;
    stepType: 'approval' | 'integration';
    provider?: string;
    message?: string;
    data?: any;
    error?: string;
    requiresUserAction?: boolean; // For approval steps
    nextStepIndex?: number;
}

/**
 * Evaluate conditions for a step
 */
export function evaluateConditions(
    conditions: WorkflowStep['conditions'],
    requestData: Record<string, any>
): boolean {
    if (!conditions || conditions.length === 0) {
        return true; // No conditions means step should execute
    }

    return conditions.every(condition => {
        const fieldValue = requestData[condition.field];
        const targetValue = condition.value;
        const targetValue2 = condition.value2;

        switch (condition.operator) {
            case 'equals':
                return String(fieldValue) === String(targetValue);
            case 'not_equals':
                return String(fieldValue) !== String(targetValue);
            case 'greater_than':
                return Number(fieldValue) > Number(targetValue);
            case 'less_than':
                return Number(fieldValue) < Number(targetValue);
            case 'contains':
                return String(fieldValue).toLowerCase().includes(String(targetValue).toLowerCase());
            case 'between':
                const num = Number(fieldValue);
                return num >= Number(targetValue) && num <= Number(targetValue2 || targetValue);
            default:
                return true;
        }
    });
}

/**
 * Execute an integration step
 */
export async function executeIntegrationStep(
    step: WorkflowStep,
    context: ExecutionContext
): Promise<StepExecutionResult> {
    const { integration } = step;

    if (!integration) {
        return {
            success: false,
            stepId: step.id,
            stepType: 'integration',
            error: 'No integration configuration found',
        };
    }

    try {
        let result: any;

        switch (integration.provider) {
            case 'n8n':
                result = await executeN8nStep(integration, context);
                break;
            case 'webhook':
                result = await executeWebhookStep(integration, context);
                break;
            case 'teams':
                result = await executeTeamsStep(integration, context);
                break;
            case 'slack':
                result = await executeSlackStep(integration, context);
                break;
            case 'outlook':
                result = await executeOutlookStep(integration, context);
                break;
            default:
                return {
                    success: false,
                    stepId: step.id,
                    stepType: 'integration',
                    provider: integration.provider,
                    error: `Unknown integration provider: ${integration.provider}`,
                };
        }

        return {
            success: true,
            stepId: step.id,
            stepType: 'integration',
            provider: integration.provider,
            message: `${integration.provider} integration executed successfully`,
            data: result,
        };
    } catch (error) {
        console.error(`Error executing ${integration.provider} integration:`, error);
        return {
            success: false,
            stepId: step.id,
            stepType: 'integration',
            provider: integration.provider,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Execute n8n workflow step
 */
async function executeN8nStep(
    integration: NonNullable<WorkflowStep['integration']>,
    context: ExecutionContext
): Promise<any> {
    const webhookSlug = integration.config.workflowId;

    if (!webhookSlug) {
        throw new Error('n8n workflow ID/webhook slug is required');
    }

    // Build the payload to send to n8n
    const payload = {
        // Include the raw payload if specified
        ...(integration.config.payload ? tryParseJSON(integration.config.payload) : {}),
        // Always include context data
        _context: {
            requestId: context.requestId,
            userId: context.userId,
            organizationId: context.organizationId,
            stepIndex: context.currentStepIndex,
            timestamp: new Date().toISOString(),
        },
        // Include request data
        requestData: context.requestData,
        // Include previous step results
        previousResults: context.previousResults,
    };

    return await triggerN8nWorkflow(webhookSlug, 'POST', payload);
}

/**
 * Execute generic webhook step
 */
async function executeWebhookStep(
    integration: NonNullable<WorkflowStep['integration']>,
    context: ExecutionContext
): Promise<any> {
    const url = integration.config.target;

    if (!url) {
        throw new Error('Webhook URL is required');
    }

    const payload = {
        ...(integration.config.payload ? tryParseJSON(integration.config.payload) : {}),
        requestId: context.requestId,
        requestData: context.requestData,
        timestamp: new Date().toISOString(),
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
    }

    const text = await response.text();
    return tryParseJSON(text) || text;
}

/**
 * Execute Microsoft Teams step
 */
async function executeTeamsStep(
    integration: NonNullable<WorkflowStep['integration']>,
    context: ExecutionContext
): Promise<any> {
    const webhookUrl = integration.config.target;

    if (!webhookUrl) {
        throw new Error('Teams webhook URL is required');
    }

    // Format message for Teams Adaptive Card or simple message
    const message = integration.config.payload || `New request #${context.requestId} requires attention`;

    // Teams incoming webhook expects specific format
    const teamsPayload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "0076D7",
        "summary": `Request #${context.requestId}`,
        "sections": [{
            "activityTitle": `Request Update`,
            "facts": [
                { "name": "Request ID", "value": context.requestId },
                { "name": "Status", "value": "Workflow Step Triggered" },
            ],
            "text": message,
            "markdown": true
        }]
    };

    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamsPayload),
    });

    if (!response.ok) {
        throw new Error(`Teams webhook failed with status ${response.status}`);
    }

    return { sent: true };
}

/**
 * Execute Slack step
 */
async function executeSlackStep(
    integration: NonNullable<WorkflowStep['integration']>,
    context: ExecutionContext
): Promise<any> {
    const webhookUrl = integration.config.target;

    if (!webhookUrl) {
        throw new Error('Slack webhook URL is required');
    }

    const message = integration.config.payload || `New request #${context.requestId} requires attention`;

    // Slack incoming webhook format
    const slackPayload = {
        text: message,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Request Update*\nRequest ID: \`${context.requestId}\`\n${message}`
                }
            }
        ]
    };

    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackPayload),
    });

    if (!response.ok) {
        throw new Error(`Slack webhook failed with status ${response.status}`);
    }

    return { sent: true };
}

/**
 * Execute Outlook step (via Microsoft Graph API or Webhook)
 */
async function executeOutlookStep(
    integration: NonNullable<WorkflowStep['integration']>,
    context: ExecutionContext
): Promise<any> {
    // For now, this is a placeholder - full implementation would require
    // Microsoft Graph API authentication and setup
    // This could also trigger an n8n workflow that handles Outlook

    console.log('Outlook integration triggered:', {
        action: integration.action,
        target: integration.config.target,
        requestId: context.requestId,
    });

    // Return pending - actual email would be sent via Graph API or n8n
    return {
        queued: true,
        message: 'Outlook action queued. Configure Microsoft Graph API for full functionality.',
        action: integration.action,
        target: integration.config.target,
    };
}

/**
 * Process the next step(s) in a workflow
 */
export async function processWorkflowStep(
    workflow: WorkflowDefinition,
    context: ExecutionContext
): Promise<StepExecutionResult[]> {
    const results: StepExecutionResult[] = [];
    const { steps } = workflow;

    if (context.currentStepIndex >= steps.length) {
        return [{
            success: true,
            stepId: 'workflow_complete',
            stepType: 'approval',
            message: 'Workflow completed - no more steps',
        }];
    }

    const currentStep = steps[context.currentStepIndex];

    // Check if conditions are met
    if (!evaluateConditions(currentStep.conditions, context.requestData)) {
        // Skip this step and move to next
        return await processWorkflowStep(workflow, {
            ...context,
            currentStepIndex: context.currentStepIndex + 1,
        });
    }

    if (currentStep.type === 'integration') {
        // Execute integration step immediately
        const result = await executeIntegrationStep(currentStep, context);
        results.push(result);

        if (result.success) {
            // Store result and move to next step
            context.previousResults[currentStep.id] = result.data;

            // Automatically process next step
            const nextResults = await processWorkflowStep(workflow, {
                ...context,
                currentStepIndex: context.currentStepIndex + 1,
                previousResults: context.previousResults,
            });
            results.push(...nextResults);
        }
    } else if (currentStep.type === 'approval') {
        // Approval steps pause the workflow and wait for user action
        results.push({
            success: true,
            stepId: currentStep.id,
            stepType: 'approval',
            message: 'Approval step pending user action',
            requiresUserAction: true,
            nextStepIndex: context.currentStepIndex,
        });
    }

    return results;
}

/**
 * Helper to safely parse JSON
 */
function tryParseJSON(str: string): Record<string, any> | null {
    try {
        return JSON.parse(str);
    } catch {
        return null;
    }
}

/**
 * Start workflow execution for a request
 */
export async function startWorkflowExecution(
    workflow: WorkflowDefinition,
    requestId: string,
    requestData: Record<string, any>,
    userId: string,
    organizationId: string
): Promise<StepExecutionResult[]> {
    const context: ExecutionContext = {
        requestId,
        requestData,
        userId,
        organizationId,
        currentStepIndex: 0,
        previousResults: {},
    };

    return await processWorkflowStep(workflow, context);
}

/**
 * Continue workflow after an approval step is completed
 */
export async function continueWorkflowAfterApproval(
    workflow: WorkflowDefinition,
    context: ExecutionContext,
    approved: boolean
): Promise<StepExecutionResult[]> {
    if (!approved) {
        return [{
            success: false,
            stepId: 'workflow_rejected',
            stepType: 'approval',
            message: 'Workflow rejected at approval step',
        }];
    }

    // Move to next step after approval
    return await processWorkflowStep(workflow, {
        ...context,
        currentStepIndex: context.currentStepIndex + 1,
    });
}
