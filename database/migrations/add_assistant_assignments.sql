-- ====================================================================
-- Migration: assistant assignments (admin-defined "file on behalf of")
-- ====================================================================
-- A systems admin / super user nominates an "assistant" who may file
-- requests on behalf of one or more "principals" (e.g. an executive).
-- The assistant remains the filer of record (requests.creator_id) and
-- receives every approval-progress update; the principal is notified
-- only once, when the request is fully approved.
--
-- This table governs FILING RIGHTS only. Watcher visibility continues to
-- live in permanent_watchers (owner = principal, watcher = assistant),
-- which the admin UI writes to separately.
--
-- Replaces the previous HRIMS-executive + approval_delegations gating for
-- on-behalf filing (see lib/onBehalf.ts).
-- ====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS assistant_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    assistant_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT assistant_assignments_distinct CHECK (assistant_id <> principal_id),
    CONSTRAINT assistant_assignments_unique UNIQUE (assistant_id, principal_id)
);

CREATE INDEX IF NOT EXISTS idx_assistant_assignments_assistant
    ON assistant_assignments(assistant_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_assistant_assignments_principal
    ON assistant_assignments(principal_id, organization_id);

ALTER TABLE assistant_assignments ENABLE ROW LEVEL SECURITY;

-- Service-role only (the app uses supabaseAdmin); mirrors permanent_watchers.
CREATE POLICY "Service role manages assistant assignments"
    ON assistant_assignments FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE assistant_assignments IS
    'Admin-defined filing rights: assistant_id may file requests on behalf of principal_id.';

COMMIT;
