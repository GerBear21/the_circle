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
-- The seeded password for every account below is:  Demo@2026!
-- (Node scrypt hash; change it before any real audience sees this. We use scrypt
--  rather than argon2 because argon2's native build is not bundled by Vercel's
--  serverless runtime — see lib/demoPassword.ts.)
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
