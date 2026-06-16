import { supabaseAdmin } from './supabaseAdmin';
import { getUserRBACProfile, hasPermission, UserRBACProfile } from './rbac';
import { fetchHrimsEmployeeByEmail } from './hrimsClient';

// ============================================================
// Data-access scope resolution
// ============================================================
// Determines how much of the organization's DATA a user can see,
// independent of what ACTIONS they can perform (permissions).
//
//   own            → only records they created / champion
//   department     → their department (within their home business unit)
//   business_unit  → their home business unit (the default)
//   custom         → an explicit list of business units
//   organization   → everything
//
// Resolution order:
//   1. Super admin or `data.view_organization` permission → organization
//   2. user_access_scopes row (admin-managed)
//   3. Default: business_unit (falls back to organization for users
//      with no business unit on their profile, e.g. legacy accounts)
// ============================================================

export type ScopeLevel = 'own' | 'department' | 'business_unit' | 'custom' | 'organization';

export interface AccessScope {
  level: ScopeLevel;
  isOrgWide: boolean;
  /** Allowed business-unit ids ([] when org-wide). */
  businessUnitIds: string[];
  /** Allowed business-unit names — most tables store the BU as a name string. */
  businessUnitNames: string[];
  /** Department restriction (only set for level='department'). */
  departmentId: string | null;
  departmentName: string | null;
  homeBusinessUnitId: string | null;
  homeBusinessUnitName: string | null;
  /** Human-readable description for UI banners, e.g. "Rainbow Towers Hotel". */
  label: string;
}

const ORG_WIDE: Omit<AccessScope, 'homeBusinessUnitId' | 'homeBusinessUnitName'> = {
  level: 'organization',
  isOrgWide: true,
  businessUnitIds: [],
  businessUnitNames: [],
  departmentId: null,
  departmentName: null,
  label: 'Entire organization',
};

export async function getUserAccessScope(
  userId: string,
  profile?: UserRBACProfile
): Promise<AccessScope> {
  const rbac = profile || (await getUserRBACProfile(userId));

  // Resolve the user's home business unit / department. The source of truth is
  // HRIMS (looked up by email); the_circle's own app_users columns are a
  // fallback for accounts not present in HRIMS.
  const { data: userRow } = await supabaseAdmin
    .from('app_users')
    .select(`
      id, email, business_unit_id, department_id,
      business_unit:business_units!app_users_business_unit_id_fkey ( id, name ),
      department:departments!app_users_department_id_fkey ( id, name )
    `)
    .eq('id', userId)
    .maybeSingle();

  let homeBu = (userRow as any)?.business_unit || null;
  let homeDept = (userRow as any)?.department || null;

  const email = (userRow as any)?.email;
  if (email) {
    try {
      const hrims = await fetchHrimsEmployeeByEmail(email);
      if (hrims?.businessUnit?.name) {
        homeBu = { id: hrims.businessUnit.id, name: hrims.businessUnit.name };
      }
      if (hrims?.department?.name) {
        homeDept = { id: hrims.department.id, name: hrims.department.name };
      }
    } catch (err) {
      console.error('[accessScope] HRIMS lookup failed, using local fallback:', err);
    }
  }

  const home = {
    homeBusinessUnitId: homeBu?.id ?? null,
    homeBusinessUnitName: homeBu?.name ?? null,
  };

  if (rbac.is_super_admin || hasPermission(rbac, 'data.view_organization')) {
    return { ...ORG_WIDE, ...home };
  }

  const { data: scopeRow } = await supabaseAdmin
    .from('user_access_scopes')
    .select('id, scope_level')
    .eq('user_id', userId)
    .maybeSingle();

  const level: ScopeLevel = (scopeRow?.scope_level as ScopeLevel) || 'business_unit';

  if (level === 'organization') {
    return { ...ORG_WIDE, ...home };
  }

  if (level === 'own') {
    return {
      level,
      isOrgWide: false,
      businessUnitIds: [],
      businessUnitNames: [],
      departmentId: null,
      departmentName: null,
      ...home,
      label: 'Your own records',
    };
  }

  if (level === 'custom' && scopeRow) {
    const { data: buRows } = await supabaseAdmin
      .from('user_scope_business_units')
      .select('business_unit_name')
      .eq('scope_id', scopeRow.id);
    const names = (buRows || [])
      .map((r: any) => r.business_unit_name)
      .filter((n: any) => typeof n === 'string' && n.trim().length > 0) as string[];
    if (names.length > 0) {
      return {
        level,
        isOrgWide: false,
        businessUnitIds: [],
        businessUnitNames: names,
        departmentId: null,
        departmentName: null,
        ...home,
        label: names.join(', '),
      };
    }
    // Custom scope with no units selected — fall through to home BU
  }

  if (level === 'department') {
    return {
      level,
      isOrgWide: false,
      businessUnitIds: homeBu ? [homeBu.id] : [],
      businessUnitNames: homeBu ? [homeBu.name] : [],
      departmentId: homeDept?.id ?? null,
      departmentName: homeDept?.name ?? null,
      ...home,
      label: homeDept?.name
        ? `${homeDept.name} department${homeBu?.name ? ` · ${homeBu.name}` : ''}`
        : 'Your department',
    };
  }

  // business_unit (default)
  if (!homeBu) {
    // No BU on the profile (legacy/admin accounts) — restricting would hide
    // everything, so treat as org-wide rather than break their workflow.
    return { ...ORG_WIDE, ...home, label: 'Entire organization (no business unit on profile)' };
  }

  return {
    level: 'business_unit',
    isOrgWide: false,
    businessUnitIds: [homeBu.id],
    businessUnitNames: [homeBu.name],
    departmentId: null,
    departmentName: null,
    ...home,
    label: homeBu.name,
  };
}

// ------------------------------------------------------------
// Row filtering helper
// ------------------------------------------------------------
// Matches rows against a scope using name-based BU/department fields
// (most tables denormalise these as text). A row is visible when:
//   - the scope is org-wide, or
//   - the user owns the row (ownerField), or
//   - the row's business unit is in the allowed list
//     (+ department match when the scope is department-level)
// Rows with no business unit set are only visible org-wide or to
// their owner — fail closed, not open.
export function rowVisibleInScope(
  row: Record<string, any>,
  scope: AccessScope,
  userId: string,
  fields: { businessUnit?: string; department?: string; owners?: string[] }
): boolean {
  if (scope.isOrgWide) return true;

  const owners = fields.owners || [];
  for (const f of owners) {
    if (row[f] && row[f] === userId) return true;
  }

  if (scope.level === 'own') return false;

  const buNames = scope.businessUnitNames.map(n => n.toLowerCase());
  const rowBu = fields.businessUnit ? String(row[fields.businessUnit] || '').trim().toLowerCase() : '';
  const buMatch = rowBu !== '' && buNames.includes(rowBu);

  if (scope.level === 'department') {
    const deptName = (scope.departmentName || '').toLowerCase();
    const rowDept = fields.department ? String(row[fields.department] || '').trim().toLowerCase() : '';
    // Department scope: department must match; BU must also match when both sides have one.
    if (deptName === '' || rowDept === '') return false;
    if (rowDept !== deptName) return false;
    if (rowBu !== '' && buNames.length > 0 && !buMatch) return false;
    return true;
  }

  return buMatch;
}

/** Serializable scope summary for API responses / the UI banner. */
export function scopeForResponse(scope: AccessScope) {
  return {
    level: scope.level,
    isOrgWide: scope.isOrgWide,
    businessUnits: scope.businessUnitNames,
    department: scope.departmentName,
    label: scope.label,
  };
}
