-- ============================================================
-- Bug Reports
-- ============================================================
-- In-app bug/issue logging. Any authenticated user can file a report;
-- system admins / super admins triage, track and resolve them. The
-- reporter is notified (in-app) whenever the status changes.
--
-- Access model: service-role only (all reads/writes go through the
-- Next.js API with session + RBAC checks). RLS is enabled with no
-- policies so the anon key can never touch this table.
-- ============================================================

CREATE TABLE IF NOT EXISTS bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,

    -- Who filed it. SET NULL (not CASCADE) so reports survive user removal.
    reporter_id UUID REFERENCES app_users(id) ON DELETE SET NULL,

    title TEXT NOT NULL,
    description TEXT NOT NULL,

    severity TEXT NOT NULL DEFAULT 'medium'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),

    -- open -> in_progress -> resolved | closed (closed = won't fix / duplicate)
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),

    -- Context captured automatically when the report is filed.
    page_url TEXT,
    user_agent TEXT,

    -- Admin triage fields.
    admin_notes TEXT,
    assigned_to UUID REFERENCES app_users(id) ON DELETE SET NULL,
    resolved_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_reporter ON bug_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_org ON bug_reports(organization_id);

-- Service-role-only access (see header).
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE bug_reports IS
    'User-filed bug reports tracked and resolved by system/super admins.';
