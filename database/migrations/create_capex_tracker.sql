-- ============================================================
-- CAPEX Tracker Module
-- Creates: capex_tracker, capex_budgets, finance_admin role,
--          finance permissions, storage bucket, and seed data
-- Run AFTER create_rbac_tables.sql and seed_rbac_roles.sql
-- ============================================================

-- ============================================================
-- 1. TABLE: capex_tracker
-- ============================================================
CREATE TABLE IF NOT EXISTS capex_tracker (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- request_id is NULLABLE so legacy/seed entries predating the system
    -- can still live on the tracker without a linked request
    request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ranking INTEGER,
    supplier TEXT,
    description TEXT NOT NULL,
    capex_date DATE NOT NULL,
    cost NUMERIC(14, 2) NOT NULL CHECK (cost >= 0),
    funded NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (funded >= 0),
    balance NUMERIC(14, 2) GENERATED ALWAYS AS (cost - funded) STORED,
    champion_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    status_update TEXT NOT NULL CHECK (status_update IN (
        'Pending Approval',
        'CAPEX Approval in Progress',
        'CAPEX Approved – Awaiting Funding',
        'Procurement in Progress',
        'Funding Partially Allocated',
        'Fully Funded',
        'Completed',
        'CAPEX Rejected',
        'On Hold'
    )),
    department TEXT,
    financial_year INTEGER NOT NULL,
    is_budgeted BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_updated_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (request_id)
);

CREATE INDEX IF NOT EXISTS idx_capex_tracker_org ON capex_tracker(organization_id);
CREATE INDEX IF NOT EXISTS idx_capex_tracker_request ON capex_tracker(request_id);
CREATE INDEX IF NOT EXISTS idx_capex_tracker_fy ON capex_tracker(financial_year);
CREATE INDEX IF NOT EXISTS idx_capex_tracker_status ON capex_tracker(status_update);
CREATE INDEX IF NOT EXISTS idx_capex_tracker_department ON capex_tracker(department);

ALTER TABLE capex_tracker ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage capex_tracker" ON capex_tracker;
CREATE POLICY "Service role can manage capex_tracker"
    ON capex_tracker FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================
-- 2. TABLE: capex_budgets
-- ============================================================
CREATE TABLE IF NOT EXISTS capex_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    financial_year INTEGER NOT NULL,
    budget_document_path TEXT NOT NULL,
    budget_document_name TEXT,
    total_budget NUMERIC(14, 2),
    is_placeholder BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, financial_year)
);

CREATE INDEX IF NOT EXISTS idx_capex_budgets_org ON capex_budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_capex_budgets_fy ON capex_budgets(financial_year);

ALTER TABLE capex_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage capex_budgets" ON capex_budgets;
CREATE POLICY "Service role can manage capex_budgets"
    ON capex_budgets FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================
-- 3. PERMISSIONS (four finance permissions)
-- ============================================================
INSERT INTO permissions (code, name, description, category) VALUES
    ('finance.view_tracker',   'View CAPEX Tracker',   'View CAPEX tracker entries for the organization',                  'finance'),
    ('finance.edit_tracker',   'Edit CAPEX Tracker',   'Update funded amount and status on CAPEX tracker entries',         'finance'),
    ('finance.view_budget',    'View CAPEX Budget',    'View the annual CAPEX budget and download its document',           'finance'),
    ('finance.manage_budget',  'Manage CAPEX Budget',  'Upload the annual CAPEX budget document (super admin only)',       'finance')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 4. ROLE: finance_admin + permission grants
-- ============================================================
DO $$
DECLARE
    v_org_id UUID;
    v_finance_admin_role_id UUID;
    v_super_admin_role_id UUID;
    v_system_admin_role_id UUID;
BEGIN
    -- Get the organization (mirrors seed_rbac_roles.sql pattern)
    SELECT id INTO v_org_id FROM organizations WHERE name ILIKE '%rainbow%' OR name ILIKE '%RTG%' LIMIT 1;
    IF v_org_id IS NULL THEN
        SELECT id INTO v_org_id FROM organizations LIMIT 1;
    END IF;
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found. Run base org seed first.';
    END IF;

    -- Finance Admin role
    INSERT INTO roles (organization_id, name, slug, description, color, is_system, is_default, priority)
    VALUES (v_org_id, 'Finance Admin', 'finance_admin',
        'Manages the CAPEX Tracker (funding and status updates) and views the annual CAPEX budget. Cannot create, edit, or delete budgets.',
        'emerald', true, false, 70)
    ON CONFLICT (organization_id, slug) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color, priority = EXCLUDED.priority, updated_at = now()
    RETURNING id INTO v_finance_admin_role_id;

    -- Finance Admin: view + edit tracker, view budget (NOT manage)
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_finance_admin_role_id, p.id FROM permissions p
    WHERE p.code IN ('finance.view_tracker', 'finance.edit_tracker', 'finance.view_budget')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- Super Admin: all four finance permissions (grant any missing to existing role)
    SELECT id INTO v_super_admin_role_id FROM roles WHERE organization_id = v_org_id AND slug = 'super_admin';
    IF v_super_admin_role_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_super_admin_role_id, p.id FROM permissions p
        WHERE p.code IN ('finance.view_tracker', 'finance.edit_tracker', 'finance.view_budget', 'finance.manage_budget')
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- System Admin: read-only visibility (view tracker + view budget)
    SELECT id INTO v_system_admin_role_id FROM roles WHERE organization_id = v_org_id AND slug = 'system_admin';
    IF v_system_admin_role_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_system_admin_role_id, p.id FROM permissions p
        WHERE p.code IN ('finance.view_tracker', 'finance.view_budget')
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    RAISE NOTICE 'Finance Admin role + permissions seeded. role_id=%', v_finance_admin_role_id;
END $$;

