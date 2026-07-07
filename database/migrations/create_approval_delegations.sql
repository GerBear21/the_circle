-- ====================================================================
-- Migration: Approval delegations (admin-driven, time-boxed)
-- ====================================================================
-- Lets a system admin route ANY approval that would land on one user
-- (the delegator, e.g. an approver who is away) to another user (the
-- delegate) for a bounded window, with a mandatory reason. New approvals
-- resolved during the window auto-route to the delegate; the admin can
-- additionally redirect specific already-started requests.
--
-- Builds on the existing per-step redirect columns on request_steps
-- (is_redirected / original_approver_id / redirected_by_id /
-- redirect_reason) added by add_approval_redirection.sql — a delegated
-- step reuses those and links back here via delegation_id.
-- ====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS approval_delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- The approver being covered (their approvals get routed away).
    delegator_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    -- Who acts on the delegator's behalf during the window.
    delegate_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL,
    -- active | revoked | expired. 'expired' is derived at read time from
    -- ends_at; we keep the column so a future sweep can materialise it.
    status TEXT NOT NULL DEFAULT 'active',
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT approval_delegations_distinct CHECK (delegator_id <> delegate_id),
    CONSTRAINT approval_delegations_window CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_approval_delegations_delegator_status
    ON approval_delegations(delegator_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_delegations_org
    ON approval_delegations(organization_id);

-- Mark a step that was auto-routed by a delegation (nullable; manual
-- per-step redirects leave this NULL).
ALTER TABLE request_steps
    ADD COLUMN IF NOT EXISTS delegation_id UUID
    REFERENCES approval_delegations(id) ON DELETE SET NULL;

-- Row Level Security (mirror approval_redirections policies).
ALTER TABLE approval_delegations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view delegations for their organization" ON approval_delegations;
CREATE POLICY "Users can view delegations for their organization"
    ON approval_delegations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app_users u
            WHERE u.organization_id = approval_delegations.organization_id
              AND u.id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role can manage all delegations" ON approval_delegations;
CREATE POLICY "Service role can manage all delegations"
    ON approval_delegations FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE approval_delegations IS 'Admin-driven, time-boxed routing of one approver''s approvals to another.';
COMMENT ON COLUMN request_steps.delegation_id IS 'The delegation that auto-routed this step, if any.';

COMMIT;
