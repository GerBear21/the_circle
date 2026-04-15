-- ============================================================
-- System Settings Table
-- ============================================================
-- Stores key-value system configuration (SLAs, rates, preferences, etc.)
-- Each setting belongs to an organization and a category for grouping.

CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category TEXT NOT NULL,       -- e.g. 'sla', 'rates', 'preferences'
    key TEXT NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    updated_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, category, key)
);

CREATE INDEX IF NOT EXISTS idx_system_settings_org ON system_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(organization_id, category);
