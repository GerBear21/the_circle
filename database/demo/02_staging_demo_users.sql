-- ============================================================================
-- DEMO USERS — controlled credential allowlist
-- ----------------------------------------------------------------------------
-- RUN THIS ON "THE CIRCLE STAGING" SUPABASE PROJECT.
--
-- This table is the list of non-Microsoft accounts allowed to sign in via the
-- demo Credentials provider (pages/api/auth/[...nextauth].ts). It exists ONLY
-- in staging; production never has this table and never registers the provider.
--
-- You control access entirely by editing rows here (no redeploy needed):
--   * add an account:    insert a row (hash a password with scrypt — see README)
--   * revoke an account: update demo_users set is_active = false where ...
--   * change a password: update demo_users set password_hash = '...' where ...
--
-- The password hash below corresponds to:  Demo@2026!
-- (Node scrypt hash. We use scrypt rather than argon2 because argon2's native
--  build is not bundled by Vercel's serverless runtime — see lib/demoPassword.ts.)
--
-- ⚠ SECURITY: this repo is PUBLIC, so the password above must be treated as
-- compromised. The LIVE staging accounts have been rotated to a secret password
-- that is NOT stored in this repo. Do NOT re-run this seed against live staging
-- (or CI's shared staging) without first replacing the hash, or you will reset
-- every account back to the public Demo@2026!. For CI/CD, generate the hash from
-- a password held in a CI secret (see README "Change a password").
-- ============================================================================

create table if not exists public.demo_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Lock the table down: only the service role (used server-side by NextAuth)
-- should ever read it. RLS with no policies = no anon/auth client access.
alter table public.demo_users enable row level security;

insert into public.demo_users (email, password_hash, display_name) values
  ('ceo@rtg.demo',          'scrypt$16384$8$1$NE75SyOvapxcqISr9vjOPg==$p8h6A/5S7Tj4Ol+L+Q885JhvrfNMwHVvmkGVrHKsHoA=', 'Tendai Chikwava'),
  ('md@rtg.demo',           'scrypt$16384$8$1$NE75SyOvapxcqISr9vjOPg==$p8h6A/5S7Tj4Ol+L+Q885JhvrfNMwHVvmkGVrHKsHoA=', 'Rumbidzai Madziva'),
  ('fd@rtg.demo',           'scrypt$16384$8$1$NE75SyOvapxcqISr9vjOPg==$p8h6A/5S7Tj4Ol+L+Q885JhvrfNMwHVvmkGVrHKsHoA=', 'Farai Moyo'),
  ('fm@rtg.demo',           'scrypt$16384$8$1$NE75SyOvapxcqISr9vjOPg==$p8h6A/5S7Tj4Ol+L+Q885JhvrfNMwHVvmkGVrHKsHoA=', 'Chipo Dube'),
  ('proc@rtg.demo',  'scrypt$16384$8$1$NE75SyOvapxcqISr9vjOPg==$p8h6A/5S7Tj4Ol+L+Q885JhvrfNMwHVvmkGVrHKsHoA=', 'Tatenda Sibanda'),
  ('proj@rtg.demo',     'scrypt$16384$8$1$NE75SyOvapxcqISr9vjOPg==$p8h6A/5S7Tj4Ol+L+Q885JhvrfNMwHVvmkGVrHKsHoA=', 'Kudakwashe Nyathi'),
  ('chod@rtg.demo', 'scrypt$16384$8$1$NE75SyOvapxcqISr9vjOPg==$p8h6A/5S7Tj4Ol+L+Q885JhvrfNMwHVvmkGVrHKsHoA=', 'Nomsa Khumalo'),
  ('it@rtg.demo',    'scrypt$16384$8$1$NE75SyOvapxcqISr9vjOPg==$p8h6A/5S7Tj4Ol+L+Q885JhvrfNMwHVvmkGVrHKsHoA=', 'Brian Chari'),
  ('rudo@rtg.demo',    'scrypt$16384$8$1$NE75SyOvapxcqISr9vjOPg==$p8h6A/5S7Tj4Ol+L+Q885JhvrfNMwHVvmkGVrHKsHoA=', 'Rudo Chasi')
on conflict (email) do update
  set password_hash = excluded.password_hash,
      display_name  = excluded.display_name,
      is_active     = true;
