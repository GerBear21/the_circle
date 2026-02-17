import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface Organization {
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
  profile_picture_url: string | null;
  signature_url: string | null;
  // HRIMS-sourced fields
  hrims_employee_id?: string | null;
  job_title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  organization?: Organization;
}

interface UserContextType {
  user: AppUser | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateProfilePicture: (url: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasFetchedRef = useRef(false);

  // Use session user id as stable dependency instead of entire session object
  const sessionUserId = session?.user?.id;

  const fetchUser = useCallback(async () => {
    if (status === 'loading') return;
    
    if (!sessionUserId) {
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
      console.error('Error in UserContext:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [sessionUserId, status]);

  useEffect(() => {
    // Prevent duplicate fetches
    if (status === 'loading') return;
    if (hasFetchedRef.current && user) return;
    
    fetchUser();
    hasFetchedRef.current = true;
  }, [fetchUser, status, user]);

  const refetch = async () => {
    await fetchUser();
  };

  // Optimistically update profile picture URL without refetching
  const updateProfilePicture = (url: string) => {
    if (user) {
      setUser({ ...user, profile_picture_url: url });
    }
  };

  return (
    <UserContext.Provider value={{ user, loading, error, refetch, updateProfilePicture }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
}
