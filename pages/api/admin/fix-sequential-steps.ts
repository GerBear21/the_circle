import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
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

    // Get all pending requests
    const { data: pendingRequests, error: reqError } = await supabaseAdmin
      .from('requests')
      .select('id')
      .eq('status', 'pending');

    if (reqError) throw reqError;

    if (!pendingRequests || pendingRequests.length === 0) {
      return res.status(200).json({ message: 'No pending requests to fix', fixed: 0 });
    }

    const requestIds = pendingRequests.map(r => r.id);
    let fixedCount = 0;

    // For each pending request, fix the step statuses
    for (const requestId of requestIds) {
      // Get all steps for this request ordered by step_index
      const { data: steps, error: stepsError } = await supabaseAdmin
        .from('request_steps')
        .select('id, step_index, status')
        .eq('request_id', requestId)
        .order('step_index', { ascending: true });

      if (stepsError || !steps || steps.length === 0) continue;

      // Find the first step that should be pending (first non-approved step)
      let foundPending = false;
      for (const step of steps) {
        if (step.status === 'approved') {
          // Already approved, skip
          continue;
        }
        
        if (!foundPending) {
          // This is the first non-approved step - it should be pending
          if (step.status !== 'pending') {
            await supabaseAdmin
              .from('request_steps')
              .update({ status: 'pending' })
              .eq('id', step.id);
            fixedCount++;
          }
          foundPending = true;
        } else {
          // All subsequent steps should be waiting
          if (step.status === 'pending') {
            await supabaseAdmin
              .from('request_steps')
              .update({ status: 'waiting' })
              .eq('id', step.id);
            fixedCount++;
          }
        }
      }
    }

    return res.status(200).json({ 
      message: `Fixed ${fixedCount} steps across ${requestIds.length} pending requests`,
      fixed: fixedCount,
      requestsChecked: requestIds.length
    });
  } catch (error: any) {
    console.error('Fix sequential steps error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fix steps' });
  }
}
