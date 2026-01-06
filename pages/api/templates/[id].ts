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
      return res.status(400).json({ error: 'Template ID is required' });
    }

    if (req.method === 'GET') {
      const { data: template, error } = await supabaseAdmin
        .from('approval_templates')
        .select(`
          id,
          name,
          description,
          form_fields,
          workflow_steps,
          workflow_settings,
          is_active,
          created_at,
          updated_at,
          creator:app_users!approval_templates_created_by_fkey (
            display_name,
            email
          )
        `)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Template not found' });
        }
        throw error;
      }

      return res.status(200).json({ template });
    }

    if (req.method === 'PUT') {
      const { name, description, formFields, workflowSteps, workflowSettings, isActive } = req.body;

      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (formFields !== undefined) updates.form_fields = formFields;
      if (workflowSteps !== undefined) updates.workflow_steps = workflowSteps;
      if (workflowSettings !== undefined) updates.workflow_settings = workflowSettings;
      if (isActive !== undefined) updates.is_active = isActive;

      const { data, error } = await supabaseAdmin
        .from('approval_templates')
        .update(updates)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Template not found' });
        }
        throw error;
      }

      return res.status(200).json({ template: data });
    }

    if (req.method === 'DELETE') {
      const { error } = await supabaseAdmin
        .from('approval_templates')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Template API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}
