-- ====================================================================
-- Migration: attribute request documents to their uploader
-- ====================================================================
-- Records WHO uploaded each supporting document so the request page and the
-- audit trail can show "Uploaded by <name> · <when>". `created_at` already
-- captures the "when"; this adds the "who". Nullable so legacy rows are fine.
-- ====================================================================

BEGIN;

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES app_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN documents.uploaded_by IS
    'The app_user who uploaded this document. Null for legacy rows.';

COMMIT;
