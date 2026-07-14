-- ====================================================================
-- Migration: Supporting documents for approval delegations
-- ====================================================================
-- Lets whoever creates a delegation attach supporting evidence for the
-- reason (e.g. a photo/scan of a leave approval). Metadata is stored inline
-- on the delegation row as JSONB; the files themselves live in the existing
-- `quotations` storage bucket under an org/delegations/<id>/ path.
--
-- Each entry: { name, storage_path, size, mime_type, uploaded_by, uploaded_at }
-- ====================================================================

BEGIN;

ALTER TABLE approval_delegations
    ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN approval_delegations.documents IS
    'Supporting document metadata for the delegation reason (files in the quotations bucket).';

COMMIT;
