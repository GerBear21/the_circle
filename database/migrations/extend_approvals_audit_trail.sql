-- ============================================================
-- Extend `approvals` audit trail for risk-based authentication
-- ============================================================
-- Adds forensic fields so we can prove, per approval, HOW the user was
-- verified (session cookie, Microsoft MFA step-up, or WebAuthn biometric)
-- and WHICH signature representation was applied. Existing fields
-- (request_id, step_id, approver_id, decision, comment, signature_url)
-- are preserved unchanged to keep backward compatibility.
-- ============================================================

DO $$
BEGIN
    -- signature_type: which of the three signature sources was used.
    --   'saved'  -> pre-registered signature PNG from storage
    --   'manual' -> freshly drawn signature PNG uploaded with this approval
    --   'typed'  -> typed name rendered as a signature (accessibility fallback)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'approvals' AND column_name = 'signature_type'
    ) THEN
        ALTER TABLE approvals
        ADD COLUMN signature_type TEXT
        CHECK (signature_type IN ('saved', 'manual', 'typed'));
    END IF;

    -- signature_reference: the literal used for the decision.
    --   For 'saved'/'manual' this is the storage URL (duplicates signature_url
    --     for clarity — the old column is preserved for legacy readers).
    --   For 'typed' this is the plain text the user typed, rendered to PDF
    --     via a signature font.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'approvals' AND column_name = 'signature_reference'
    ) THEN
        ALTER TABLE approvals ADD COLUMN signature_reference TEXT;
    END IF;

    -- authentication_method: which auth the user actually passed to sign off.
    --   'session'        -> low risk: valid session + in-product confirmation
    --   'microsoft_mfa'  -> medium risk: Microsoft Entra step-up (prompt=login, MFA enforced by tenant)
    --   'biometric'      -> high risk: WebAuthn platform authenticator (fallback: microsoft_mfa)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'approvals' AND column_name = 'authentication_method'
    ) THEN
        ALTER TABLE approvals
        ADD COLUMN authentication_method TEXT
        CHECK (authentication_method IN ('session', 'microsoft_mfa', 'biometric'));
    END IF;

    -- Risk bucket that was evaluated at decision time. Stored for auditability
    -- so future rule changes don't rewrite history.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'approvals' AND column_name = 'risk_level'
    ) THEN
        ALTER TABLE approvals
        ADD COLUMN risk_level TEXT
        CHECK (risk_level IN ('low', 'medium', 'high'));
    END IF;

    -- Opaque reference to the step-up ceremony (WebAuthn credential_id OR
    -- Microsoft step-up session id). Useful for incident correlation.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'approvals' AND column_name = 'auth_reference'
    ) THEN
        ALTER TABLE approvals ADD COLUMN auth_reference TEXT;
    END IF;

    -- Network context
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'approvals' AND column_name = 'ip_address'
    ) THEN
        ALTER TABLE approvals ADD COLUMN ip_address TEXT;
    END IF;

    -- Device context (user-agent, platform, optional geo).
    -- JSONB lets us extend without further migrations.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'approvals' AND column_name = 'device_info'
    ) THEN
        ALTER TABLE approvals ADD COLUMN device_info JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Explicit signed-at timestamp. `created_at` may already exist; we add
    -- this separately so later backfills / reports have unambiguous semantics.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'approvals' AND column_name = 'signed_at'
    ) THEN
        ALTER TABLE approvals ADD COLUMN signed_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- Helpful indexes for auditor queries
CREATE INDEX IF NOT EXISTS idx_approvals_auth_method
    ON approvals(authentication_method);
CREATE INDEX IF NOT EXISTS idx_approvals_risk_level
    ON approvals(risk_level);
CREATE INDEX IF NOT EXISTS idx_approvals_signed_at
    ON approvals(signed_at);

-- Documentation
COMMENT ON COLUMN approvals.signature_type IS
    'Source of the signature: saved (pre-registered PNG), manual (drawn at approval time), or typed (name rendered as signature).';
COMMENT ON COLUMN approvals.signature_reference IS
    'Storage URL for saved/manual signatures, or the literal typed string for typed signatures.';
COMMENT ON COLUMN approvals.authentication_method IS
    'How the user was verified for this approval: session (low risk), microsoft_mfa (medium), or biometric (high).';
COMMENT ON COLUMN approvals.risk_level IS
    'Approval risk bucket (low/medium/high) evaluated at decision time. Frozen for audit even if rules change.';
COMMENT ON COLUMN approvals.auth_reference IS
    'Opaque handle to the step-up ceremony (credential_id or step-up session id) for incident correlation.';
COMMENT ON COLUMN approvals.device_info IS
    'Client context at signing: user_agent, platform, screen, optional geo. JSONB so schema can evolve.';
