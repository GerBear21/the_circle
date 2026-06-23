-- ============================================================
-- Migration: Make the `signatures` bucket private + migrate persisted URLs
--
-- Signatures are per-user PII. The bucket was PUBLIC with a broad listing
-- policy, so signature images were enumerable/readable by anyone. This migration
-- makes the bucket private and rewrites every persisted public signature URL to
-- the authenticated proxy (`/api/signature/view`), which streams the bytes via
-- the service role after a same-org / self / temp-capability authorization check.
--
-- ⚠️ DEPLOY ORDERING — this migration is COUPLED to the application code that
-- adds the proxy route and the proxy-URL producers/consumers. Apply it ONLY
-- AFTER that code is live in the target environment, otherwise browser-rendered
-- historical signatures (which read signature_url directly) would 404.
-- Safe order: deploy code → run this migration → verify → repeat for prod.
--
-- URL forms rewritten:
--   .../object/public/signatures/<uuid>.png
--       -> /api/signature/view?userId=<uuid>
--   .../object/public/signatures/manual/<uuid>/<req>/<step>.<ext>
--       -> /api/signature/view?path=manual%2F<uuid>%2F<req>%2F<step>.<ext>
-- ============================================================

-- 1. Flip the bucket to private and remove the public listing/read policy.
UPDATE storage.buckets SET public = false WHERE id = 'signatures';
DROP POLICY IF EXISTS "Public read access for signatures" ON storage.objects;

-- 2. Rewrite persisted public URLs -> proxy URLs.
--    A reusable expression, applied to every column that stores a signature URL.
--    (manual paths are matched first; the <uuid>.png branch only matches a bare
--    uuid filename, so the two never overlap.)

UPDATE approvals SET signature_url = CASE
  WHEN signature_url LIKE '%/object/public/signatures/manual/%'
    THEN '/api/signature/view?path=' ||
         replace((regexp_match(signature_url, '/object/public/signatures/(manual/[^?]+)'))[1], '/', '%2F')
  WHEN signature_url ~ '/object/public/signatures/[0-9a-fA-F-]{36}\.png'
    THEN '/api/signature/view?userId=' ||
         (regexp_match(signature_url, '/signatures/([0-9a-fA-F-]{36})\.png'))[1]
  ELSE signature_url
END
WHERE signature_url LIKE '%/object/public/signatures/%';

UPDATE approvals SET signature_reference = CASE
  WHEN signature_reference LIKE '%/object/public/signatures/manual/%'
    THEN '/api/signature/view?path=' ||
         replace((regexp_match(signature_reference, '/object/public/signatures/(manual/[^?]+)'))[1], '/', '%2F')
  WHEN signature_reference ~ '/object/public/signatures/[0-9a-fA-F-]{36}\.png'
    THEN '/api/signature/view?userId=' ||
         (regexp_match(signature_reference, '/signatures/([0-9a-fA-F-]{36})\.png'))[1]
  ELSE signature_reference
END
WHERE signature_reference LIKE '%/object/public/signatures/%';

-- app_users.signature_url (guarded — column may not exist on every project).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='app_users' AND column_name='signature_url'
  ) THEN
    UPDATE app_users SET signature_url =
      '/api/signature/view?userId=' ||
      (regexp_match(signature_url, '/signatures/([0-9a-fA-F-]{36})\.png'))[1]
    WHERE signature_url ~ '/object/public/signatures/[0-9a-fA-F-]{36}\.png';
  END IF;
END $$;
