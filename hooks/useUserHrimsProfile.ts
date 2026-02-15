import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface HrimsUserProfile {
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    job_title: string | null;
    department_id: string | null;
    business_unit_id: string;
  } | null;
  department: {
    id: string;
    name: string;
    code: string;
  } | null;
  businessUnit: {
    id: string;
    name: string;
    code: string;
  } | null;
  position: {
    id: string;
    position_title: string;
    grade: string | null;
    level: number;
  } | null;
  found: boolean;
}

export function useUserHrimsProfile() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<HrimsUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (!session?.user?.email) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/hrims/employee-by-email?email=${encodeURIComponent(session.user.email)}`);
        const data = await response.json();

        if (response.ok && data.found) {
          setProfile({
            employee: data.employee,
            department: data.department,
            businessUnit: data.businessUnit,
            position: data.position,
            found: true,
          });
        } else {
          setProfile({
            employee: null,
            department: null,
            businessUnit: null,
            position: null,
            found: false,
          });
        }
      } catch (err) {
        console.error('Error fetching HRIMS profile:', err);
        setError(err as Error);
        setProfile({
          employee: null,
          department: null,
          businessUnit: null,
          position: null,
          found: false,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [session?.user?.email]);

  return {
    profile,
    loading,
    error,
    departmentName: profile?.department?.name || null,
    businessUnitName: profile?.businessUnit?.name || null,
    jobTitle: profile?.employee?.job_title || null,
    positionTitle: profile?.position?.position_title || null,
  };
}
