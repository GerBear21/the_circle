import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface DashboardStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  thisMonthRequests: number;
  completionRate: number;
}

interface RecentActivity {
  id: string;
  title: string;
  status: string;
  created_at: string;
  creator: {
    display_name: string | null;
    email: string;
  } | null;
  metadata: Record<string, any>;
}

interface TeamMember {
  id: string;
  display_name: string | null;
  email: string;
}

export function useDashboardStats() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<DashboardStats>({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
    thisMonthRequests: 0,
    completionRate: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingForUser, setPendingForUser] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    if (status === 'loading') return;
    
    if (!session) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/dashboard/stats');
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }

      const data = await response.json();

      setStats(data.stats);
      setRecentActivity(data.recentActivity);
      setTeamMembers(data.teamMembers);
      setPendingForUser(data.pendingForUser);

    } catch (err) {
      setError(err as Error);
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, [session, status]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    recentActivity,
    teamMembers,
    pendingForUser,
    loading,
    error,
    refetch: fetchStats,
  };
}
