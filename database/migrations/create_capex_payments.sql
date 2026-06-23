-- ============================================================
-- CAPEX supplier payments
-- ============================================================
-- Records payments made to suppliers against an approved CAPEX
-- tracker entry. Each row is one payment in a given period; the
-- running sum funds the tracker entry (capex_tracker.funded).
-- ============================================================
CREATE TABLE IF NOT EXISTS capex_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capex_tracker_id UUID NOT NULL REFERENCES capex_tracker(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL,
    period TEXT,            -- payment period to the supplier, e.g. "Q1 2026" / "June 2026"
    reference TEXT,         -- EFT / cheque / PO reference
    notes TEXT,
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capex_payments_tracker ON capex_payments(capex_tracker_id);
CREATE INDEX IF NOT EXISTS idx_capex_payments_org ON capex_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_capex_payments_date ON capex_payments(payment_date);

ALTER TABLE capex_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage capex_payments" ON capex_payments;
CREATE POLICY "Service role can manage capex_payments"
    ON capex_payments FOR ALL
    USING (auth.role() = 'service_role');
