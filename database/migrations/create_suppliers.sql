-- ============================================================
-- Suppliers directory
-- ============================================================
-- Auto-populated from CAPEX requests. Every quotation supplier named
-- on a submitted CAPEX request is recorded here (one row per supplier
-- per organization). The CAPEX form uses this table to suggest known
-- suppliers as the user types a supplier name.
--
-- Records are upserted by (organization_id, lower(name)) so the same
-- supplier is never duplicated; repeat use bumps `times_used` and
-- refreshes the products/currency last seen.
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    supplier_code TEXT,
    name TEXT NOT NULL,
    products TEXT,
    currency TEXT DEFAULT 'USD',
    last_request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
    times_used INTEGER NOT NULL DEFAULT 1,
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One supplier per name per org (case-insensitive). Drives the upsert.
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_org_name ON suppliers (organization_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(organization_id);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage suppliers" ON suppliers;
CREATE POLICY "Service role can manage suppliers"
    ON suppliers FOR ALL
    USING (auth.role() = 'service_role');
