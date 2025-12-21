import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { startWorkflowExecution, WorkflowDefinition } from '@/lib/workflowExecutor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Database not configured (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)' });
    }

    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = session.user as any;
    const organizationId = user.org_id;
    const creatorId = user.id;

    if (!organizationId || !creatorId) {
      return res.status(400).json({ error: 'User session missing organization or user id' });
    }

    const { title, description, priority, category, type, metadata, workflowId } = req.body || {};

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required' });
    }

    const insertPayload: Record<string, any> = {
      organization_id: organizationId,
      creator_id: creatorId,
      title,
      description: typeof description === 'string' ? description : null,
      priority: typeof priority === 'string' ? priority : 'normal',
      category: typeof category === 'string' ? category : null,
      status: 'draft',
      metadata: {
        ...(metadata && typeof metadata === 'object' ? metadata : {}),
        ...(type ? { type } : {}),
        ...(workflowId ? { workflowId } : {}),
      },
    };

    const { data, error } = await supabaseAdmin
      .from('requests')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) {
      console.error('Create request error:', error);
      return res.status(500).json({
        error: 'Failed to create request',
        details: {
          message: error.message,
          code: (error as any).code,
          hint: (error as any).hint,
          details: (error as any).details,
        },
      });
    }

    const requestId = data.id;
    let workflowResults = null;

    // If a workflow ID is provided, trigger the workflow execution
    if (workflowId) {
      try {
        // Fetch the workflow definition
        const { data: workflowData, error: workflowError } = await supabaseAdmin
          .from('workflows')
          .select('*')
          .eq('id', workflowId)
          .single();

        if (!workflowError && workflowData) {
          const workflow: WorkflowDefinition = {
            id: workflowData.id,
            name: workflowData.name,
            description: workflowData.description,
            steps: workflowData.steps || [],
            settings: workflowData.settings || {},
          };

          // Build request data from the form submission
          const requestData = {
            title,
            description,
            priority,
            category,
            type,
            ...(metadata || {}),
          };

          // Execute the workflow (this will run integration steps and pause at approval steps)
          workflowResults = await startWorkflowExecution(
            workflow,
            requestId,
            requestData,
            creatorId,
            organizationId
          );

          // Update request with workflow execution status
          await supabaseAdmin
            .from('requests')
            .update({
              metadata: {
                ...insertPayload.metadata,
                workflowStarted: true,
                workflowResults,
                workflowStartedAt: new Date().toISOString(),
              },
            })
            .eq('id', requestId);

          console.log(`Workflow ${workflowId} started for request ${requestId}:`, workflowResults);
        } else {
          console.warn(`Workflow ${workflowId} not found, request created without workflow`);
        }
      } catch (workflowErr) {
        // Don't fail the request if workflow execution fails
        console.error('Error starting workflow:', workflowErr);
        workflowResults = { error: workflowErr instanceof Error ? workflowErr.message : 'Unknown error' };
      }
    }

    return res.status(201).json({
      id: requestId,
      workflowStarted: !!workflowId,
      workflowResults,
    });
  } catch (err) {
    console.error('Create request handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
