import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { hashDemoPassword } from '@/lib/demoPassword';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { hrimsClient } from '@/lib/hrimsClient';
import { assignRoleToUser, getUserRBACProfile, hasPermission, PERMISSIONS } from '@/lib/rbac';

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const DEMO_EMAIL_DOMAIN = 'rtg.demo';
const DEFAULT_PASSWORD = 'Demo@2026!';

/**
 * DEMO-ONLY endpoint. Creates a complete demo persona in one shot:
 *   1. HRIMS employee + organogram position (so the CAPEX form auto-detects them)
 *   2. app_users row (identity + assignable approver)
 *   3. demo_users login (email + scrypt password)
 *   4. (optional) an RBAC role assignment
 *
 * Hard-gated by DEMO_MODE so it cannot run in production. Additionally gated by
 * RBAC: the caller must hold users.create (and users.assign_roles to assign a
 * role), so a signed-in low-privilege demo user cannot self-provision a new —
 * potentially privileged — account through this endpoint.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!DEMO_MODE) {
    return res.status(403).json({ error: 'Demo mode is not enabled in this environment.' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const orgId = (session.user as any).org_id;
  if (!orgId) {
    return res.status(400).json({ error: 'No organization on session' });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  if (!hrimsClient) {
    return res.status(500).json({ error: 'HRIMS (demo) connection not configured' });
  }

  try {
    const {
      firstName,
      lastName,
      email: emailInput,
      password: passwordInput,
      jobTitle,
      departmentId,
      parentPositionId,
      appRoleId,
    } = req.body || {};

    if (!firstName || !lastName || !jobTitle) {
      return res.status(400).json({ error: 'First name, last name and position title are required.' });
    }

    // Privilege gate (defence in depth, on top of DEMO_MODE). Provisioning a
    // demo persona creates a real, loginable account; assigning a role can grant
    // elevated permissions. Restrict both to callers who already hold those
    // permissions (super admins pass automatically via hasPermission).
    const rbac = await getUserRBACProfile(session.user.id);
    if (!hasPermission(rbac, PERMISSIONS.USERS_CREATE)) {
      return res.status(403).json({ error: 'You do not have permission to create demo accounts.' });
    }
    if (appRoleId && !hasPermission(rbac, PERMISSIONS.USERS_ASSIGN_ROLES)) {
      return res.status(403).json({ error: 'You do not have permission to assign roles to demo accounts.' });
    }

    // Derive email + password (admin can override email)
    const email: string =
      (emailInput && String(emailInput).trim()) ||
      `${String(firstName).trim()[0] || 'x'}${String(lastName).trim()}`
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, '') + `@${DEMO_EMAIL_DOMAIN}`;
    const password: string = (passwordInput && String(passwordInput)) || DEFAULT_PASSWORD;

    // ---- Resolve HRIMS org/business-unit/department context -----------------
    let businessUnitId: string | null = null;
    let hrimsOrgId: string | null = null;
    let resolvedDeptId: string | null = departmentId || null;
    let parentLevel = 0;

    if (parentPositionId) {
      const { data: parent } = await hrimsClient
        .from('organogram_positions')
        .select('id, level, business_unit_id, organization_id, department_id')
        .eq('id', parentPositionId)
        .single();
      if (parent) {
        businessUnitId = parent.business_unit_id;
        hrimsOrgId = parent.organization_id;
        parentLevel = parent.level || 0;
        if (!resolvedDeptId) resolvedDeptId = parent.department_id || null;
      }
    }

    if (resolvedDeptId && !businessUnitId) {
      const { data: dept } = await hrimsClient
        .from('departments')
        .select('id, business_unit_id')
        .eq('id', resolvedDeptId)
        .single();
      if (dept) businessUnitId = dept.business_unit_id;
    }

    // Fallback: first business unit in the demo HRIMS
    if (!businessUnitId) {
      const { data: bu } = await hrimsClient
        .from('business_units')
        .select('id, organization_id')
        .limit(1)
        .single();
      if (!bu) {
        return res.status(400).json({ error: 'HRIMS demo has no business units to attach the employee to.' });
      }
      businessUnitId = bu.id;
      hrimsOrgId = bu.organization_id;
    }

    if (!hrimsOrgId && businessUnitId) {
      const { data: bu } = await hrimsClient
        .from('business_units')
        .select('organization_id')
        .eq('id', businessUnitId)
        .single();
      hrimsOrgId = bu?.organization_id || null;
    }

    // ---- 1. HRIMS employee --------------------------------------------------
    const employeeNumber = `DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { data: employee, error: empErr } = await hrimsClient
      .from('employees')
      .insert({
        organization_id: hrimsOrgId,
        business_unit_id: businessUnitId,
        department_id: resolvedDeptId,
        employee_number: employeeNumber,
        first_name: firstName,
        last_name: lastName,
        email,
        job_title: jobTitle,
        employment_status: 'active',
      })
      .select('id')
      .single();

    if (empErr || !employee) {
      const dup = (empErr?.message || '').toLowerCase().includes('duplicate');
      return res.status(400).json({
        error: dup
          ? `An employee with email ${email} already exists in the demo HRIMS.`
          : `Failed to create HRIMS employee: ${empErr?.message || 'unknown error'}`,
      });
    }

    // ---- 2. HRIMS organogram position --------------------------------------
    const { data: position, error: posErr } = await hrimsClient
      .from('organogram_positions')
      .insert({
        organization_id: hrimsOrgId,
        business_unit_id: businessUnitId,
        department_id: resolvedDeptId,
        position_title: jobTitle,
        level: parentLevel + 1,
        status: 'filled',
        count: 1,
        filled_count: 1,
        parent_position_id: parentPositionId || null,
        employee_id: employee.id,
        is_active: true,
      })
      .select('id')
      .single();

    if (posErr || !position) {
      return res.status(400).json({ error: `Failed to create position: ${posErr?.message || 'unknown error'}` });
    }

    await hrimsClient
      .from('employees')
      .update({ current_position_id: position.id })
      .eq('id', employee.id);

    // ---- 3. app_users -------------------------------------------------------
    const displayName = `${firstName} ${lastName}`.trim();
    const { data: appUser, error: appErr } = await supabaseAdmin
      .from('app_users')
      .upsert(
        {
          organization_id: orgId,
          azure_oid: `demo:${email}`,
          email,
          display_name: displayName,
          role: 'requester',
        },
        { onConflict: 'organization_id,azure_oid' }
      )
      .select('id')
      .single();

    if (appErr || !appUser) {
      return res.status(400).json({ error: `Failed to create app user: ${appErr?.message || 'unknown error'}` });
    }

    // ---- 4. demo_users login ------------------------------------------------
    const passwordHash = await hashDemoPassword(password);
    const { error: duErr } = await supabaseAdmin
      .from('demo_users')
      .upsert(
        { email, password_hash: passwordHash, display_name: displayName, is_active: true },
        { onConflict: 'email' }
      );

    if (duErr) {
      return res.status(400).json({ error: `Failed to create demo login: ${duErr.message}` });
    }

    // ---- 5. optional RBAC role ---------------------------------------------
    if (appRoleId) {
      await assignRoleToUser(appUser.id, appRoleId, session.user.id);
    }

    return res.status(201).json({
      success: true,
      email,
      password,
      displayName,
      positionTitle: jobTitle,
      appUserId: appUser.id,
    });
  } catch (err: any) {
    console.error('Demo create-account error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create demo account' });
  }
}
