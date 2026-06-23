-- ====================================================================
-- Migration: Drop delegation feature
-- ====================================================================
-- Removes the approval delegation feature entirely:
--   1. Drops the approval_delegations table (CASCADE removes all FKs)
--   2. Removes delegation-specific permissions from RBAC permissions table
--   3. Removes the delegation system setting keys
--
-- This migration is destructive — apply only after confirming no delegation
-- data needs to be preserved. Run on staging first.
-- ====================================================================

BEGIN;

-- 1. Drop the approval_delegations table and any dependent objects
DROP TABLE IF EXISTS approval_delegations CASCADE;

-- 2. Remove delegation-specific permissions from the permissions table
-- These were assigned to roles via role_permissions which will cascade
DELETE FROM permissions
WHERE slug IN ('approvals.delegate', 'approvals.configure_delegation');

-- 3. Remove delegation-related notification setting keys
DELETE FROM system_settings
WHERE category = 'notifications'
  AND key = 'email_on_delegation';

-- 4. Remove delegation-related workflow setting keys
DELETE FROM system_settings
WHERE category = 'workflows'
  AND key = 'default_allow_delegation';

-- 5. Drop any orphaned delegation-related audit log entries
-- (Optional — comment out if you want to keep historical audit trail)
-- DELETE FROM audit_logs
-- WHERE action IN (
--   'delegation_requested',
--   'delegation_approved',
--   'delegation_rejected',
--   'delegation_updated'
-- );

COMMIT;

-- ====================================================================
-- Verification queries (run after migration to confirm cleanup)
-- ====================================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_name = 'approval_delegations';
--   -- Expected: 0 rows
--
-- SELECT slug FROM permissions
--   WHERE slug LIKE '%delegat%';
--   -- Expected: 0 rows
--
-- SELECT key FROM system_settings
--   WHERE key LIKE '%delegat%';
--   -- Expected: 0 rows
