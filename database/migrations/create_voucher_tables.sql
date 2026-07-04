-- ============================================================
-- Voucher register + sequential numbering + hotel contact emails
-- ============================================================
-- Tables:
--   voucher_counters       : per-organization atomic running counter
--   vouchers               : the register / booklet (one row per voucher request)
--   business_unit_contacts : reception/reservations emails per hotel (HRIMS BU)
--
-- Business units are sourced from HRIMS (string ids), so contacts are keyed
-- by the HRIMS business_unit_id, NOT the local business_units table.
-- ============================================================

-- 1. Per-organization running counter (global, gap-free, assigned on approval)
CREATE TABLE IF NOT EXISTS voucher_counters (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    last_seq INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Voucher register (the "booklet")
CREATE TABLE IF NOT EXISTS vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    seq INTEGER,                       -- null until fully approved
    voucher_number TEXT,               -- zero-padded (e.g. '001'); null until approved
    guest_names TEXT,
    business_units JSONB DEFAULT '[]'::jsonb,
    reason TEXT,
    email_sent BOOLEAN NOT NULL DEFAULT false,
    email_sent_at TIMESTAMPTZ,
    email_recipients JSONB,
    delivered BOOLEAN NOT NULL DEFAULT false,
    delivered_at TIMESTAMPTZ,
    delivered_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(request_id)
);

CREATE INDEX IF NOT EXISTS idx_vouchers_organization_id ON vouchers(organization_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_request_id ON vouchers(request_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_seq ON vouchers(organization_id, seq);

-- 3. Hotel reception/reservations contact emails (keyed by HRIMS business unit id)
CREATE TABLE IF NOT EXISTS business_unit_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    business_unit_id TEXT NOT NULL,      -- HRIMS business unit id
    business_unit_code TEXT,
    business_unit_name TEXT,
    reception_email TEXT,
    reservations_email TEXT,
    updated_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, business_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_business_unit_contacts_org ON business_unit_contacts(organization_id);

-- Atomic, gap-free sequential voucher number issuer (per organization).
CREATE OR REPLACE FUNCTION issue_voucher_number(p_org UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_seq INTEGER;
BEGIN
    INSERT INTO voucher_counters (organization_id, last_seq)
    VALUES (p_org, 1)
    ON CONFLICT (organization_id)
    DO UPDATE SET last_seq = voucher_counters.last_seq + 1, updated_at = now()
    RETURNING last_seq INTO v_seq;
    RETURN v_seq;
END $$;

-- ============================================================
-- RLS — service-role writes bypass RLS; reads scoped to the org.
-- ============================================================
ALTER TABLE voucher_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_unit_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vouchers' AND policyname = 'Users can view vouchers in their organization') THEN
        CREATE POLICY "Users can view vouchers in their organization"
          ON vouchers FOR SELECT
          USING (organization_id IN (SELECT organization_id FROM app_users WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_unit_contacts' AND policyname = 'Users can view contacts in their organization') THEN
        CREATE POLICY "Users can view contacts in their organization"
          ON business_unit_contacts FOR SELECT
          USING (organization_id IN (SELECT organization_id FROM app_users WHERE id = auth.uid()));
    END IF;
END $$;
