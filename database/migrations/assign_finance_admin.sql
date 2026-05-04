-- ============================================================
-- TEMPLATE: Assign the Finance Admin role to specific users
-- Run AFTER create_capex_tracker.sql
--
-- Usage: edit the email addresses below to match the real users
-- at your organization, then run this file. The DO block is
-- idempotent — running it again will not duplicate assignments.
-- ============================================================

DO $$
DECLARE
    v_org_id UUID;
    v_finance_admin_role_id UUID;
    v_user_id UUID;
BEGIN
    -- Locate the organization (matches seed_rbac_roles.sql pattern)
    SELECT id INTO v_org_id FROM organizations WHERE name ILIKE '%rainbow%' OR name ILIKE '%RTG%' LIMIT 1;
    IF v_org_id IS NULL THEN
        SELECT id INTO v_org_id FROM organizations LIMIT 1;
    END IF;
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found.';
    END IF;

    SELECT id INTO v_finance_admin_role_id
    FROM roles
    WHERE organization_id = v_org_id AND slug = 'finance_admin';

    IF v_finance_admin_role_id IS NULL THEN
        RAISE EXCEPTION 'finance_admin role not found. Run create_capex_tracker.sql first.';
    END IF;

    -- ========================================================
    -- EDIT BELOW: replace example emails with the real users
    -- who should receive the Finance Admin role.
    -- Copy the block as many times as needed.
    -- ========================================================

    -- Example 1 — uncomment and replace the email to use:
    -- SELECT id INTO v_user_id FROM app_users
    --   WHERE LOWER(email) = LOWER('finance.lead@example.com')
    --   AND organization_id = v_org_id;
    -- IF v_user_id IS NOT NULL THEN
    --     IF NOT EXISTS (
    --         SELECT 1 FROM user_roles
    --         WHERE user_id = v_user_id AND role_id = v_finance_admin_role_id
    --     ) THEN
    --         INSERT INTO user_roles (user_id, role_id)
    --         VALUES (v_user_id, v_finance_admin_role_id);
    --     END IF;
    --     RAISE NOTICE 'Assigned Finance Admin to finance.lead@example.com (user_id: %)', v_user_id;
    -- ELSE
    --     RAISE NOTICE 'SKIPPED finance.lead@example.com - user not found in org %', v_org_id;
    -- END IF;

    RAISE NOTICE 'Finance Admin assignment complete.';
END $$;
