import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { ApprovalEngine } from '@/lib/approvalEngine';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateAndStoreArchive } from '../archives/generate-pdf';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    const { 
      workflowDefinitionId,
      workflow_definition_id,
      workflow_mode,
      signatory_email,
      signatory_name,
      inline_workflow_steps,
      inline_workflow_settings,
      title, 
      description, 
      formData,
      form_data,
      requestor_info,
      template_id,
      signature_url,
      submitImmediately = false 
    } = req.body;

    // Accept both camelCase and snake_case
    const workflowId = workflowDefinitionId || workflow_definition_id;
    const workflowModeValue = workflow_mode || 'select';
    const inlineSteps = inline_workflow_steps;
    const inlineSettings = inline_workflow_settings;
    const actualFormData = formData || form_data || {};

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Merge form data with requestor info if provided
    const completeFormData = {
      ...actualFormData,
      ...(requestor_info ? { requestor_info } : {}),
      ...(template_id ? { template_id } : {})
    };

    // Handle different workflow modes
    if (workflowModeValue === 'none') {
      // No approval needed - instant approval
      const { data: request, error: requestError } = await supabaseAdmin
        .from('requests')
        .insert({
          organization_id: organizationId,
          creator_id: userId,
          title,
          description: description || null,
          status: 'approved',
          metadata: {
            ...completeFormData,
            template_id: template_id,
          },
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Generate PDF archive for the approved form
      try {
        await generateAndStoreArchive(request.id, organizationId, userId);
        console.log(`PDF archive generated for no-approval request ${request.id}`);
      } catch (archiveError) {
        console.error('Failed to generate PDF archive:', archiveError);
        // Don't fail the request if archiving fails, just log it
      }

      return res.status(201).json({ 
        success: true,
        requestId: request.id,
        message: 'Form submitted successfully (no approval required)'
      });
    }

    if (workflowModeValue === 'self_sign') {
      // Self-sign mode - request is signed by the submitter and immediately archived
      const { data: request, error: requestError } = await supabaseAdmin
        .from('requests')
        .insert({
          organization_id: organizationId,
          creator_id: userId,
          title,
          description: description || null,
          status: 'approved',
          metadata: {
            ...completeFormData,
            signature_url: signature_url,
            signed_at: new Date().toISOString(),
            signed_by: userId,
            template_id: template_id,
          },
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Generate PDF archive for the signed form
      try {
        await generateAndStoreArchive(request.id, organizationId, userId);
        console.log(`PDF archive generated for self-signed request ${request.id}`);
      } catch (archiveError) {
        console.error('Failed to generate PDF archive:', archiveError);
        // Don't fail the request if archiving fails, just log it
      }

      return res.status(201).json({ 
        success: true,
        requestId: request.id,
        message: 'Form signed and submitted successfully!'
      });
    }

    if (workflowModeValue === 'individual_signatory') {
      // Individual signatory mode - send to specific person for approval
      if (!signatory_email) {
        return res.status(400).json({ error: 'Signatory email is required for individual signatory mode' });
      }

      const { data: request, error: requestError } = await supabaseAdmin
        .from('requests')
        .insert({
          organization_id: organizationId,
          creator_id: userId,
          title,
          description: description || null,
          status: 'pending',
          metadata: completeFormData,
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Create a single approval step for the signatory
      const { error: stepError } = await supabaseAdmin
        .from('request_steps')
        .insert({
          request_id: request.id,
          step_number: 1,
          approver_email: signatory_email,
          approver_name: signatory_name || null,
          status: 'pending',
        });

      if (stepError) throw stepError;

      return res.status(201).json({ 
        success: true,
        requestId: request.id,
        message: `Form submitted for approval by ${signatory_name || signatory_email}`
      });
    }

    // For 'select' and 'create' modes, use the workflow definition
    if (!workflowId) {
      if (inlineSteps) {
        return res.status(400).json({ 
          error: 'Inline workflows are not yet supported. Please assign a workflow definition to this form template.' 
        });
      }
      return res.status(400).json({ error: 'Workflow definition ID is required for multi-step workflows' });
    }

    // Create the request using the ApprovalEngine
    const result = await ApprovalEngine.createRequest(
      workflowId,
      organizationId,
      userId,
      title,
      description || null,
      completeFormData,
      submitImmediately ? 'pending' : 'draft'
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(201).json({ 
      success: true,
      requestId: result.requestId,
      message: submitImmediately 
        ? 'Request submitted for approval' 
        : 'Request saved as draft'
    });

  } catch (error: any) {
    console.error('Create request from workflow error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create request' });
  }
}
