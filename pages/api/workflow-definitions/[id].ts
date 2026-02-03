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
      return res.status(400).json({ error: 'Workflow definition ID is required' });
    }

    if (req.method === 'GET') {
      const { data: definition, error } = await supabaseAdmin
        .from('workflow_definitions')
        .select(`
          id,
          name,
          description,
          category,
          form_schema,
          steps,
          settings,
          is_active,
          version,
          created_at,
          updated_at,
          creator:app_users!workflow_definitions_created_by_fkey (
            id,
            display_name,
            email
          )
        `)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Workflow definition not found' });
        }
        throw error;
      }

      return res.status(200).json({ definition });
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const { name, description, category, formSchema, steps, settings, is_active } = req.body;

      const updateData: any = {};

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;
      if (formSchema !== undefined) updateData.form_schema = formSchema;
      if (settings !== undefined) updateData.settings = settings;
      if (is_active !== undefined) updateData.is_active = is_active;

      if (steps !== undefined) {
        // Validate steps
        for (const step of steps) {
          if (!step.name || !step.type || !step.approverType) {
            return res.status(400).json({ 
              error: 'Each step must have name, type, and approverType' 
            });
          }
        }
        updateData.steps = steps.map((step: any, index: number) => ({
          ...step,
          id: step.id || `step_${index + 1}`,
          order: index + 1,
        }));
        // Increment version when steps change
        updateData.version = supabaseAdmin.rpc('increment_version');
      }

      const { data, error } = await supabaseAdmin
        .from('workflow_definitions')
        .update(updateData)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Workflow definition not found' });
        }
        throw error;
      }

      return res.status(200).json({ definition: data });
    }

    if (req.method === 'DELETE') {
      // Soft delete by setting is_active to false
      const { error } = await supabaseAdmin
        .from('workflow_definitions')
        .update({ is_active: false })
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) throw error;

      return res.status(200).json({ success: true, message: 'Workflow definition deactivated' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Workflow definition API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}
