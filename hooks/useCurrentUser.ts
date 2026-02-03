import { useSession } from 'next-auth/react';
import { useUserContext } from '../contexts/UserContext';

export function useCurrentUser() {
  const { data: session, status } = useSession();
  const { user, loading: contextLoading, error, refetch, updateProfilePicture } = useUserContext();

  const needsProfileSetup = !contextLoading && !!user && (!user.department_id || !user.business_unit_id);

  return {
    user,
    session,
    loading: contextLoading || status === 'loading',
    error,
    isAuthenticated: !!session,
    role: user?.role || session?.user?.role,
    needsProfileSetup,
    refetch,
    updateProfilePicture,
  };
}
