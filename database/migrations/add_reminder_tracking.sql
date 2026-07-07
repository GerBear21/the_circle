-- ====================================================================
-- Migration: Reminder cadence tracking on approval steps
-- ====================================================================
-- The reminder cron uses last_reminded_at to space out repeat reminders
-- (per the org SLA repeat interval and the recipient's frequency). Draft
-- reminder cadence is tracked in requests.metadata.last_draft_reminded_at
-- and needs no column.
-- ====================================================================

BEGIN;

ALTER TABLE request_steps
    ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;

COMMENT ON COLUMN request_steps.last_reminded_at IS 'When the approver was last reminded about this pending step.';

COMMIT;