-- ============================================================
-- 5. STORAGE BUCKET: capex-budgets (private, signed URLs only)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('capex-budgets', 'capex-budgets', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: service role only (all reads go through API signed URLs)
DROP POLICY IF EXISTS "Service role manages capex-budgets" ON storage.objects;
CREATE POLICY "Service role manages capex-budgets"
    ON storage.objects FOR ALL
    USING (bucket_id = 'capex-budgets' AND auth.role() = 'service_role');

-- ============================================================
-- 6. SEED: Placeholder 2026 budget (one per organization)
-- ============================================================
DO $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT id INTO v_org_id FROM organizations WHERE name ILIKE '%rainbow%' OR name ILIKE '%RTG%' LIMIT 1;
    IF v_org_id IS NULL THEN
        SELECT id INTO v_org_id FROM organizations LIMIT 1;
    END IF;
    IF v_org_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO capex_budgets (organization_id, financial_year, budget_document_path, budget_document_name, total_budget, is_placeholder)
    VALUES (v_org_id, 2026, 'seed/capex-budget-2026-placeholder.pdf', 'CAPEX Budget 2026 (placeholder)', NULL, true)
    ON CONFLICT (organization_id, financial_year) DO NOTHING;
END $$;

-- ============================================================
-- 7. SEED: CAPEX tracker dummy rows (matching February 2026 screenshot)
-- ============================================================
DO $$
DECLARE
    v_org_id UUID;
    v_champion_id UUID;
    v_user_ids UUID[];
BEGIN
    SELECT id INTO v_org_id FROM organizations WHERE name ILIKE '%rainbow%' OR name ILIKE '%RTG%' LIMIT 1;
    IF v_org_id IS NULL THEN
        SELECT id INTO v_org_id FROM organizations LIMIT 1;
    END IF;
    IF v_org_id IS NULL THEN
        RETURN;
    END IF;

    -- Collect existing users to randomly assign as champions
    SELECT ARRAY_AGG(id) INTO v_user_ids FROM app_users WHERE organization_id = v_org_id AND is_active = true;
    IF v_user_ids IS NULL OR array_length(v_user_ids, 1) = 0 THEN
        SELECT ARRAY_AGG(id) INTO v_user_ids FROM app_users LIMIT 20;
    END IF;

    -- Helper to pick a random champion
    -- (Inline via v_user_ids[1 + floor(random() * array_length)])

    -- Only insert if tracker is empty for this org (idempotent seed)
    IF NOT EXISTS (SELECT 1 FROM capex_tracker WHERE organization_id = v_org_id) THEN

        -- 1. Northern Catering / Glasswasher
        v_champion_id := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
        INSERT INTO capex_tracker (organization_id, ranking, supplier, description, capex_date, cost, funded, champion_user_id, status_update, department, financial_year, is_budgeted)
        VALUES (v_org_id, 1, 'Northern Catering', 'Glasswasher', '2024-07-01', 2295, 0, v_champion_id, 'CAPEX Approved – Awaiting Funding', 'F&B', 2026, true);

        -- 2. Shelve IT / Shelving Unit
        v_champion_id := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
        INSERT INTO capex_tracker (organization_id, ranking, supplier, description, capex_date, cost, funded, champion_user_id, status_update, department, financial_year, is_budgeted)
        VALUES (v_org_id, 1, 'Shelve IT', 'Shelving Unit - Stores cold-room racking', '2025-04-24', 1932, 0, v_champion_id, 'CAPEX Approved – Awaiting Funding', 'F&B', 2026, true);

        -- 3. Lyrich Solutions / Waiter multi pager system
        v_champion_id := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
        INSERT INTO capex_tracker (organization_id, ranking, supplier, description, capex_date, cost, funded, champion_user_id, status_update, department, financial_year, is_budgeted)
        VALUES (v_org_id, 1, 'Lyrich Solutions', 'Waiter multi pager system', '2025-04-28', 1805, 0, v_champion_id, 'CAPEX Approved – Awaiting Funding', 'BIS', 2026, true);

        -- 4. Atlas Vidac / RFID Door system
        v_champion_id := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
        INSERT INTO capex_tracker (organization_id, ranking, supplier, description, capex_date, cost, funded, champion_user_id, status_update, department, financial_year, is_budgeted)
        VALUES (v_org_id, 1, 'Atlas Vidac', 'Purchase of classic RFID Door system', '2025-02-10', 33565, 0, v_champion_id, 'CAPEX Approved – Awaiting Funding', 'Engineering', 2026, true);

        -- 5. Techno / Gym Equipment
        v_champion_id := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
        INSERT INTO capex_tracker (organization_id, ranking, supplier, description, capex_date, cost, funded, champion_user_id, status_update, department, financial_year, is_budgeted)
        VALUES (v_org_id, 1, 'Techno', 'Gym Equipment', '2025-06-04', 29786, 0, v_champion_id, 'CAPEX Approved – Awaiting Funding', 'Leisure', 2026, true);

        -- 6. Rakiten / Power backup
        v_champion_id := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
        INSERT INTO capex_tracker (organization_id, ranking, supplier, description, capex_date, cost, funded, champion_user_id, status_update, department, financial_year, is_budgeted)
        VALUES (v_org_id, 1, 'Rakiten', 'Installation of additional power backup', '2024-03-28', 15047, 0, v_champion_id, 'CAPEX Approved – Awaiting Funding', 'Engineering', 2026, true);

        -- 7. Pomona Steel & Fencing / Clearview Fencing
        v_champion_id := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
        INSERT INTO capex_tracker (organization_id, ranking, supplier, description, capex_date, cost, funded, champion_user_id, status_update, department, financial_year, is_budgeted)
        VALUES (v_org_id, 1, 'Pomona Steel & Fencing', 'Clearview Fencing to secure boreholes', '2025-04-29', 1902, 0, v_champion_id, 'CAPEX Approved – Awaiting Funding', 'Engineering', 2026, true);

        -- 8. Hotel Tronix / 227 electronic room safes
        v_champion_id := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
        INSERT INTO capex_tracker (organization_id, ranking, supplier, description, capex_date, cost, funded, champion_user_id, status_update, department, financial_year, is_budgeted)
        VALUES (v_org_id, 1, 'Hotel Tronix', '227 electronic room safes', '2025-08-04', 25072, 0, v_champion_id, 'CAPEX Approval in Progress', 'Rooms', 2026, true);

        -- 9. JM Construction / Fitness Trail
        v_champion_id := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
        INSERT INTO capex_tracker (organization_id, ranking, supplier, description, capex_date, cost, funded, champion_user_id, status_update, department, financial_year, is_budgeted)
        VALUES (v_org_id, 1, 'JM Construction', 'Fitness Trail', '2025-05-02', 41647, 0, v_champion_id, 'CAPEX Approved – Awaiting Funding', 'Leisure', 2026, true);

        -- 10. JM Construction / Beauty Spa Renovations
        v_champion_id := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
        INSERT INTO capex_tracker (organization_id, ranking, supplier, description, capex_date, cost, funded, champion_user_id, status_update, department, financial_year, is_budgeted)
        VALUES (v_org_id, 1, 'JM Construction', 'Beauty Spa Renovations', '2025-06-04', 6154, 0, v_champion_id, 'CAPEX Approved – Awaiting Funding', 'Leisure', 2026, true);

        -- 11. Tile & Carpet Centre / Tiling of bathroom cubicles
        v_champion_id := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
        INSERT INTO capex_tracker (organization_id, ranking, supplier, description, capex_date, cost, funded, champion_user_id, status_update, department, financial_year, is_budgeted)
        VALUES (v_org_id, 1, 'Tile & Carpet Centre', 'Tiling of all cracked shower cubicles in the hotel bathrooms', '2025-06-04', 5074, 0, v_champion_id, 'CAPEX Approval in Progress', 'Rooms', 2026, true);

        -- 12. KDV / 40 x 3/4 beds
        v_champion_id := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int];
        INSERT INTO capex_tracker (organization_id, ranking, supplier, description, capex_date, cost, funded, champion_user_id, status_update, department, financial_year, is_budgeted)
        VALUES (v_org_id, 1, 'KDV', '40 x 3/4 beds', '2025-06-17', 9760, 0, v_champion_id, 'CAPEX Approved – Awaiting Funding', 'Rooms', 2026, true);

        RAISE NOTICE 'CAPEX tracker seeded with 12 dummy rows for org %', v_org_id;
    ELSE
        RAISE NOTICE 'CAPEX tracker already populated for org % - skipping seed', v_org_id;
    END IF;
END $$;

-- ============================================================
-- Done
-- ============================================================
