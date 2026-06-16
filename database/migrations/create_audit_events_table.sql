-- ============================================================
-- Migration: Immutable, ISO-aligned audit event log
--
-- Implements an append-only, hash-chained audit trail in line with
-- ISO/IEC 27001:2022 A.8.15 (logging), A.8.16 (monitoring) and
-- ISO 15489 (records management):
--   * Every event carries WHO (actor + roles), WHAT (category/action),
--     WHEN (timestamptz, server clock), WHERE (ip / user agent) and
--     the OUTCOME, plus structured details.
--   * Tamper-evidence: each row stores a SHA-256 hash of its canonical
--     content chained to the previous row's hash. Any retro-active edit
--     breaks the chain and is detectable via verify_audit_chain().
--   * Immutability: UPDATE / DELETE / TRUNCATE are blocked by triggers
--     for every role, including the service role.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Monotonic position in the hash chain (assigned at insert).
    sequence_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    organization_id UUID REFERENCES organizations(id),

    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Classification
    category TEXT NOT NULL CHECK (category IN
        ('security', 'system', 'activity', 'transaction', 'workflow', 'data', 'compliance')),
    action TEXT NOT NULL,                       -- e.g. 'auth.login', 'request.approved'
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN
        ('info', 'notice', 'warning', 'critical')),
    outcome TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN
        ('success', 'failure', 'denied')),

    -- Actor (denormalised on purpose: the log must stay accurate even if
    -- the user record is later renamed or removed)
    actor_id UUID,
    actor_email TEXT,
    actor_name TEXT,
    actor_roles TEXT,

    -- Origin
    ip_address TEXT,
    user_agent TEXT,

    -- Target entity
    target_type TEXT,                           -- 'request' | 'user' | 'role' | 'setting' | ...
    target_id TEXT,
    target_label TEXT,
    request_id UUID,                            -- convenience FK-ish link to requests

    -- Structured payload (old/new values, comments, route, etc.)
    details JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Tamper-evidence chain
    prev_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_occurred ON audit_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_category ON audit_events(category, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_request ON audit_events(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_org ON audit_events(organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_severity ON audit_events(severity, occurred_at DESC);

-- ------------------------------------------------------------
-- Canonical serialisation used for hashing. Kept in ONE place so the
-- insert trigger and the verifier can never disagree.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_event_canonical(e audit_events) RETURNS TEXT AS $$
    SELECT concat_ws('|',
        e.id::text,
        e.sequence_number::text,
        COALESCE(e.organization_id::text, ''),
        to_char(e.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        e.category,
        e.action,
        e.severity,
        e.outcome,
        COALESCE(e.actor_id::text, ''),
        COALESCE(e.actor_email, ''),
        COALESCE(e.actor_name, ''),
        COALESCE(e.actor_roles, ''),
        COALESCE(e.ip_address, ''),
        COALESCE(e.user_agent, ''),
        COALESCE(e.target_type, ''),
        COALESCE(e.target_id, ''),
        COALESCE(e.target_label, ''),
        COALESCE(e.request_id::text, ''),
        e.details::text,
        e.prev_hash
    );
$$ LANGUAGE sql IMMUTABLE;

-- BEFORE INSERT: link to the previous row and seal the entry hash.
-- The advisory lock serialises concurrent inserts so the chain never forks.
CREATE OR REPLACE FUNCTION audit_events_seal() RETURNS TRIGGER AS $$
DECLARE
    v_prev TEXT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('audit_events_chain'));
    SELECT entry_hash INTO v_prev
    FROM audit_events
    ORDER BY sequence_number DESC
    LIMIT 1;

    NEW.prev_hash := COALESCE(v_prev, 'GENESIS');
    NEW.entry_hash := encode(digest(audit_event_canonical(NEW), 'sha256'), 'hex');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_events_seal ON audit_events;
CREATE TRIGGER trg_audit_events_seal
    BEFORE INSERT ON audit_events
    FOR EACH ROW EXECUTE FUNCTION audit_events_seal();

-- Append-only: block UPDATE / DELETE / TRUNCATE for everyone.
CREATE OR REPLACE FUNCTION audit_events_block_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_events is append-only: % is not permitted (ISO 27001 A.8.15)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_events_no_mutate ON audit_events;
CREATE TRIGGER trg_audit_events_no_mutate
    BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION audit_events_block_mutation();

DROP TRIGGER IF EXISTS trg_audit_events_no_truncate ON audit_events;
CREATE TRIGGER trg_audit_events_no_truncate
    BEFORE TRUNCATE ON audit_events
    FOR EACH STATEMENT EXECUTE FUNCTION audit_events_block_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM PUBLIC;

-- ------------------------------------------------------------
-- Integrity verification: walk the chain and recompute every hash.
-- Returns one summary row; first_broken_sequence is NULL when intact.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_audit_chain(p_limit BIGINT DEFAULT NULL)
RETURNS TABLE (
    is_valid BOOLEAN,
    events_checked BIGINT,
    first_broken_sequence BIGINT,
    verified_at TIMESTAMPTZ
) AS $$
DECLARE
    rec audit_events%ROWTYPE;
    v_expected_prev TEXT := 'GENESIS';
    v_checked BIGINT := 0;
    v_broken BIGINT := NULL;
BEGIN
    FOR rec IN
        SELECT * FROM audit_events
        ORDER BY sequence_number ASC
        LIMIT COALESCE(p_limit, 9223372036854775807)
    LOOP
        IF rec.prev_hash IS DISTINCT FROM v_expected_prev
           OR rec.entry_hash IS DISTINCT FROM encode(digest(audit_event_canonical(rec), 'sha256'), 'hex')
        THEN
            v_broken := rec.sequence_number;
            EXIT;
        END IF;
        v_expected_prev := rec.entry_hash;
        v_checked := v_checked + 1;
    END LOOP;

    RETURN QUERY SELECT v_broken IS NULL, v_checked, v_broken, NOW();
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- RLS: reads go through the service role (API enforces RBAC); inserts
-- come from the service role only.
-- ------------------------------------------------------------
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- RBAC: dedicated audit permissions, granted to Auditor + Super Admin.
-- ------------------------------------------------------------
INSERT INTO permissions (code, name, description, category) VALUES
    ('audit.view_logs', 'View Audit Logs', 'View the immutable system-wide audit log', 'audit'),
    ('audit.view_dashboard', 'Audit Dashboard', 'View audit statistics and the auditor dashboard', 'audit'),
    ('audit.export', 'Export Audit Reports', 'Export filtered audit reports (CSV/PDF)', 'audit'),
    ('audit.verify', 'Verify Audit Integrity', 'Run cryptographic integrity verification of the audit chain', 'audit')
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM roles WHERE slug IN ('auditor', 'super_admin')
    LOOP
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM permissions p WHERE p.category = 'audit'
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
END $$;

COMMENT ON TABLE audit_events IS
    'Append-only, hash-chained audit log (ISO 27001 A.8.15/A.8.16). Rows can never be updated or deleted; integrity is verifiable via verify_audit_chain().';
