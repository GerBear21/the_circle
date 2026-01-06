import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

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
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch organizations
        const { data: orgsData, error: orgsError } = await supabase
          .from('organizations')
          .select('id, name')
          .order('name');

        if (orgsError) throw orgsError;
        setOrganizations(orgsData || []);

        // If organizationId is provided, fetch departments and business units for that org
        if (organizationId) {
          const [deptResult, buResult] = await Promise.all([
            supabase
              .from('departments')
              .select('id, organization_id, name, code')
              .eq('organization_id', organizationId)
              .order('name'),
            supabase
              .from('business_units')
              .select('id, organization_id, name')
              .eq('organization_id', organizationId)
              .order('name')
          ]);

          if (deptResult.error) throw deptResult.error;
          if (buResult.error) throw buResult.error;

          setDepartments(deptResult.data || []);
          setBusinessUnits(buResult.data || []);
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [organizationId]);

  return {
    organizations,
    departments,
    businessUnits,
    loading,
    error,
  };
}
