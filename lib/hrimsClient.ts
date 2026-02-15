import { createClient, SupabaseClient } from '@supabase/supabase-js';

const hrimsUrl = process.env.HRIMS_SUPABASE_URL;
const hrimsServiceRoleKey = process.env.HRIMS_SUPABASE_SERVICE_ROLE_KEY;

let hrimsClient: SupabaseClient;

if (hrimsUrl && hrimsServiceRoleKey) {
  hrimsClient = createClient(hrimsUrl, hrimsServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
} else {
  console.warn('Missing HRIMS_SUPABASE_URL or HRIMS_SUPABASE_SERVICE_ROLE_KEY environment variables');
  hrimsClient = null as unknown as SupabaseClient;
}

export { hrimsClient };

// ============================================================================
// HRIMS Data Types
// ============================================================================

export interface HrimsOrganogramPosition {
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
  // Joined fields
  employee?: HrimsEmployee | null;
  department?: HrimsDepartment | null;
  business_unit?: HrimsBusinessUnit | null;
  parent_position?: { id: string; position_title: string } | null;
  children?: HrimsOrganogramPosition[];
}

export interface HrimsEmployee {
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

export interface HrimsDepartment {
  id: string;
  name: string;
  code: string;
  department_head_id: string | null;
  business_unit_id: string;
}

export interface HrimsBusinessUnit {
  id: string;
  name: string;
  code: string;
  type: string;
  is_active: boolean;
}

// ============================================================================
// HRIMS Query Functions (server-side only)
// ============================================================================

/**
 * Fetch the full organogram tree for a business unit
 */
export async function fetchOrganogramPositions(
  businessUnitId?: string
): Promise<HrimsOrganogramPosition[]> {
  if (!hrimsClient) throw new Error('HRIMS client not configured');

  let query = hrimsClient
    .from('organogram_positions')
    .select(`
      id, organization_id, business_unit_id, position_title, position_code,
      grade, level, description, status, parent_position_id, employee_id,
      department_id, sort_order, is_active,
      employees:employee_id (id, first_name, last_name, email, phone, job_title, employee_number, employment_status, manager_id, department_id, business_unit_id, current_position_id),
      departments:department_id (id, name, code, department_head_id, business_unit_id),
      business_units:business_unit_id (id, name, code, type, is_active)
    `)
    .eq('is_active', true)
    .order('level', { ascending: true })
    .order('sort_order', { ascending: true });

  if (businessUnitId) {
    query = query.eq('business_unit_id', businessUnitId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch organogram positions:', error);
    throw new Error(`HRIMS query failed: ${error.message}`);
  }

  return ((data || []) as any[]).map(row => ({
    ...row,
    employee: row.employees || null,
    department: row.departments || null,
    business_unit: row.business_units || null,
  })) as HrimsOrganogramPosition[];
}

/**
 * Build a tree structure from flat organogram positions
 */
export function buildOrganogramTree(
  positions: HrimsOrganogramPosition[]
): HrimsOrganogramPosition[] {
  const positionMap = new Map<string, HrimsOrganogramPosition>();
  const roots: HrimsOrganogramPosition[] = [];

  // Index all positions
  for (const pos of positions) {
    positionMap.set(pos.id, { ...pos, children: [] });
  }

  // Build tree
  for (const pos of positionMap.values()) {
    if (pos.parent_position_id && positionMap.has(pos.parent_position_id)) {
      positionMap.get(pos.parent_position_id)!.children!.push(pos);
    } else {
      roots.push(pos);
    }
  }

  return roots;
}

/**
 * Fetch all active employees from HRIMS
 */
export async function fetchHrimsEmployees(
  businessUnitId?: string
): Promise<HrimsEmployee[]> {
  if (!hrimsClient) throw new Error('HRIMS client not configured');

  let query = hrimsClient
    .from('employees')
    .select('id, first_name, last_name, email, phone, job_title, employee_number, employment_status, manager_id, department_id, business_unit_id, current_position_id')
    .eq('employment_status', 'active')
    .order('last_name', { ascending: true });

  if (businessUnitId) {
    query = query.eq('business_unit_id', businessUnitId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch HRIMS employees:', error);
    throw new Error(`HRIMS query failed: ${error.message}`);
  }

  return (data || []) as HrimsEmployee[];
}

/**
 * Fetch all business units from HRIMS
 */
export async function fetchHrimsBusinessUnits(): Promise<HrimsBusinessUnit[]> {
  if (!hrimsClient) throw new Error('HRIMS client not configured');

  const { data, error } = await hrimsClient
    .from('business_units')
    .select('id, name, code, type, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Failed to fetch HRIMS business units:', error);
    throw new Error(`HRIMS query failed: ${error.message}`);
  }

  return (data || []) as HrimsBusinessUnit[];
}

/**
 * Fetch departments from HRIMS
 */
export async function fetchHrimsDepartments(
  businessUnitId?: string
): Promise<HrimsDepartment[]> {
  if (!hrimsClient) throw new Error('HRIMS client not configured');

  let query = hrimsClient
    .from('departments')
    .select('id, name, code, department_head_id, business_unit_id')
    .order('name', { ascending: true });

  if (businessUnitId) {
    query = query.eq('business_unit_id', businessUnitId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch HRIMS departments:', error);
    throw new Error(`HRIMS query failed: ${error.message}`);
  }

  return (data || []) as HrimsDepartment[];
}

/**
 * Resolve the approval chain from the organogram for a given employee.
 * Walks up the organogram tree from the employee's position to the root,
 * returning the chain of filled positions (with employees) above them.
 */
export async function resolveApprovalChainFromOrganogram(
  employeeEmail: string
): Promise<{ position: HrimsOrganogramPosition; employee: HrimsEmployee }[]> {
  if (!hrimsClient) throw new Error('HRIMS client not configured');

  // 1. Find the employee by email
  const { data: employee, error: empError } = await hrimsClient
    .from('employees')
    .select('id, first_name, last_name, email, job_title, current_position_id, business_unit_id')
    .eq('email', employeeEmail)
    .eq('employment_status', 'active')
    .single();

  if (empError || !employee) {
    console.error('Employee not found in HRIMS:', employeeEmail, empError);
    return [];
  }

  // 2. Find their position in the organogram
  let currentPositionId = employee.current_position_id;

  if (!currentPositionId) {
    // Fallback: find position by employee_id
    const { data: pos } = await hrimsClient
      .from('organogram_positions')
      .select('id, parent_position_id')
      .eq('employee_id', employee.id)
      .eq('is_active', true)
      .single();

    if (!pos) return [];
    currentPositionId = pos.id;
  }

  // 3. Walk up the tree collecting filled positions
  const chain: { position: HrimsOrganogramPosition; employee: HrimsEmployee }[] = [];
  let visitedIds = new Set<string>();

  // Get the current position to find its parent
  const { data: startPos } = await hrimsClient
    .from('organogram_positions')
    .select('id, parent_position_id')
    .eq('id', currentPositionId)
    .single();

  if (!startPos?.parent_position_id) return [];

  let nextParentId: string | null = startPos.parent_position_id;

  while (nextParentId && !visitedIds.has(nextParentId)) {
    visitedIds.add(nextParentId);

    const { data: parentPos } = await hrimsClient
      .from('organogram_positions')
      .select(`
        id, organization_id, business_unit_id, position_title, position_code,
        grade, level, description, status, parent_position_id, employee_id,
        department_id, sort_order, is_active,
        employees:employee_id (id, first_name, last_name, email, phone, job_title, employee_number, employment_status, manager_id, department_id, business_unit_id, current_position_id)
      `)
      .eq('id', nextParentId)
      .eq('is_active', true)
      .single();

    if (!parentPos) break;

    // Only include filled positions (with an employee assigned)
    if (parentPos.status === 'filled' && parentPos.employees) {
      const emp = parentPos.employees as unknown as HrimsEmployee;
      chain.push({
        position: {
          ...parentPos,
          employee: emp,
        } as HrimsOrganogramPosition,
        employee: emp,
      });
    }

    nextParentId = parentPos.parent_position_id;
  }

  return chain;
}

/**
 * Fetch an employee by their email address from HRIMS
 * Returns employee details including department_id, business_unit_id, job_title, etc.
 */
export async function fetchHrimsEmployeeByEmail(
  email: string
): Promise<{
  employee: HrimsEmployee;
  department: HrimsDepartment | null;
  businessUnit: HrimsBusinessUnit | null;
  position: HrimsOrganogramPosition | null;
} | null> {
  if (!hrimsClient) throw new Error('HRIMS client not configured');

  // Find the employee by email
  const { data: employee, error: empError } = await hrimsClient
    .from('employees')
    .select(`
      id, first_name, last_name, email, phone, job_title, employee_number,
      employment_status, manager_id, department_id, business_unit_id, current_position_id
    `)
    .eq('email', email.toLowerCase())
    .eq('employment_status', 'active')
    .single();

  if (empError || !employee) {
    console.log('Employee not found in HRIMS:', email);
    return null;
  }

  // Fetch department if available
  let department: HrimsDepartment | null = null;
  if (employee.department_id) {
    const { data: deptData } = await hrimsClient
      .from('departments')
      .select('id, name, code, department_head_id, business_unit_id')
      .eq('id', employee.department_id)
      .single();
    department = deptData as HrimsDepartment | null;
  }

  // Fetch business unit if available
  let businessUnit: HrimsBusinessUnit | null = null;
  if (employee.business_unit_id) {
    const { data: buData } = await hrimsClient
      .from('business_units')
      .select('id, name, code, type, is_active')
      .eq('id', employee.business_unit_id)
      .single();
    businessUnit = buData as HrimsBusinessUnit | null;
  }

  // Fetch position if available
  let position: HrimsOrganogramPosition | null = null;
  if (employee.current_position_id) {
    const { data: posData } = await hrimsClient
      .from('organogram_positions')
      .select(`
        id, organization_id, business_unit_id, position_title, position_code,
        grade, level, description, status, parent_position_id, employee_id,
        department_id, sort_order, is_active
      `)
      .eq('id', employee.current_position_id)
      .single();
    position = posData as HrimsOrganogramPosition | null;
  }

  return {
    employee: employee as HrimsEmployee,
    department,
    businessUnit,
    position,
  };
}

export async function findEmployeeByPositionTitle(
  positionTitle: string,
  businessUnitId?: string
): Promise<{ position: HrimsOrganogramPosition; employee: HrimsEmployee } | null> {
  if (!hrimsClient) throw new Error('HRIMS client not configured');

  let query = hrimsClient
    .from('organogram_positions')
    .select(`
      id, organization_id, business_unit_id, position_title, position_code,
      grade, level, description, status, parent_position_id, employee_id,
      department_id, sort_order, is_active,
      employees:employee_id (id, first_name, last_name, email, phone, job_title, employee_number, employment_status, manager_id, department_id, business_unit_id, current_position_id)
    `)
    .ilike('position_title', positionTitle)
    .eq('is_active', true)
    .eq('status', 'filled');

  if (businessUnitId) {
    query = query.eq('business_unit_id', businessUnitId);
  }

  const { data, error } = await query.limit(1).single();

  if (error || !data) return null;

  const emp = data.employees as unknown as HrimsEmployee;
  if (!emp) return null;

  return {
    position: { ...data, employee: emp } as HrimsOrganogramPosition,
    employee: emp,
  };
}
