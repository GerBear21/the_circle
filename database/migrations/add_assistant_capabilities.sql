-- ====================================================================
-- Migration: assistant capability flags
-- ====================================================================
-- Iteration 2 of assistant assignments. An assistant→principal record now
-- carries granular capabilities the admin toggles per person:
--   can_file   — file requests on the principal's behalf (was the implicit
--                meaning of a row's existence; now explicit)
--   can_upload — upload/attach documents to the principal's requests
--   can_edit   — edit/amend the principal's requests
--   can_withdraw — unsubmit/withdraw/resubmit the principal's requests
--   can_manage_notifications — receive copies of the principal's notifications
--
-- The row exists while ANY of these five is true. The "watch" (read-only)
-- capability continues to live in permanent_watchers (its own visibility
-- gates), so it is NOT a column here.
-- ====================================================================

BEGIN;

ALTER TABLE assistant_assignments
    ADD COLUMN IF NOT EXISTS can_file BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS can_upload BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS can_edit BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS can_withdraw BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS can_manage_notifications BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN assistant_assignments.can_file IS 'File requests on the principal''s behalf.';
COMMENT ON COLUMN assistant_assignments.can_upload IS 'Upload documents to the principal''s requests.';
COMMENT ON COLUMN assistant_assignments.can_edit IS 'Edit/amend the principal''s requests.';
COMMENT ON COLUMN assistant_assignments.can_withdraw IS 'Unsubmit/withdraw/resubmit the principal''s requests.';
COMMENT ON COLUMN assistant_assignments.can_manage_notifications IS 'Receive copies of the principal''s notifications.';

COMMIT;
