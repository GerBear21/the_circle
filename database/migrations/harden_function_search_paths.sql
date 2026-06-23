-- ============================================================
-- Migration: Pin search_path on remaining trigger/util functions
--
-- Advisor lint function_search_path_mutable: functions without an explicit
-- search_path resolve unqualified names against the caller's path, which can be
-- abused to shadow built-ins. Pinning `pg_catalog, public` makes resolution
-- deterministic (built-ins first) while keeping public tables reachable.
-- Guarded with to_regprocedure so it is safe across staging/prod schema drift.
-- ============================================================

DO $$
DECLARE
    fn text;
    fns text[] := ARRAY[
        'public.set_esign_invitations_updated_at()',
        'public.log_form_template_changes()',
        'public.update_workflow_definitions_updated_at()',
        'public.cleanup_expired_webauthn_challenges()',
        'public.update_form_templates_updated_at()'
    ];
BEGIN
    FOREACH fn IN ARRAY fns LOOP
        IF to_regprocedure(fn) IS NOT NULL THEN
            EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public;', fn);
        END IF;
    END LOOP;
END $$;
