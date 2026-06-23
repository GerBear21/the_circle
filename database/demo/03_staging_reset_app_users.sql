-- ============================================================================
-- RESET STAGING app_users FOR THE DEMO
-- ----------------------------------------------------------------------------
-- RUN THIS ON "THE CIRCLE STAGING" SUPABASE PROJECT.
--
-- Removes every app_user EXCEPT Geraldine Ndoro (who keeps her real Azure AD
-- login) and seeds one app_user per demo account. Emails MUST match the HRIMS
-- DEMO employees (01_hrims_demo_schema_and_seed.sql) so that position
-- auto-detection and CAPEX approver resolution link up by email.
--
-- ⚠  DESTRUCTIVE. If staging already has requests/approvals referencing these
--    users, the DELETE may fail on foreign keys (or you may want to keep that
--    history). In that case clear the dependent demo data first, or skip the
--    DELETE and only run the INSERT. Review before running.
--
-- org "Rainbow Tourism Group" = 053914de-d77e-4b1e-b87b-97e060cd4d40
-- azure_oid is NOT NULL, so demo rows use a synthetic 'demo:<email>' value.
-- ============================================================================

begin;

-- 1. Wipe everyone except Geraldine.
delete from public.app_users
where lower(email) <> lower('Geraldine.Ndoro@rtg.co.zw');

-- 2. Seed the demo accounts (idempotent on the org + azure_oid unique key).
insert into public.app_users (organization_id, azure_oid, email, display_name, role) values
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:ceo@rtg.demo',          'ceo@rtg.demo',          'Tendai Chikwava',   'requester'),
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:md@rtg.demo',           'md@rtg.demo',           'Rumbidzai Madziva', 'requester'),
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:fd@rtg.demo',           'fd@rtg.demo',           'Farai Moyo',        'requester'),
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:fm@rtg.demo',           'fm@rtg.demo',           'Chipo Dube',        'requester'),
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:proc@rtg.demo',  'proc@rtg.demo',  'Tatenda Sibanda',   'requester'),
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:proj@rtg.demo',     'proj@rtg.demo',     'Kudakwashe Nyathi', 'requester'),
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:chod@rtg.demo', 'chod@rtg.demo', 'Nomsa Khumalo',     'requester'),
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:it@rtg.demo',    'it@rtg.demo',    'Brian Chari',       'requester'),
  ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:rudo@rtg.demo',    'rudo@rtg.demo',    'Rudo Chasi',    'requester')
on conflict (organization_id, azure_oid) do nothing;

-- 3. Make sure Geraldine's email matches the HRIMS DEMO employee exactly
--    (so her CAPEX form auto-detects "Systems Analyst" / ICT department).
update public.app_users
  set email = 'Geraldine.Ndoro@rtg.co.zw'
  where lower(email) = lower('Geraldine.Ndoro@rtg.co.zw');

commit;

-- Sanity check (run separately):
-- select email, display_name, role from public.app_users order by created_at;
