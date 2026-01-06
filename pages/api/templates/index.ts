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
    const userId = user.id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    if (req.method === 'GET') {
      // Fetch all templates for the organization
      const { data: templates, error } = await supabaseAdmin
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
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json({ templates: templates || [] });
    }

    if (req.method === 'POST') {
      const { name, description, formFields, workflowSteps, workflowSettings } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Template name is required' });
      }

      if (!workflowSteps || workflowSteps.length === 0) {
        return res.status(400).json({ error: 'At least one approval step is required' });
      }

      const { data, error } = await supabaseAdmin
        .from('approval_templates')
        .insert({
          organization_id: organizationId,
          created_by: userId,
          name,
          description: description || null,
          form_fields: formFields || [],
          workflow_steps: workflowSteps,
          workflow_settings: workflowSettings || {},
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ template: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Templates API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}
