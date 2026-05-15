-- ============================================================
-- Add per-step view tracking to `request_steps`
-- ============================================================
-- Surfaces "Approver has opened the request" on the timeline so
-- requesters can tell whether their approver is just slow vs. has
-- never even seen the message. Two columns so we can show both
-- the initial open and the latest visit:
--   first_viewed_at — set on the first GET this approver makes
--   last_viewed_at  — overwritten on every subsequent visit
-- Both stay null for steps the approver hasn't visited yet.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'request_steps' AND column_name = 'first_viewed_at'
    ) THEN
        ALTER TABLE request_steps ADD COLUMN first_viewed_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'request_steps' AND column_name = 'last_viewed_at'
    ) THEN
        ALTER TABLE request_steps ADD COLUMN last_viewed_at TIMESTAMPTZ;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_request_steps_last_viewed_at
    ON request_steps(last_viewed_at);

COMMENT ON COLUMN request_steps.first_viewed_at IS
    'When the assigned approver first opened the request details page. Null until first visit.';
COMMENT ON COLUMN request_steps.last_viewed_at IS
    'Most recent time the assigned approver opened the request details page. Refreshed on every visit.';
