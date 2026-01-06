import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = session.user as any;
    const organizationId = user.org_id;
    const { id } = req.query;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    if (req.method === 'GET') {
      const { data: request, error } = await supabaseAdmin
        .from('requests')
        .select(`
          id,
          title,
          description,
          status,
          metadata,
          created_at,
          updated_at,
          creator:app_users!requests_creator_id_fkey (
            id,
            display_name,
            email,
            department:departments (
              id,
              name
            )
          ),
          request_steps (
            id,
            step_index,
            step_type,
            approver_role,
            status,
            due_at,
            created_at,
            approver:app_users!request_steps_approver_user_id_fkey (
              id,
              display_name,
              email
            ),
            approvals (
              id,
              decision,
              comment,
              signed_at,
              approver:app_users!approvals_approver_id_fkey (
                id,
                display_name,
                email
              )
            )
          ),
          documents (
            id,
            filename,
            storage_path,
            file_size,
            mime_type,
            created_at
          )
        `)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Request not found' });
        }
        throw error;
      }

      // Sort request_steps by step_index
      if (request.request_steps) {
        request.request_steps.sort((a: any, b: any) => a.step_index - b.step_index);
      }

      // Calculate current step (first pending step)
      const currentStepIndex = request.request_steps?.findIndex((step: any) => step.status === 'pending') ?? -1;
      const currentStep = currentStepIndex >= 0 ? request.request_steps[currentStepIndex] : null;

      return res.status(200).json({ 
        request: {
          ...request,
          current_step: currentStepIndex >= 0 ? currentStepIndex + 1 : request.request_steps?.length || 0,
          total_steps: request.request_steps?.length || 0,
          current_approver: currentStep?.approver || null
        }
      });
    }

    if (req.method === 'PUT') {
      const { title, description, priority, category, status, metadata } = req.body;

      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (priority !== undefined) updates.priority = priority;
      if (category !== undefined) updates.category = category;
      if (status !== undefined) updates.status = status;
      if (metadata !== undefined) updates.metadata = metadata;

      const { data, error } = await supabaseAdmin
        .from('requests')
        .update(updates)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Request not found' });
        }
        throw error;
      }

      return res.status(200).json({ request: data });
    }

    if (req.method === 'DELETE') {
      const { error } = await supabaseAdmin
        .from('requests')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Request API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}
