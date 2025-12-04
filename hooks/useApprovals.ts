import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useCurrentUser } from './useCurrentUser';

interface Approval {
  id: string;
  request_id: string;
  step_id: string;
  approver_id: string;
  decision: string;
  comment: string | null;
  signed_at: string;
}

interface Request {
  id: string;
  organization_id: string;
  workspace_id: string | null;
  creator_id: string;
  title: string;
  description: string | null;
  status: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface RequestWithSteps extends Request {
  request_steps: {
    id: string;
    step_index: number;
    step_type: string;
    approver_role: string | null;
    approver_user_id: string | null;
    status: string;
    due_at: string | null;
  }[];
}

export function useApprovals() {
  const { user } = useCurrentUser();
  const [pendingApprovals, setPendingApprovals] = useState<RequestWithSteps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchPendingApprovals() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        // Fetch requests where user is an approver and step is pending
        const { data, error: fetchError } = await supabase
          .from('requests')
          .select(`
            *,
            request_steps!inner (
              id,
              step_index,
              step_type,
              approver_role,
              approver_user_id,
              status,
              due_at
            )
          `)
          .eq('request_steps.approver_user_id', user.id)
          .eq('request_steps.status', 'pending')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setPendingApprovals(data || []);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchPendingApprovals();
  }, [user?.id]);

  const approveRequest = async (requestId: string, stepId: string, comment?: string) => {
    if (!user?.id) throw new Error('User not authenticated');

    const { error } = await supabase.from('approvals').insert({
      request_id: requestId,
      step_id: stepId,
      approver_id: user.id,
      decision: 'approved',
      comment,
    });

    if (error) throw error;

    // Update step status
    await supabase
      .from('request_steps')
      .update({ status: 'approved' })
      .eq('id', stepId);
  };

  const rejectRequest = async (requestId: string, stepId: string, comment: string) => {
    if (!user?.id) throw new Error('User not authenticated');

    const { error } = await supabase.from('approvals').insert({
      request_id: requestId,
      step_id: stepId,
      approver_id: user.id,
      decision: 'rejected',
      comment,
    });

    if (error) throw error;

    // Update step and request status
    await supabase
      .from('request_steps')
      .update({ status: 'rejected' })
      .eq('id', stepId);

    await supabase
      .from('requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);
  };

  return {
    pendingApprovals,
    loading,
    error,
    approveRequest,
    rejectRequest,
  };
}
