-- ====================================================================
-- Migration: permanent (personal) watchers
-- ====================================================================
-- A user (the "owner") can nominate other users as their permanent watchers.
-- A permanent watcher gets READ-ONLY visibility of every request the owner
-- creates (posts) or is an approver on (receives). They can never approve,
-- edit, or upload — only the visibility gates consult this table.
--
-- Distinct from a per-request watcher (requests.metadata.watchers), which is
-- chosen per request. This is a standing, personal setting.
-- ====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS permanent_watchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    watcher_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT permanent_watchers_distinct CHECK (owner_id <> watcher_id),
    CONSTRAINT permanent_watchers_unique UNIQUE (owner_id, watcher_id)
);

CREATE INDEX IF NOT EXISTS idx_permanent_watchers_watcher
    ON permanent_watchers(watcher_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_permanent_watchers_owner
    ON permanent_watchers(owner_id, organization_id);

ALTER TABLE permanent_watchers ENABLE ROW LEVEL SECURITY;

-- Service-role only (the app uses supabaseAdmin); mirrors approval_delegations.
CREATE POLICY "Service role manages permanent watchers"
    ON permanent_watchers FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE permanent_watchers IS
    'Standing personal watchers: watcher_id may read-only view all of owner_id''s created/received requests.';

COMMIT;
