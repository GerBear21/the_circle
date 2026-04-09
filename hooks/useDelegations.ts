import { useState, useEffect, useCallback } from 'react';

interface Delegation {
  id: string;
  delegator_id: string;
  delegate_id: string;
  reason: string | null;
  department_id: string | null;
  business_unit_id: string | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  status: 'pending' | 'approved' | 'rejected';
  review_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_by: string | null;
  created_at: string;
  delegator?: { id: string; display_name: string; email: string };
  delegate?: { id: string; display_name: string; email: string };
  department?: { id: string; name: string } | null;
  business_unit?: { id: string; name: string } | null;
}

export function useDelegations(userId?: string) {
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDelegations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = userId ? `?user_id=${userId}` : '';
      const res = await fetch(`/api/rbac/delegations${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch delegations');
      }
      const data = await res.json();
      setDelegations(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDelegations();
  }, [fetchDelegations]);

  const requestDelegation = useCallback(async (payload: {
    delegator_id: string;
    delegate_id: string;
    reason?: string;
    department_id?: string;
    business_unit_id?: string;
    starts_at?: string;
    ends_at?: string;
  }) => {
    const res = await fetch('/api/rbac/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to request delegation');
    }
    await fetchDelegations();
    return res.json();
  }, [fetchDelegations]);

  const reviewDelegation = useCallback(async (id: string, action: 'approve' | 'reject', reviewComment?: string) => {
    const res = await fetch('/api/rbac/delegations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        action,
        review_comment: reviewComment,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || `Failed to ${action} delegation`);
    }
    await fetchDelegations();
    return res.json();
  }, [fetchDelegations]);

  const updateDelegation = useCallback(async (id: string, updates: { is_active?: boolean; ends_at?: string }) => {
    const res = await fetch('/api/rbac/delegations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update delegation');
    }
    await fetchDelegations();
    return res.json();
  }, [fetchDelegations]);

  const myPendingDelegations = delegations.filter(d => d.status === 'pending');
  const myActiveDelegations = delegations.filter(d => d.status === 'approved' && d.is_active);
  const myHistoryDelegations = delegations.filter(d => d.status === 'rejected' || (d.status === 'approved' && !d.is_active));

  return {
    delegations,
    myPendingDelegations,
    myActiveDelegations,
    myHistoryDelegations,
    loading,
    error,
    fetchDelegations,
    requestDelegation,
    reviewDelegation,
    updateDelegation,
  };
}
