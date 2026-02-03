import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;
    const { id: requestId } = req.query;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    if (!requestId || typeof requestId !== 'string') {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    // Verify the request exists and get current data
    const { data: request, error: requestError } = await supabaseAdmin
      .from('requests')
      .select(`
        id, 
        creator_id, 
        metadata,
        request_steps (
          id,
          approver_user_id,
          status
        )
      `)
      .eq('id', requestId)
      .eq('organization_id', organizationId)
      .single();

    if (requestError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check if user is a current approver (has a pending step)
    const pendingStep = request.request_steps?.find(
      (step: any) => step.approver_user_id === userId && step.status === 'pending'
    );

    // Check if user is a watcher (handle both old string[] and new object[] formats)
    const watchersData = Array.isArray(request.metadata?.watchers) ? request.metadata.watchers : [];
    const isWatcher = watchersData.some((w: any) => 
      typeof w === 'string' ? w === userId : w.id === userId
    );

    if (!pendingStep) {
      if (isWatcher) {
        return res.status(403).json({ error: 'Watchers can only view requests, not edit them' });
      }
      return res.status(403).json({ error: 'Only the current approver can edit this request' });
    }

    if (req.method === 'GET') {
      // Get modifications for this request
      const { data: modifications, error: modError } = await supabaseAdmin
        .from('request_modifications')
        .select(`
          id,
          modification_type,
          field_name,
          old_value,
          new_value,
          document_filename,
          created_at,
          modified_by:app_users!request_modifications_modified_by_fkey (
            id,
            display_name,
            email,
            profile_picture_url
          )
        `)
        .eq('request_id', requestId)
        .order('created_at', { ascending: false });

      if (modError) {
        console.error('Error fetching modifications:', modError);
        return res.status(200).json({ modifications: [] });
      }

      return res.status(200).json({ modifications: modifications || [] });
    }

    if (req.method === 'PUT') {
      const { fieldChanges, watchers } = req.body;

      if ((!fieldChanges || !Array.isArray(fieldChanges) || fieldChanges.length === 0) && !watchers) {
        return res.status(400).json({ error: 'No changes provided' });
      }

      // Build the updated metadata
      let updatedMetadata = { ...request.metadata };
      const modifications: any[] = [];

      // Handle watchers update if provided
      if (watchers && Array.isArray(watchers)) {
        updatedMetadata.watchers = watchers;
      }

      // Process each field change
      for (const change of (fieldChanges || [])) {
        const { fieldName, oldValue, newValue } = change;

        if (fieldName && newValue !== oldValue) {
          // Update the metadata - handle nested form types
          const formTypes = ['capex', 'leave', 'travel', 'expense', 'approval'];
          let found = false;

          for (const formType of formTypes) {
            if (updatedMetadata[formType] && typeof updatedMetadata[formType] === 'object') {
              updatedMetadata[formType] = { ...updatedMetadata[formType], [fieldName]: newValue };
              found = true;
              break;
            }
          }

          if (!found) {
            updatedMetadata[fieldName] = newValue;
          }

          // Record the modification
          modifications.push({
            request_id: requestId,
            modified_by: userId,
            modification_type: 'field_edit',
            field_name: fieldName,
            old_value: oldValue !== undefined ? String(oldValue) : null,
            new_value: newValue !== undefined ? String(newValue) : null,
          });
        }
      }

      // Update the request metadata
      const { error: updateError } = await supabaseAdmin
        .from('requests')
        .update({
          metadata: updatedMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) {
        console.error('Error updating request:', updateError);
        return res.status(500).json({ error: 'Failed to update request' });
      }

      // Insert modification records
      if (modifications.length > 0) {
        const { error: modInsertError } = await supabaseAdmin
          .from('request_modifications')
          .insert(modifications);

        if (modInsertError) {
          console.error('Error recording modifications:', modInsertError);
          // Don't fail the request, just log the error
        }
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Request updated successfully',
        modificationsCount: modifications.length 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Approver edit API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}
