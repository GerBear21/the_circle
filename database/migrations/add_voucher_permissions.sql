-- ============================================================
-- Voucher RBAC permissions
-- Adds `vouchers.create` and `vouchers.view_register` and grants
-- them to the super_admin and system_admin system roles.
-- Run AFTER create_rbac_tables.sql + seed_rbac_roles.sql
-- ============================================================

INSERT INTO permissions (code, name, description, category) VALUES
    ('vouchers.create', 'Create Vouchers', 'Raise complimentary voucher requests', 'vouchers'),
    ('vouchers.view_register', 'View Voucher Register', 'View the voucher register / booklet and generation records', 'vouchers')
ON CONFLICT (code) DO NOTHING;

-- Grant both voucher permissions to super_admin and system_admin roles
DO $$
DECLARE
    v_super_admin_role_id UUID;
    v_system_admin_role_id UUID;
BEGIN
    SELECT id INTO v_super_admin_role_id FROM roles WHERE slug = 'super_admin' LIMIT 1;
    SELECT id INTO v_system_admin_role_id FROM roles WHERE slug = 'system_admin' LIMIT 1;

    IF v_super_admin_role_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_super_admin_role_id, p.id FROM permissions p
        WHERE p.code IN ('vouchers.create', 'vouchers.view_register')
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    IF v_system_admin_role_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_system_admin_role_id, p.id FROM permissions p
        WHERE p.code IN ('vouchers.create', 'vouchers.view_register')
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;
END $$;
