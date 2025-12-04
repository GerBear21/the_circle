import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface AppUser {
  id: string;
  organization_id: string;
  workspace_id: string | null;
  azure_oid: string;
  email: string;
  display_name: string | null;
  role: string;
  created_at: string;
}

export function useCurrentUser() {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUser() {
      if (status === 'loading') return;
      
      if (!session?.user?.id) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('app_users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (fetchError) throw fetchError;
        setUser(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [session, status]);

  return {
    user,
    session,
    loading: loading || status === 'loading',
    error,
    isAuthenticated: !!session,
    role: user?.role || session?.user?.role,
  };
}
