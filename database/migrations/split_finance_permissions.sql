-- ============================================================
-- Split finance permissions per page
-- ============================================================
-- Previously every finance page gated on a single permission
-- (finance.view_tracker), so granting "view CAPEX tracker" exposed
-- every finance page. Each page now has its own permission.
-- ============================================================
INSERT INTO permissions (code, name, description, category) VALUES
    ('finance.view_suppliers',     'View Supplier Records',   'View the supplier records / supplier payments page',     'finance'),
    ('finance.view_cash_receipts', 'View Cash Receipts',      'View the petty-cash cash-receipt confirmations page',    'finance'),
    ('finance.view_exceptions',    'View Exception Reports',  'View the finance exception reports page',                'finance'),
    ('finance.view_reports',       'View Financial Reports',  'View the financial reports / analytics page',            'finance')
ON CONFLICT (code) DO NOTHING;

-- Preserve existing behaviour for ROLES that hold finance.view_tracker
-- (super admin, finance admin, system admin keep full finance access).
-- NOTE: deliberately NOT backfilling per-user overrides — a user granted only
-- finance.view_tracker must see only the CAPEX tracker.
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM role_permissions rp
JOIN permissions tracker ON tracker.id = rp.permission_id AND tracker.code = 'finance.view_tracker'
CROSS JOIN permissions p
WHERE p.code IN ('finance.view_suppliers', 'finance.view_cash_receipts', 'finance.view_exceptions', 'finance.view_reports')
ON CONFLICT (role_id, permission_id) DO NOTHING;
