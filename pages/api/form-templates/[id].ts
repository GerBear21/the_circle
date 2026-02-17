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
        .from('form_templates')
        .select(`
          id,
          name,
          description,
          scope,
          scope_department_id,
          scope_business_unit_id,
          category,
          icon,
          color,
          requestor_fields,
          form_fields,
          workflow_definition_id,
          workflow_mode,
          signatory_email,
          signatory_name,
          inline_workflow_steps,
          inline_workflow_settings,
          is_active,
          is_published,
          usage_count,
          created_at,
          updated_at,
          creator:app_users!form_templates_created_by_fkey (
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
          return res.status(404).json({ error: 'Form template not found' });
        }
        throw error;
      }

      // Increment usage count
      await supabaseAdmin
        .from('form_templates')
        .update({ usage_count: (template.usage_count || 0) + 1 })
        .eq('id', id);

      return res.status(200).json({ template });
    }

    if (req.method === 'PUT') {
      const updates: any = { updated_at: new Date().toISOString() };
      const {
        name, description, scope, scopeDepartmentId, scopeBusinessUnitId,
        category, icon, color, requestorFields, formFields,
        workflowDefinitionId, inlineWorkflowSteps, inlineWorkflowSettings,
        isActive, isPublished,
      } = req.body;

      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (scope !== undefined) updates.scope = scope;
      if (scopeDepartmentId !== undefined) updates.scope_department_id = scopeDepartmentId;
      if (scopeBusinessUnitId !== undefined) updates.scope_business_unit_id = scopeBusinessUnitId;
      if (category !== undefined) updates.category = category;
      if (icon !== undefined) updates.icon = icon;
      if (color !== undefined) updates.color = color;
      if (requestorFields !== undefined) updates.requestor_fields = requestorFields;
      if (formFields !== undefined) updates.form_fields = formFields;
      if (workflowDefinitionId !== undefined) updates.workflow_definition_id = workflowDefinitionId;
      if (inlineWorkflowSteps !== undefined) updates.inline_workflow_steps = inlineWorkflowSteps;
      if (inlineWorkflowSettings !== undefined) updates.inline_workflow_settings = inlineWorkflowSettings;
      if (isActive !== undefined) updates.is_active = isActive;
      if (isPublished !== undefined) updates.is_published = isPublished;

      const { data, error } = await supabaseAdmin
        .from('form_templates')
        .update(updates)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Form template not found' });
        }
        throw error;
      }

      return res.status(200).json({ template: data });
    }

    if (req.method === 'DELETE') {
      const { error } = await supabaseAdmin
        .from('form_templates')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Form template API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}
