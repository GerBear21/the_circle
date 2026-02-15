import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// ============================================================================
// Types (client-side mirrors of HRIMS data)
// ============================================================================

export interface OrganogramPosition {
  id: string;
  organization_id: string;
  business_unit_id: string;
  position_title: string;
  position_code: string | null;
  grade: string | null;
  level: number;
  description: string | null;
  status: 'vacant' | 'filled' | 'frozen';
  parent_position_id: string | null;
  employee_id: string | null;
  department_id: string | null;
  sort_order: number;
  is_active: boolean;
  employee?: OrganogramEmployee | null;
  department?: OrganogramDepartment | null;
  business_unit?: OrganogramBusinessUnit | null;
  children?: OrganogramPosition[];
}

export interface OrganogramEmployee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  employee_number: string;
  employment_status: string;
  manager_id: string | null;
  department_id: string | null;
  business_unit_id: string;
  current_position_id: string | null;
}

export interface OrganogramDepartment {
  id: string;
  name: string;
  code: string;
  department_head_id: string | null;
  business_unit_id: string;
}

export interface OrganogramBusinessUnit {
  id: string;
  name: string;
  code: string;
  type: string;
  is_active: boolean;
}

export interface ApprovalChainItem {
  position_id: string;
  position_title: string;
  position_level: number;
  position_grade: string | null;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  employee_job_title: string | null;
}

// ============================================================================
// Hook: useHrimsOrganogram
// ============================================================================

export function useHrimsOrganogram(options?: {
  businessUnitId?: string;
  asTree?: boolean;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const [positions, setPositions] = useState<OrganogramPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrganogram = useCallback(async () => {
    if (sessionStatus === 'loading') return;
    if (!session?.user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (options?.businessUnitId) params.append('business_unit_id', options.businessUnitId);
      if (options?.asTree) params.append('tree', 'true');

      const url = `/api/hrims/organogram${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch organogram');
      }

      const data = await response.json();
      setPositions(data.organogram || data.positions || []);
    } catch (err) {
      console.error('Error fetching organogram:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [session?.user, sessionStatus, options?.businessUnitId, options?.asTree]);

  useEffect(() => {
    fetchOrganogram();
  }, [fetchOrganogram]);

  return {
    positions,
    loading: loading || sessionStatus === 'loading',
    error,
    refetch: fetchOrganogram,
  };
}

// ============================================================================
// Hook: useHrimsEmployees
// ============================================================================

export function useHrimsEmployees(businessUnitId?: string) {
  const { data: session, status: sessionStatus } = useSession();
  const [employees, setEmployees] = useState<OrganogramEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEmployees = useCallback(async () => {
    if (sessionStatus === 'loading') return;
    if (!session?.user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (businessUnitId) params.append('business_unit_id', businessUnitId);

      const url = `/api/hrims/employees${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch employees');
      }

      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (err) {
      console.error('Error fetching HRIMS employees:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [session?.user, sessionStatus, businessUnitId]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  return {
    employees,
    loading: loading || sessionStatus === 'loading',
    error,
    refetch: fetchEmployees,
  };
}

// ============================================================================
// Hook: useHrimsBusinessUnits
// ============================================================================

export function useHrimsBusinessUnits() {
  const { data: session, status: sessionStatus } = useSession();
  const [businessUnits, setBusinessUnits] = useState<OrganogramBusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBusinessUnits = useCallback(async () => {
    if (sessionStatus === 'loading') return;
    if (!session?.user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/hrims/business-units');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch business units');
      }

      const data = await response.json();
      setBusinessUnits(data.businessUnits || []);
    } catch (err) {
      console.error('Error fetching HRIMS business units:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [session?.user, sessionStatus]);

  useEffect(() => {
    fetchBusinessUnits();
  }, [fetchBusinessUnits]);

  return {
    businessUnits,
    loading: loading || sessionStatus === 'loading',
    error,
    refetch: fetchBusinessUnits,
  };
}

// ============================================================================
// Hook: useHrimsDepartments
// ============================================================================

export function useHrimsDepartments(businessUnitId?: string) {
  const { data: session, status: sessionStatus } = useSession();
  const [departments, setDepartments] = useState<OrganogramDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDepartments = useCallback(async () => {
    if (sessionStatus === 'loading') return;
    if (!session?.user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (businessUnitId) params.append('business_unit_id', businessUnitId);

      const url = `/api/hrims/departments${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch departments');
      }

      const data = await response.json();
      setDepartments(data.departments || []);
    } catch (err) {
      console.error('Error fetching HRIMS departments:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [session?.user, sessionStatus, businessUnitId]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  return {
    departments,
    loading: loading || sessionStatus === 'loading',
    error,
    refetch: fetchDepartments,
  };
}

// ============================================================================
// Hook: useHrimsApprovalChain
// ============================================================================

export function useHrimsApprovalChain(employeeEmail?: string) {
  const { data: session, status: sessionStatus } = useSession();
  const [chain, setChain] = useState<ApprovalChainItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchChain = useCallback(async (email?: string) => {
    const targetEmail = email || employeeEmail;
    if (sessionStatus === 'loading') return;
    if (!session?.user || !targetEmail) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({ email: targetEmail });
      const response = await fetch(`/api/hrims/approval-chain?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch approval chain');
      }

      const data = await response.json();
      setChain(data.chain || []);
    } catch (err) {
      console.error('Error fetching approval chain:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [session?.user, sessionStatus, employeeEmail]);

  useEffect(() => {
    if (employeeEmail) {
      fetchChain();
    }
  }, [fetchChain, employeeEmail]);

  return {
    chain,
    loading: loading || sessionStatus === 'loading',
    error,
    fetchChain,
    refetch: fetchChain,
  };
}
