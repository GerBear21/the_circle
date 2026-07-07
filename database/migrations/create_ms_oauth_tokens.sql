-- Server-side store for Microsoft Graph delegated tokens.
--
-- Previously the Graph access + refresh tokens were carried inside the
-- next-auth JWT session cookie, which pushed the cookie well past the 4096-byte
-- limit and forced next-auth to chunk it across three cookies. Moving the
-- tokens here keeps the session cookie ~1 KB and eliminates the chunking.
--
-- Keyed by app_users.id. Read/written ONLY via the service role (supabaseAdmin)
-- from the auth callback and the e-sign mail path — never by the anon/client
-- key. RLS is enabled with no policies, so anon/authenticated get zero rows;
-- the service role bypasses RLS by design.
create table if not exists public.ms_oauth_tokens (
  user_id      uuid primary key references public.app_users(id) on delete cascade,
  access_token text,
  refresh_token text,
  expires_at   bigint,                     -- epoch milliseconds
  updated_at   timestamptz not null default now()
);

alter table public.ms_oauth_tokens enable row level security;

comment on table public.ms_oauth_tokens is
  'Microsoft Graph delegated tokens keyed by app_users.id. Service-role only; keeps large OAuth tokens out of the next-auth session cookie.';
