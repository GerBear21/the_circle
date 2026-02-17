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
      const { scope, category, search, published_only } = req.query;
      
      let query = supabaseAdmin
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
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('usage_count', { ascending: false });

      if (published_only === 'true') {
        query = query.eq('is_published', true);
      }

      if (scope && scope !== 'all') {
        query = query.eq('scope', scope);
      }

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      if (search && typeof search === 'string' && search.trim()) {
        query = query.or(`name.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%,category.ilike.%${search.trim()}%`);
      }

      const { data: templates, error } = await query;

      if (error) throw error;

      return res.status(200).json({ templates: templates || [] });
    }

    if (req.method === 'POST') {
      const {
        name,
        description,
        scope,
        scopeDepartmentId,
        scopeBusinessUnitId,
        scopeMultiBusinessUnitIds,
        category,
        icon,
        color,
        requestorFields,
        autofillRequestorInfo,
        formFields,
        workflowMode,
        workflowDefinitionId,
        signatoryEmail,
        signatoryName,
        inlineWorkflowSteps,
        inlineWorkflowSettings,
        formVersion,
        approvalDate,
        formLayout,
        totalPages,
        audienceType,
        audienceDepartmentIds,
        audienceIndividualEmails,
        audienceGroupName,
        audiencePositions,
        recurrence,
        allowSubmitAnother,
        thankYouMessage,
        notifyOnResponse,
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Form template name is required' });
      }

      if (!formFields || formFields.length === 0) {
        return res.status(400).json({ error: 'At least one form field is required' });
      }

      // Validate workflow based on workflowMode
      const workflowModesRequiringWorkflow = ['select', 'create'];
      const currentWorkflowMode = workflowMode || 'select';
      
      if (workflowModesRequiringWorkflow.includes(currentWorkflowMode)) {
        if (!workflowDefinitionId && (!inlineWorkflowSteps || inlineWorkflowSteps.length === 0)) {
          return res.status(400).json({ error: 'A workflow is required. Select an existing workflow or create one.' });
        }
      }

      // Validate individual signatory mode
      if (currentWorkflowMode === 'individual_signatory' && !signatoryEmail) {
        return res.status(400).json({ error: 'Signatory email is required for individual signatory mode.' });
      }

      const { data, error } = await supabaseAdmin
        .from('form_templates')
        .insert({
          organization_id: organizationId,
          created_by: userId,
          name,
          description: description || null,
          scope: scope || 'hotel_group',
          scope_department_id: scopeDepartmentId || null,
          scope_business_unit_id: scopeBusinessUnitId || null,
          scope_multi_business_unit_ids: scopeMultiBusinessUnitIds || null,
          category: category || null,
          icon: icon || undefined,
          color: color || 'primary',
          requestor_fields: requestorFields || ['full_name', 'email', 'department', 'business_unit', 'date'],
          autofill_requestor_info: autofillRequestorInfo ?? true,
          form_fields: formFields,
          workflow_mode: currentWorkflowMode,
          workflow_definition_id: workflowDefinitionId || null,
          signatory_email: signatoryEmail || null,
          signatory_name: signatoryName || null,
          inline_workflow_steps: inlineWorkflowSteps || null,
          inline_workflow_settings: inlineWorkflowSettings || null,
          form_version: formVersion || null,
          approval_date: approvalDate || null,
          form_layout: formLayout || 'single_page',
          total_pages: totalPages || 1,
          audience_type: audienceType || 'all',
          audience_department_ids: audienceDepartmentIds || null,
          audience_individual_emails: audienceIndividualEmails || null,
          audience_group_name: audienceGroupName || null,
          audience_positions: audiencePositions || null,
          recurrence: recurrence || 'none',
          allow_submit_another: allowSubmitAnother ?? false,
          thank_you_message: thankYouMessage || 'Thank you for your submission! Your response has been recorded.',
          notify_on_response: notifyOnResponse ?? true,
          is_active: true,
          is_published: true,
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ template: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Form templates API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}
