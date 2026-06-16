-- ============================================================
-- Petty-cash cash-receipt OTP confirmations
-- ============================================================
-- OTP-based confirmation that a petty-cash requestor received the
-- cash from the accounts clerk. The clerk is sent an OTP (in-app +
-- email); the requestor enters it to prove the hand-over happened.
-- Confirmed records are visible to the finance department.
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_receipt_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    requestor_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    clerk_email TEXT NOT NULL,
    clerk_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    otp_hash TEXT NOT NULL,
    otp_expires_at TIMESTAMPTZ NOT NULL,
    amount NUMERIC(14, 2),
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired')),
    attempts INTEGER NOT NULL DEFAULT 0,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_receipts_request ON cash_receipt_confirmations(request_id);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_org ON cash_receipt_confirmations(organization_id);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_status ON cash_receipt_confirmations(status);

ALTER TABLE cash_receipt_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage cash_receipt_confirmations" ON cash_receipt_confirmations;
CREATE POLICY "Service role can manage cash_receipt_confirmations"
    ON cash_receipt_confirmations FOR ALL
    USING (auth.role() = 'service_role');
