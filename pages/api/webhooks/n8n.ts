import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * n8n Webhook Callback Handler
 * 
 * This endpoint allows n8n workflows to send data back to The Circle.
 * Use this in your n8n workflows with an HTTP Request node pointing to:
 * POST /api/webhooks/n8n
 * 
 * Expected payload:
 * {
 *   "event": "workflow_complete" | "step_complete" | "error" | "custom",
 *   "requestId": "uuid",
 *   "workflowSlug": "your-workflow-name",
 *   "data": { ... any data ... },
 *   "secret": "optional-shared-secret-for-verification"
 * }
 */

interface N8nWebhookPayload {
    event: 'workflow_complete' | 'step_complete' | 'error' | 'custom';
    requestId?: string;
    workflowSlug?: string;
    data?: Record<string, any>;
    secret?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Allow both POST and GET for flexibility with n8n
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const payload: N8nWebhookPayload = req.method === 'GET'
            ? req.query as any
            : req.body;

        // Optional: Verify shared secret if configured
        const expectedSecret = process.env.N8N_WEBHOOK_SECRET;
        if (expectedSecret && payload.secret !== expectedSecret) {
            console.warn('n8n webhook received with invalid secret');
            return res.status(401).json({ error: 'Invalid webhook secret' });
        }

        const { event, requestId, workflowSlug, data } = payload;

        console.log(`[n8n Webhook] Event: ${event}, Request: ${requestId}, Workflow: ${workflowSlug}`);

        // Handle different event types
        switch (event) {
            case 'workflow_complete':
                await handleWorkflowComplete(requestId, workflowSlug, data);
                break;

            case 'step_complete':
                await handleStepComplete(requestId, data);
                break;

            case 'error':
                await handleWorkflowError(requestId, workflowSlug, data);
                break;

            case 'custom':
                // Custom events can be used for any purpose
                console.log('[n8n Webhook] Custom event received:', data);
                break;

            default:
                // Still accept the webhook even if event type is unknown
                console.log('[n8n Webhook] Unknown event type:', event);
        }

        // Always return success to n8n
        return res.status(200).json({
            received: true,
            event,
            timestamp: new Date().toISOString(),
        });

    } catch (err) {
        console.error('[n8n Webhook] Error processing webhook:', err);
        // Return 200 anyway to prevent n8n from retrying
        return res.status(200).json({
            received: true,
            error: 'Processing error logged',
        });
    }
}

/**
 * Handle workflow completion event
 */
async function handleWorkflowComplete(
    requestId: string | undefined,
    workflowSlug: string | undefined,
    data: Record<string, any> | undefined
) {
    if (!requestId || !supabaseAdmin) {
        console.log('[n8n Webhook] Workflow complete (no requestId to update)');
        return;
    }

    // Update request metadata with workflow result
    try {
        const { data: request, error: fetchError } = await supabaseAdmin
            .from('requests')
            .select('metadata')
            .eq('id', requestId)
            .single();

        if (!fetchError && request) {
            const updatedMetadata = {
                ...request.metadata,
                n8n_completed: true,
                n8n_workflow: workflowSlug,
                n8n_result: data,
                n8n_completed_at: new Date().toISOString(),
            };

            await supabaseAdmin
                .from('requests')
                .update({ metadata: updatedMetadata })
                .eq('id', requestId);

            console.log(`[n8n Webhook] Updated request ${requestId} with workflow result`);
        }
    } catch (err) {
        console.error('[n8n Webhook] Failed to update request:', err);
    }
}

/**
 * Handle step completion event
 */
async function handleStepComplete(
    requestId: string | undefined,
    data: Record<string, any> | undefined
) {
    if (!requestId || !supabaseAdmin) {
        console.log('[n8n Webhook] Step complete (no requestId to update)');
        return;
    }

    // Log step completion
    try {
        await supabaseAdmin
            .from('workflow_executions')
            .insert({
                request_id: requestId,
                action: 'n8n_step_complete',
                results: data,
                created_at: new Date().toISOString(),
            });
    } catch (err) {
        // Table might not exist, just log
        console.warn('[n8n Webhook] Could not log step completion:', err);
    }
}

/**
 * Handle workflow error event
 */
async function handleWorkflowError(
    requestId: string | undefined,
    workflowSlug: string | undefined,
    data: Record<string, any> | undefined
) {
    console.error(`[n8n Webhook] Workflow error for request ${requestId}:`, data);

    if (!requestId || !supabaseAdmin) return;

    // Update request metadata with error info
    try {
        const { data: request, error: fetchError } = await supabaseAdmin
            .from('requests')
            .select('metadata')
            .eq('id', requestId)
            .single();

        if (!fetchError && request) {
            const updatedMetadata = {
                ...request.metadata,
                n8n_error: true,
                n8n_workflow: workflowSlug,
                n8n_error_data: data,
                n8n_error_at: new Date().toISOString(),
            };

            await supabaseAdmin
                .from('requests')
                .update({ metadata: updatedMetadata })
                .eq('id', requestId);
        }
    } catch (err) {
        console.error('[n8n Webhook] Failed to log error:', err);
    }
}
