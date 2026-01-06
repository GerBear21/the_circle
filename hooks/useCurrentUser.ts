import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';

interface Organization {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface BusinessUnit {
  id: string;
  name: string;
}

interface AppUser {
  id: string;
  organization_id: string;
  workspace_id: string | null;
  azure_oid: string;
  email: string;
  display_name: string | null;
  role: string;
  created_at: string;
  department_id: string | null;
  business_unit_id: string | null;
  organization?: Organization;
  department?: Department;
  business_unit?: BusinessUnit;
}

export function useCurrentUser() {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    if (status === 'loading') return;
    
    if (!session?.user?.id) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/user/profile');
      
      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const data = await response.json();
      setUser(data);
    } catch (err) {
      console.error('Error in useCurrentUser:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [session, status]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const refetch = async () => {
    await fetchUser();
  };

  const needsProfileSetup = !loading && !!user && (!user.department_id || !user.business_unit_id);

  return {
    user,
    session,
    loading: loading || status === 'loading',
    error,
    isAuthenticated: !!session,
    role: user?.role || session?.user?.role,
    needsProfileSetup,
    refetch,
  };
}
