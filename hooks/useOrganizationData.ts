import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface Organization {
  id: string;
  name: string;
}

interface Department {
  id: string;
  organization_id: string;
  name: string;
  code: string;
}

interface BusinessUnit {
  id: string;
  organization_id: string;
  name: string;
}

export function useOrganizationData(organizationId?: string) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (!isSupabaseConfigured) {
        if (isMounted) {
          setError(new Error('Supabase is not configured. Please check your environment variables.'));
          setLoading(false);
        }
        return;
      }

      if (isMounted) setLoading(true);
      
      try {
        // Fetch organizations from Supabase
        const { data: orgsData, error: orgsError } = await supabase
          .from('organizations')
          .select('id, name')
          .order('name');

        if (orgsError) throw orgsError;
        if (isMounted) setOrganizations(orgsData || []);

        // If organizationId is provided, fetch departments and business units
        if (organizationId) {
          // Fetch departments from Supabase
          const { data: deptData, error: deptError } = await supabase
            .from('departments')
            .select('id, organization_id, name, code')
            .eq('organization_id', organizationId)
            .order('name');

          if (deptError) throw deptError;
          if (isMounted) setDepartments(deptData || []);

          // Fetch business units from API (bypasses RLS)
          const buResponse = await fetch('/api/business-units');
          if (buResponse.ok) {
            const buData = await buResponse.json();
            if (isMounted) setBusinessUnits(buData.businessUnits || []);
          } else {
            if (isMounted) setBusinessUnits([]);
          }
        } else {
          // Reset when no organizationId
          if (isMounted) {
            setDepartments([]);
            setBusinessUnits([]);
          }
        }
      } catch (err) {
        if (isMounted) setError(err as Error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [organizationId]);

  return {
    organizations,
    departments,
    businessUnits,
    loading,
    error,
  };
}
