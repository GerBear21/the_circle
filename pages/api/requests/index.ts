import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { startWorkflowExecution, WorkflowDefinition } from '@/lib/workflowExecutor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const userId = user.id;

    if (!organizationId || !userId) {
      return res.status(400).json({ error: 'User session missing organization or user id' });
    }

    // Handle GET request - fetch all requests
    if (req.method === 'GET') {
      const { status, type, search, sort = 'newest', limit = 50, offset = 0 } = req.query;

      let query = supabaseAdmin
        .from('requests')
        .select(`
          id,
          title,
          description,
          status,
          metadata,
          created_at,
          updated_at,
          creator_id,
          creator:app_users!requests_creator_id_fkey (
            id,
            display_name,
            email,
            job_title,
            department_id,
            department:departments!app_users_department_id_fkey (
              id,
              name
            )
          )
        `)
        .eq('organization_id', organizationId);

      // Apply status filter
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      // Apply type filter (stored in metadata)
      if (type && type !== 'all') {
        query = query.contains('metadata', { type });
      }

      // Apply search filter
      if (search && typeof search === 'string' && search.trim()) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      // Apply sorting
      switch (sort) {
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'newest':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      // Apply pagination
      const limitNum = Math.min(Number(limit) || 50, 100);
      const offsetNum = Number(offset) || 0;
      query = query.range(offsetNum, offsetNum + limitNum - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Fetch requests error:', error);
        return res.status(500).json({
          error: 'Failed to fetch requests',
          details: error.message,
        });
      }

      // Transform data to match frontend interface
      const requests = (data || []).map((req: any) => {
        const meta = req.metadata || {};
        const creator = req.creator || {};
        const department = creator.department || {};

        return {
          id: req.id,
          title: req.title,
          description: req.description || '',
          status: req.status || 'draft',
          priority: meta.priority || 'normal',
          category: meta.category || 'General',
          department: department.name || 'Unknown',
          created_at: req.created_at,
          updated_at: req.updated_at || req.created_at,
          current_step: meta.currentStep || 1,
          total_steps: meta.totalSteps || 1,
          type: meta.type || 'approval',
          amount: meta.amount || meta.estimatedCost || null,
          currency: meta.currency || 'USD',
          requester: {
            id: creator.id || req.creator_id,
            name: creator.display_name || 'Unknown User',
            email: creator.email || '',
            department: department.name || 'Unknown',
            position: creator.job_title || '',
          },
          current_approver: meta.currentApprover || null,
          due_date: meta.dueDate || null,
          reference_number: `REQ-${req.id?.slice(0, 8)?.toUpperCase() || ''}`,
          attachments_count: meta.attachmentsCount || 0,
          comments_count: meta.commentsCount || 0,
        };
      });

      return res.status(200).json({ requests, total: count || requests.length });
    }

    // Handle POST request - create new request
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const creatorId = userId;
    const { title, description, priority, category, type, metadata, workflowId } = req.body || {};

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required' });
    }

    const insertPayload: Record<string, any> = {
      organization_id: organizationId,
      creator_id: creatorId,
      title,
      description: typeof description === 'string' ? description : null,
      status: 'draft',
      metadata: {
        ...(metadata && typeof metadata === 'object' ? metadata : {}),
        ...(type ? { type } : {}),
        ...(category ? { category } : {}),
        ...(priority ? { priority } : { priority: 'normal' }),
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
