-- Create form_templates table for storing user-created form templates
-- These are reusable form designs that any user can fill out to create requests
CREATE TABLE IF NOT EXISTS form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
    
    -- Basic info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Scope: who can use this form
    scope VARCHAR(50) NOT NULL DEFAULT 'hotel_group',
    -- CHECK (scope IN ('departmental', 'business_unit', 'hotel_group'))
    scope_department_id UUID,
    scope_business_unit_id UUID,
    
    -- Category for filtering/grouping
    category VARCHAR(100),
    
    -- Icon and color for display
    icon VARCHAR(500) DEFAULT 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    color VARCHAR(50) DEFAULT 'primary',
    
    -- Requestor info fields config (which requestor fields to show)
    requestor_fields JSONB DEFAULT '["full_name","email","department","business_unit","date"]'::jsonb,
    
    -- Form fields definition (the custom fields the user designs)
    form_fields JSONB DEFAULT '[]'::jsonb,
    
    -- Linked workflow definition
    workflow_definition_id UUID REFERENCES workflow_definitions(id) ON DELETE SET NULL,
    
    -- Inline workflow (if user created one during form design instead of selecting saved)
    inline_workflow_steps JSONB,
    inline_workflow_settings JSONB,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_published BOOLEAN DEFAULT true,
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_form_templates_org_id ON form_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_form_templates_scope ON form_templates(scope);
CREATE INDEX IF NOT EXISTS idx_form_templates_category ON form_templates(category);
CREATE INDEX IF NOT EXISTS idx_form_templates_is_active ON form_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_form_templates_is_published ON form_templates(is_published);
CREATE INDEX IF NOT EXISTS idx_form_templates_created_by ON form_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_form_templates_workflow_def ON form_templates(workflow_definition_id);

-- Enable RLS
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view published form templates in their organization"
    ON form_templates FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM app_users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can create form templates in their organization"
    ON form_templates FOR INSERT
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM app_users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their own form templates"
    ON form_templates FOR UPDATE
    USING (organization_id IN (
        SELECT organization_id FROM app_users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete their own form templates"
    ON form_templates FOR DELETE
    USING (created_by = auth.uid() OR organization_id IN (
        SELECT organization_id FROM app_users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ));

CREATE POLICY "Service role can manage all form templates"
    ON form_templates FOR ALL
    USING (auth.role() = 'service_role');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_form_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_form_templates_updated_at ON form_templates;
CREATE TRIGGER trigger_form_templates_updated_at
    BEFORE UPDATE ON form_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_form_templates_updated_at();
