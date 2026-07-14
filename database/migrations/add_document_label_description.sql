-- ====================================================================
-- Migration: Label + description on request documents
-- ====================================================================
-- Supporting documents attached to a request (travel authorization, the travel
-- section of complimentary bookings, etc.) can now carry a human-friendly
-- label and a longer description, so approvers understand what each file is.
-- Both are optional and free-text.
-- ====================================================================

BEGIN;

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS label TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN documents.label IS
    'Short human-friendly label for a supporting document (e.g. "Conference invitation").';
COMMENT ON COLUMN documents.description IS
    'Longer description of what the supporting document is / why it is attached.';

COMMIT;
