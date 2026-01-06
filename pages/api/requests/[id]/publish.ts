import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
    const { id } = req.query;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    // Fetch the request to verify ownership and status
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('requests')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Only the creator can publish their own request
    if (request.creator_id !== userId) {
      return res.status(403).json({ error: 'Only the request creator can publish this request' });
    }

    // Only draft requests can be published
    if (request.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft requests can be published' });
    }

    // Get approvers from metadata
    const approverIds: string[] = request.metadata?.approvers || [];

    if (approverIds.length === 0) {
      return res.status(400).json({ error: 'No approvers assigned. Please add approvers before publishing.' });
    }

    // Create request_steps for each approver
    const requestSteps = approverIds.map((approverId, index) => ({
      request_id: id,
      step_index: index,
      step_type: 'approval',
      approver_role: `Approver ${index + 1}`,
      approver_user_id: approverId,
      status: 'pending',
    }));

    const { error: stepsError } = await supabaseAdmin
      .from('request_steps')
      .insert(requestSteps);

    if (stepsError) {
      console.error('Error creating request steps:', stepsError);
      throw stepsError;
    }

    // Update request status to pending
    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from('requests')
      .update({
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({
      success: true,
      request: updatedRequest,
      message: 'Request published successfully',
    });
  } catch (error: any) {
    console.error('Publish request error:', error);
    return res.status(500).json({ error: error.message || 'Failed to publish request' });
  }
}
