-- ============================================================
-- ASSIGN RBAC roles to specific users
-- Run AFTER seed_rbac_roles.sql
-- ============================================================

DO $$
DECLARE
    v_org_id UUID;
    v_super_admin_role_id UUID;
    v_system_admin_role_id UUID;
    v_auditor_role_id UUID;
    v_employee_role_id UUID;
    v_user_id UUID;
BEGIN
    -- Get RTG organization
    SELECT id INTO v_org_id FROM organizations WHERE name ILIKE '%rainbow%' OR name ILIKE '%RTG%' LIMIT 1;
    IF v_org_id IS NULL THEN
        SELECT id INTO v_org_id FROM organizations LIMIT 1;
    END IF;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found.';
    END IF;

    -- Get role IDs
    SELECT id INTO v_super_admin_role_id FROM roles WHERE organization_id = v_org_id AND slug = 'super_admin';
    SELECT id INTO v_system_admin_role_id FROM roles WHERE organization_id = v_org_id AND slug = 'system_admin';
    SELECT id INTO v_auditor_role_id FROM roles WHERE organization_id = v_org_id AND slug = 'auditor';
    SELECT id INTO v_employee_role_id FROM roles WHERE organization_id = v_org_id AND slug = 'employee';

    -- ============================================================
    -- 1. Geraldine.ndoro@rtg.co.zw → Super Admin
    -- ============================================================
    SELECT id INTO v_user_id FROM app_users WHERE LOWER(email) = LOWER('Geraldine.ndoro@rtg.co.zw') AND organization_id = v_org_id;
    IF v_user_id IS NOT NULL AND v_super_admin_role_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_user_id AND role_id = v_super_admin_role_id) THEN
            INSERT INTO user_roles (user_id, role_id) VALUES (v_user_id, v_super_admin_role_id);
        END IF;
        RAISE NOTICE 'Assigned Super Admin to Geraldine.ndoro@rtg.co.zw (user_id: %)', v_user_id;
    ELSE
        RAISE NOTICE 'SKIPPED Geraldine.ndoro@rtg.co.zw — user_id: %, role_id: %', v_user_id, v_super_admin_role_id;
    END IF;

    -- ============================================================
    -- 2. admin@rtg.co.zw → System Admin
    -- ============================================================
    SELECT id INTO v_user_id FROM app_users WHERE LOWER(email) = LOWER('admin@rtg.co.zw') AND organization_id = v_org_id;
    IF v_user_id IS NOT NULL AND v_system_admin_role_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_user_id AND role_id = v_system_admin_role_id) THEN
            INSERT INTO user_roles (user_id, role_id) VALUES (v_user_id, v_system_admin_role_id);
        END IF;
        RAISE NOTICE 'Assigned System Admin to admin@rtg.co.zw (user_id: %)', v_user_id;
    ELSE
        RAISE NOTICE 'SKIPPED admin@rtg.co.zw — user_id: %, role_id: %', v_user_id, v_system_admin_role_id;
    END IF;

    -- ============================================================
    -- 3. atlas@rtg.co.zw → Auditor
    -- ============================================================
    SELECT id INTO v_user_id FROM app_users WHERE LOWER(email) = LOWER('atlas@rtg.co.zw') AND organization_id = v_org_id;
    IF v_user_id IS NOT NULL AND v_auditor_role_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_user_id AND role_id = v_auditor_role_id) THEN
            INSERT INTO user_roles (user_id, role_id) VALUES (v_user_id, v_auditor_role_id);
        END IF;
        RAISE NOTICE 'Assigned Auditor to atlas@rtg.co.zw (user_id: %)', v_user_id;
    ELSE
        RAISE NOTICE 'SKIPPED atlas@rtg.co.zw — user_id: %, role_id: %', v_user_id, v_auditor_role_id;
    END IF;

    -- ============================================================
    -- 4. kudakwashe.moyo@rtg.co.zw → Employee
    -- ============================================================
    SELECT id INTO v_user_id FROM app_users WHERE LOWER(email) = LOWER('kudakwashe.moyo@rtg.co.zw') AND organization_id = v_org_id;
    IF v_user_id IS NOT NULL AND v_employee_role_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_user_id AND role_id = v_employee_role_id) THEN
            INSERT INTO user_roles (user_id, role_id) VALUES (v_user_id, v_employee_role_id);
        END IF;
        RAISE NOTICE 'Assigned Employee to kudakwashe.moyo@rtg.co.zw (user_id: %)', v_user_id;
    ELSE
        RAISE NOTICE 'SKIPPED kudakwashe.moyo@rtg.co.zw — user_id: %, role_id: %', v_user_id, v_employee_role_id;
    END IF;

    RAISE NOTICE 'User role assignments complete.';
END $$;
