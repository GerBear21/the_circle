-- ============================================================
-- SEED: Core RBAC Roles (Super Admin, System Admin, Auditor)
-- Run AFTER create_rbac_tables.sql
-- ============================================================

-- We need to reference the organization. Use the RTG org.
DO $$
DECLARE
    v_org_id UUID;
    v_super_admin_role_id UUID;
    v_system_admin_role_id UUID;
    v_auditor_role_id UUID;
    v_employee_role_id UUID;
BEGIN
    -- Get RTG organization
    SELECT id INTO v_org_id FROM organizations WHERE name ILIKE '%rainbow%' OR name ILIKE '%RTG%' LIMIT 1;
    
    -- Fallback: get any organization
    IF v_org_id IS NULL THEN
        SELECT id INTO v_org_id FROM organizations LIMIT 1;
    END IF;
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found. Please create an organization first.';
    END IF;

    -- ============================================================
    -- 1. SUPER ADMIN — full access to everything
    -- ============================================================
    INSERT INTO roles (organization_id, name, slug, description, color, is_system, is_default, priority)
    VALUES (v_org_id, 'Super Admin', 'super_admin', 
        'Unrestricted access to the entire system. Can manage all settings, users, roles, forms, workflows, reports, and audit logs across all departments and business units.',
        'red', true, false, 100)
    ON CONFLICT (organization_id, slug) DO UPDATE SET 
        name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color, priority = EXCLUDED.priority, updated_at = now()
    RETURNING id INTO v_super_admin_role_id;

    -- Super Admin gets ALL permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_super_admin_role_id, p.id FROM permissions p
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- ============================================================
    -- 2. SYSTEM ADMIN — manage rates, forms, workflows, access rights, SLA, delegation
    -- ============================================================
    INSERT INTO roles (organization_id, name, slug, description, color, is_system, is_default, priority)
    VALUES (v_org_id, 'System Admin', 'system_admin',
        'Manages travel form rates, form design, workflow customization, user access rights, SLA configuration, and approval delegation. Can grant certain rights to other users.',
        'purple', true, false, 90)
    ON CONFLICT (organization_id, slug) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color, priority = EXCLUDED.priority, updated_at = now()
    RETURNING id INTO v_system_admin_role_id;

    -- System Admin permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_system_admin_role_id, p.id FROM permissions p
    WHERE p.code IN (
        -- Requests (own + view all for oversight)
        'requests.create', 'requests.view_own', 'requests.view_all', 'requests.edit_own', 'requests.withdraw',
        -- Approvals (full management including delegation config)
        'approvals.view', 'approvals.approve', 'approvals.reject', 'approvals.delegate',
        'approvals.override', 'approvals.reassign', 'approvals.configure_delegation',
        -- Users (full user management + access rights)
        'users.view', 'users.create', 'users.edit', 'users.deactivate',
        'users.assign_roles', 'users.manage_access',
        -- Settings (workflows, templates, integrations, SLA)
        'settings.view', 'settings.edit', 'settings.workflows', 'settings.templates',
        'settings.integrations', 'settings.sla',
        -- Forms (design, rates, publish)
        'forms.design', 'forms.edit_rates', 'forms.publish', 'forms.archive',
        -- Reports (all)
        'reports.view_own', 'reports.view_team', 'reports.view_all', 'reports.export',
        'reports.sla_compliance', 'reports.analytics',
        -- Admin (roles, permissions, audit)
        'admin.roles', 'admin.permissions', 'admin.audit_logs',
        -- Archives
        'archives.view_own', 'archives.view_all', 'archives.download', 'archives.manage'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- ============================================================
    -- 3. AUDITOR — read-only analytics, insights, SLA compliance, logs, reports, audit trail
    -- ============================================================
    INSERT INTO roles (organization_id, name, slug, description, color, is_system, is_default, priority)
    VALUES (v_org_id, 'Auditor', 'auditor',
        'Read-only access to analytics, insights, SLA compliance statistics, system logs, reports, and full audit trail. Cannot modify any data.',
        'indigo', true, false, 50)
    ON CONFLICT (organization_id, slug) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color, priority = EXCLUDED.priority, updated_at = now()
    RETURNING id INTO v_auditor_role_id;

    -- Auditor permissions (read-only)
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_auditor_role_id, p.id FROM permissions p
    WHERE p.code IN (
        'requests.view_all',
        'approvals.view',
        'users.view',
        'settings.view',
        'reports.view_all', 'reports.export', 'reports.sla_compliance', 'reports.analytics',
        'admin.audit_logs',
        'archives.view_all', 'archives.download'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- ============================================================
    -- 4. EMPLOYEE (default role for all users)
    -- ============================================================
    INSERT INTO roles (organization_id, name, slug, description, color, is_system, is_default, priority)
    VALUES (v_org_id, 'Employee', 'employee',
        'Standard role for all employees. Can create and track their own requests, view own reports.',
        'gray', true, true, 10)
    ON CONFLICT (organization_id, slug) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color, priority = EXCLUDED.priority, updated_at = now()
    RETURNING id INTO v_employee_role_id;

    -- Employee permissions (basic)
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_employee_role_id, p.id FROM permissions p
    WHERE p.code IN (
        'requests.create', 'requests.view_own', 'requests.edit_own', 'requests.withdraw',
        'approvals.view', 'approvals.approve', 'approvals.reject',
        'users.view',
        'reports.view_own',
        'archives.view_own', 'archives.download'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    RAISE NOTICE 'RBAC roles seeded successfully. Super Admin: %, System Admin: %, Auditor: %, Employee: %',
        v_super_admin_role_id, v_system_admin_role_id, v_auditor_role_id, v_employee_role_id;
END $$;
