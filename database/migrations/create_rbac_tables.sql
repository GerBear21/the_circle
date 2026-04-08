-- ============================================================
-- RBAC (Role-Based Access Control) Tables
-- ============================================================
-- Supports: Super Admin, System Admin, Auditor, and custom roles
-- Scoping: per-user, per-department, per-business-unit
-- ============================================================

-- 1. Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT 'gray',
    is_system BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, slug)
);

-- 3. Role-Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(role_id, permission_id)
);

-- 4. User-Role assignment with optional department/business_unit scoping
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    department_id UUID,
    business_unit_id UUID,
    assigned_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, role_id, department_id, business_unit_id)
);

-- 5. Delegation table for approval delegation
CREATE TABLE IF NOT EXISTS approval_delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegator_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    delegate_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    reason TEXT,
    department_id UUID,
    business_unit_id UUID,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. RBAC audit log
CREATE TABLE IF NOT EXISTS rbac_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id UUID,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_department_id ON user_roles(department_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_business_unit_id ON user_roles(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_approval_delegations_delegator ON approval_delegations(delegator_id);
CREATE INDEX IF NOT EXISTS idx_approval_delegations_delegate ON approval_delegations(delegate_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_log_actor ON rbac_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_log_action ON rbac_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_log_created ON rbac_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);

-- ============================================================
-- SEED: All Permissions
-- ============================================================
INSERT INTO permissions (code, name, description, category) VALUES
    -- Requests
    ('requests.create', 'Create Requests', 'Submit new requests', 'requests'),
    ('requests.view_own', 'View Own Requests', 'View requests they created', 'requests'),
    ('requests.view_all', 'View All Requests', 'View all organization requests', 'requests'),
    ('requests.edit_own', 'Edit Own Requests', 'Modify their own pending requests', 'requests'),
    ('requests.withdraw', 'Withdraw Requests', 'Withdraw pending requests', 'requests'),
    ('requests.delete', 'Delete Requests', 'Permanently delete requests', 'requests'),
    -- Approvals
    ('approvals.view', 'View Approvals', 'See pending approval queue', 'approvals'),
    ('approvals.approve', 'Approve Requests', 'Approve assigned requests', 'approvals'),
    ('approvals.reject', 'Reject Requests', 'Reject assigned requests', 'approvals'),
    ('approvals.delegate', 'Delegate Approvals', 'Delegate approvals to others', 'approvals'),
    ('approvals.override', 'Override Approvals', 'Override approval decisions', 'approvals'),
    ('approvals.reassign', 'Reassign Approvals', 'Reassign approvals to different users', 'approvals'),
    ('approvals.configure_delegation', 'Configure Delegation', 'Set up approval delegation rules', 'approvals'),
    -- Users
    ('users.view', 'View Users', 'View user directory', 'users'),
    ('users.create', 'Create Users', 'Add new users to organization', 'users'),
    ('users.edit', 'Edit Users', 'Modify user profiles and details', 'users'),
    ('users.deactivate', 'Deactivate Users', 'Deactivate user accounts', 'users'),
    ('users.delete', 'Delete Users', 'Permanently delete users', 'users'),
    ('users.assign_roles', 'Assign Roles', 'Change user role assignments', 'users'),
    ('users.manage_access', 'Manage Access Rights', 'Grant or revoke access rights for users', 'users'),
    -- Settings
    ('settings.view', 'View Settings', 'View organization settings', 'settings'),
    ('settings.edit', 'Edit Settings', 'Modify organization settings', 'settings'),
    ('settings.workflows', 'Manage Workflows', 'Create and edit approval workflows', 'settings'),
    ('settings.templates', 'Manage Templates', 'Create and edit request templates', 'settings'),
    ('settings.integrations', 'Manage Integrations', 'Configure third-party integrations', 'settings'),
    ('settings.sla', 'Configure SLA', 'Set up and manage SLA rules and thresholds', 'settings'),
    -- Forms
    ('forms.design', 'Design Forms', 'Create and design new form templates', 'forms'),
    ('forms.edit_rates', 'Edit Travel Rates', 'Change rates on travel forms', 'forms'),
    ('forms.publish', 'Publish Forms', 'Publish form templates for use', 'forms'),
    ('forms.archive', 'Archive Forms', 'Archive form templates', 'forms'),
    -- Reports & Analytics
    ('reports.view_own', 'View Own Reports', 'Access personal reports and analytics', 'reports'),
    ('reports.view_team', 'View Team Reports', 'Access team-level reports', 'reports'),
    ('reports.view_all', 'View All Reports', 'Access organization-wide reports', 'reports'),
    ('reports.export', 'Export Reports', 'Export reports to CSV/Excel', 'reports'),
    ('reports.sla_compliance', 'SLA Compliance Stats', 'View SLA compliance statistics and dashboards', 'reports'),
    ('reports.analytics', 'View Analytics', 'Access analytics and insights dashboards', 'reports'),
    -- Admin
    ('admin.roles', 'Manage Roles', 'Create and edit roles', 'admin'),
    ('admin.permissions', 'Manage Permissions', 'Assign and revoke permissions', 'admin'),
    ('admin.audit_logs', 'View Audit Logs', 'Access system audit logs', 'admin'),
    ('admin.system_config', 'System Configuration', 'Full system configuration access', 'admin'),
    ('admin.billing', 'Manage Billing', 'Access billing and subscription', 'admin'),
    ('admin.api_keys', 'Manage API Keys', 'Create and manage API keys', 'admin'),
    -- Archives
    ('archives.view_own', 'View Own Archives', 'View own archived documents', 'archives'),
    ('archives.view_all', 'View All Archives', 'View all archived documents', 'archives'),
    ('archives.download', 'Download Archives', 'Download archived documents', 'archives'),
    ('archives.manage', 'Manage Archives', 'Create folders, move, and organize archives', 'archives')
ON CONFLICT (code) DO NOTHING;
