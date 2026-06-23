-- ============================================================
-- Migration: Close anon-key data exposure by enabling RLS
--
-- Supabase's security advisor flagged tables in the public schema with Row
-- Level Security DISABLED. Because the app ships a client-side anon key
-- (lib/supabaseClient.ts), these tables were readable directly from any
-- browser via PostgREST — verified: `GET /rest/v1/app_users` with the anon key
-- returned real user rows (emails, names, roles). `esign_invitations` also
-- exposes a `token` column usable to hijack a signing ceremony.
--
-- ALL application access to these tables is server-side through the service
-- role (lib/supabaseAdmin.ts), which BYPASSES RLS. The browser anon client
-- never reads them (every `.from('<table>')` reference lives in lib/* server
-- modules). Enabling RLS with no anon/authenticated policy therefore denies the
-- anon role while leaving the API fully functional.
--
-- Idempotent + schema-drift safe: staging and prod differ slightly (e.g. the
-- dropped delegation feature), so each table is guarded with to_regclass.
-- ENABLE (not FORCE) RLS — the service role must keep bypassing it.
-- ============================================================

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'app_users',
        'system_settings',
        'roles',
        'role_permissions',
        'permissions',
        'user_roles',
        'rbac_audit_log',
        'approval_delegations',
        'esign_invitations',
        'user_biometrics',
        'webauthn_challenges'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF to_regclass('public.' || t) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
            RAISE NOTICE 'RLS enabled on public.%', t;
        ELSE
            RAISE NOTICE 'Skipped (absent): public.%', t;
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- Tighten an over-permissive INSERT policy on archived_documents.
-- The advisor flagged its INSERT policy as `WITH CHECK (true)` applied to ALL
-- roles (the anon role could insert). Inserts only come from the service role
-- (which bypasses RLS), so scope the policy to service_role.
-- ------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.archived_documents') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Service role can insert archived documents" ON public.archived_documents;
        CREATE POLICY "Service role can insert archived documents"
            ON public.archived_documents
            FOR INSERT
            TO service_role
            WITH CHECK (true);
    END IF;
END $$;

-- ------------------------------------------------------------
-- Pin a stable search_path on the rate-limit functions (advisor:
-- function_search_path_mutable). pg_catalog first so built-ins can't be shadowed.
-- ------------------------------------------------------------
DO $$
BEGIN
    IF to_regprocedure('public.check_rate_limit(text, integer, integer)') IS NOT NULL THEN
        ALTER FUNCTION public.check_rate_limit(text, integer, integer) SET search_path = pg_catalog, public;
    END IF;
    IF to_regprocedure('public.prune_rate_limit_counters()') IS NOT NULL THEN
        ALTER FUNCTION public.prune_rate_limit_counters() SET search_path = pg_catalog, public;
    END IF;
END $$;
