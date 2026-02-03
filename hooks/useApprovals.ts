import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface RequestWithSteps {
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
  request_steps: {
    id: string;
    step_index: number;
    step_type: string;
    approver_role: string | null;
    approver_user_id: string | null;
    status: string;
    due_at: string | null;
    completed_at?: string | null;
    comment?: string | null;
  }[];
}

interface HistoryRequest extends RequestWithSteps {
  user_action: string | null;
  user_action_date: string | null;
  user_comment: string | null;
}

export function useApprovals() {
  const { data: session, status: sessionStatus } = useSession();
  const [pendingApprovals, setPendingApprovals] = useState<RequestWithSteps[]>([]);
  const [watchingRequests, setWatchingRequests] = useState<RequestWithSteps[]>([]);
  const [historyRequests, setHistoryRequests] = useState<HistoryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchingLoading, setWatchingLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPendingApprovals = useCallback(async () => {
    if (sessionStatus === 'loading') return;
    
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/approvals/pending');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch pending approvals');
      }

      const data = await response.json();
      setPendingApprovals(data || []);
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, sessionStatus]);

  const fetchWatchingRequests = useCallback(async () => {
    if (sessionStatus === 'loading') return;
    
    if (!session?.user?.id) {
      setWatchingLoading(false);
      return;
    }

    try {
      setWatchingLoading(true);
      const response = await fetch('/api/approvals/watching');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch watching requests');
      }

      const data = await response.json();
      setWatchingRequests(data || []);
    } catch (err) {
      console.error('Error fetching watching requests:', err);
    } finally {
      setWatchingLoading(false);
    }
  }, [session?.user?.id, sessionStatus]);

  const fetchHistoryRequests = useCallback(async () => {
    if (sessionStatus === 'loading') return;
    
    if (!session?.user?.id) {
      setHistoryLoading(false);
      return;
    }

    try {
      setHistoryLoading(true);
      const response = await fetch('/api/approvals/history');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch approval history');
      }

      const data = await response.json();
      setHistoryRequests(data || []);
    } catch (err) {
      console.error('Error fetching approval history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [session?.user?.id, sessionStatus]);

  useEffect(() => {
    fetchPendingApprovals();
    fetchWatchingRequests();
    fetchHistoryRequests();
  }, [fetchPendingApprovals, fetchWatchingRequests, fetchHistoryRequests]);

  const approveRequest = async (requestId: string, stepId: string, comment?: string) => {
    const response = await fetch('/api/approvals/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        stepId,
        action: 'approve',
        comment,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to approve request');
    }

    return response.json();
  };

  const rejectRequest = async (requestId: string, stepId: string, comment: string) => {
    const response = await fetch('/api/approvals/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        stepId,
        action: 'reject',
        comment,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to reject request');
    }

    return response.json();
  };

  const refetch = () => {
    fetchPendingApprovals();
    fetchWatchingRequests();
    fetchHistoryRequests();
  };

  return {
    pendingApprovals,
    watchingRequests,
    historyRequests,
    loading: loading || sessionStatus === 'loading',
    watchingLoading,
    historyLoading,
    error,
    approveRequest,
    rejectRequest,
    refetch,
  };
}
