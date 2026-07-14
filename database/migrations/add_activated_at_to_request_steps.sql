-- ====================================================================
-- Migration: activated_at on approval steps ("received on this desk")
-- ====================================================================
-- Records when a step became the current pending step for its approver — i.e.
-- when the request landed on that person's desk. Used to:
--   * measure the per-step SLA clock (time sitting with the current approver),
--     independent of when the whole request was first created; and
--   * show "Received" + "sitting for N" on the approval timeline.
--
-- Backfilled to created_at for existing steps so historical rows have a sane
-- baseline. Step 1 (and every step in parallel mode) is stamped at creation;
-- later sequential steps are stamped when they activate (previous step approved).
-- ====================================================================

BEGIN;

ALTER TABLE request_steps
    ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- Backfill: any step already past 'waiting' has effectively been activated.
UPDATE request_steps
    SET activated_at = COALESCE(activated_at, created_at)
    WHERE activated_at IS NULL
      AND status <> 'waiting';

COMMENT ON COLUMN request_steps.activated_at IS
    'When the step became the current pending step (landed on the approver''s desk). Null while waiting.';

COMMIT;
