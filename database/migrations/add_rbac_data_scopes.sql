-- ============================================================
-- RBAC: data-access scopes + per-user permission overrides
-- ============================================================
-- 1. user_access_scopes      — how much data each user can SEE:
--      own            only records they created/champion
--      department     their department (within their business unit)
--      business_unit  their home business unit (the default)
--      custom         an explicit list of business units
--      organization   everything in the organization
-- 2. user_scope_business_units — BU list for 'custom' scope
-- 3. user_permission_overrides — per-user grant/deny on top of roles
--      (grant adds the permission, deny removes it even if a role has it)
-- 4. capex_tracker.business_unit — backfilled from the linked request
-- 5. data.view_organization permission — role-grantable org-wide access
-- ============================================================

CREATE TABLE IF NOT EXISTS user_access_scopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    scope_level TEXT NOT NULL DEFAULT 'business_unit'
        CHECK (scope_level IN ('own', 'department', 'business_unit', 'custom', 'organization')),
    updated_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_access_scopes_user ON user_access_scopes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_scopes_org ON user_access_scopes(organization_id);

-- Business units are sourced from HRIMS (by name), so the custom-scope list
-- stores BU NAMES rather than FK ids into the_circle's own business_units table.
CREATE TABLE IF NOT EXISTS user_scope_business_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_id UUID NOT NULL REFERENCES user_access_scopes(id) ON DELETE CASCADE,
    business_unit_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(scope_id, business_unit_name)
);

CREATE INDEX IF NOT EXISTS idx_user_scope_bus_scope ON user_scope_business_units(scope_id);

CREATE TABLE IF NOT EXISTS user_permission_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN NOT NULL,
    assigned_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_perm_overrides_user ON user_permission_overrides(user_id);

ALTER TABLE user_access_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_scope_business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage user_access_scopes" ON user_access_scopes;
CREATE POLICY "Service role can manage user_access_scopes"
    ON user_access_scopes FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage user_scope_business_units" ON user_scope_business_units;
CREATE POLICY "Service role can manage user_scope_business_units"
    ON user_scope_business_units FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage user_permission_overrides" ON user_permission_overrides;
CREATE POLICY "Service role can manage user_permission_overrides"
    ON user_permission_overrides FOR ALL USING (auth.role() = 'service_role');

-- ------------------------------------------------------------
-- capex_tracker: business unit (name string, mirrors `department`)
-- ------------------------------------------------------------
ALTER TABLE capex_tracker ADD COLUMN IF NOT EXISTS business_unit TEXT;
CREATE INDEX IF NOT EXISTS idx_capex_tracker_business_unit ON capex_tracker(business_unit);

-- Backfill from the linked request's metadata (the CAPEX form stores the
-- business-unit NAME in metadata.unit)
UPDATE capex_tracker ct
SET business_unit = r.metadata->>'unit'
FROM requests r
WHERE ct.request_id = r.id
  AND ct.business_unit IS NULL
  AND COALESCE(r.metadata->>'unit', '') <> '';

-- ------------------------------------------------------------
-- Permission: org-wide data visibility (role-grantable)
-- ------------------------------------------------------------
INSERT INTO permissions (code, name, description, category) VALUES
    ('data.view_organization', 'View Organization-wide Data',
     'See data across all business units and departments, regardless of personal data scope', 'data')
ON CONFLICT (code) DO NOTHING;

-- Grant org-wide visibility to the admin-tier system roles so existing
-- behaviour does not regress for them.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.code = 'data.view_organization'
  AND r.slug IN ('super_admin', 'system_admin', 'auditor', 'finance_admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ------------------------------------------------------------
-- Backfill: per-form permissions for existing custom form templates
-- (new templates get theirs automatically on creation)
-- ------------------------------------------------------------
INSERT INTO permissions (code, name, description, category)
SELECT
    'form.access.' || ft.id,
    'Access Form: ' || left(ft.name, 120),
    'Use the "' || left(ft.name, 200) || '" custom form',
    'custom_forms'
FROM form_templates ft
ON CONFLICT (code) DO NOTHING;
