-- ====================================================================
-- Migration: distinguish admin-managed permanent watchers
-- ====================================================================
-- The admin "Assistants & delegates" surface manages watchers set BY an admin,
-- while users can still self-nominate their own watchers. We previously guessed
-- the origin from `created_by <> owner_id`, which breaks when the admin doing
-- the assigning is also the owner (created_by == owner_id) — the admin-set
-- watcher then looked self-service and vanished from the admin view.
--
-- Make the origin explicit with `is_admin_managed`.
-- ====================================================================

BEGIN;

ALTER TABLE permanent_watchers
    ADD COLUMN IF NOT EXISTS is_admin_managed BOOLEAN NOT NULL DEFAULT FALSE;

-- Best-effort backfill of rows created by the admin card before this flag
-- existed (admin-set rows had created_by <> owner_id).
UPDATE permanent_watchers
    SET is_admin_managed = TRUE
    WHERE created_by IS NOT NULL AND created_by <> owner_id;

COMMENT ON COLUMN permanent_watchers.is_admin_managed IS
    'True when set via the admin Assistants & delegates surface (vs a user self-nominating their own watcher).';

COMMIT;
