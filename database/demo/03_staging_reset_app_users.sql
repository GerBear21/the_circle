-- ============================================================================
-- RESET STAGING app_users FOR THE DEMO  (ID-PRESERVING VERSION)
-- ----------------------------------------------------------------------------
-- RUN THIS ON "THE CIRCLE STAGING" SUPABASE PROJECT.
--
-- ⚠  DO NOT delete-and-reinsert app_users. app_users.id is the anchor for
--    user_biometrics (WebAuthn passkeys), saved signatures, requests and
--    approvals — all with ON DELETE CASCADE or FK references. The previous
--    version of this script wiped every app_user and re-seeded them with NEW
--    UUIDs, which silently cascade-deleted every registered biometric device
--    and orphaned saved signatures. That is why device registrations appeared
--    to "vanish" between demo sessions.
--
-- This version UPSERTS on the (organization_id, azure_oid) unique key, so
-- existing rows keep their ids (and therefore their biometrics, signatures
-- and request history). Rows are only ever added or updated, never deleted.
--
-- Emails MUST match the HRIMS DEMO employees
-- (01_hrims_demo_schema_and_seed.sql) so that position auto-detection and
-- CAPEX approver resolution link up by email.
--
-- org "Rainbow Tourism Group" = 053914de-d77e-4b1e-b87b-97e060cd4d40
-- azure_oid is NOT NULL, so demo rows use a synthetic 'demo:<email>' value.
-- ============================================================================

begin;

-- 1. Seed / refresh the demo accounts. Existing rows keep their id.
insert into public.app_users (organization_id, azure_oid, email, display_name, role) values
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:ceo@rtg.demo',      'ceo@rtg.demo',      'Tendai Chikwava',   'requester'),
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:md@rtg.demo',       'md@rtg.demo',       'Rumbidzai Madziva', 'requester'),
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:fd@rtg.demo',       'fd@rtg.demo',       'Farai Moyo',        'requester'),
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:fm@rtg.demo',       'fm@rtg.demo',       'Chipo Dube',        'requester'),
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:proc@rtg.demo',     'proc@rtg.demo',     'Tatenda Sibanda',   'requester'),
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:proj@rtg.demo',     'proj@rtg.demo',     'Kudakwashe Nyathi', 'requester'),
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:chod@rtg.demo',     'chod@rtg.demo',     'Nomsa Khumalo',     'requester'),
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:it@rtg.demo',       'it@rtg.demo',       'Brian Chari',       'requester'),
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:rudo@rtg.demo',     'rudo@rtg.demo',     'Rudo Chasi',        'requester')
on conflict (organization_id, azure_oid) do update
  set email        = excluded.email,
      display_name = excluded.display_name;
      -- role intentionally NOT overwritten: keep any role granted since seeding.

-- 2. Make sure Geraldine's email matches the HRIMS DEMO employee exactly
--    (so her CAPEX form auto-detects "Systems Analyst" / ICT department).
update public.app_users
  set email = 'Geraldine.Ndoro@rtg.co.zw'
  where lower(email) = lower('Geraldine.Ndoro@rtg.co.zw');

commit;

-- Sanity check (run separately):
-- select email, display_name, role from public.app_users order by created_at;
