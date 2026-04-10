import { useSession } from 'next-auth/react';
import { useUserContext } from '../contexts/UserContext';

export function useCurrentUser() {
  const { data: session, status } = useSession();
  const { user, loading: contextLoading, error, refetch, updateProfilePicture } = useUserContext();

  // User needs profile setup if missing department/business unit OR missing PIN setup
  const needsProfileSetup = !contextLoading && !!user && (!user.department_id || !user.business_unit_id);
  const needsPinSetup = !contextLoading && !!user && !user.pin_setup_completed;

  return {
    user,
    session,
    loading: contextLoading || status === 'loading',
    error,
    isAuthenticated: !!session,
    role: user?.role || session?.user?.role,
    needsProfileSetup,
    needsPinSetup,
    refetch,
    updateProfilePicture,
  };
}
