-- Create approval_templates table for storing reusable approval workflow templates
CREATE TABLE IF NOT EXISTS approval_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    form_fields JSONB DEFAULT '[]'::jsonb,
    workflow_steps JSONB DEFAULT '[]'::jsonb,
    workflow_settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_approval_templates_org_id ON approval_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_approval_templates_created_by ON approval_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_approval_templates_is_active ON approval_templates(is_active);

-- Enable RLS
ALTER TABLE approval_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view templates in their organization"
    ON approval_templates FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM app_users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can create templates in their organization"
    ON approval_templates FOR INSERT
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM app_users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update templates in their organization"
    ON approval_templates FOR UPDATE
    USING (organization_id IN (
        SELECT organization_id FROM app_users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete templates in their organization"
    ON approval_templates FOR DELETE
    USING (organization_id IN (
        SELECT organization_id FROM app_users WHERE id = auth.uid()
    ));
