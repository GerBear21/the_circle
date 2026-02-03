-- Create workflow_definitions table for storing reusable approval workflow definitions
-- This is the core of the data-driven approval engine
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
    
    -- Basic info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- e.g., 'capex', 'travel', 'leave', 'procurement'
    
    -- Form definition (what fields the requester fills out)
    form_schema JSONB DEFAULT '[]'::jsonb,
    
    -- Workflow steps definition (the approval chain)
    -- Each step can have: type, approver_type, approver_value, conditions, etc.
    steps JSONB DEFAULT '[]'::jsonb,
    
    -- Workflow-level settings
    settings JSONB DEFAULT '{
        "allowParallelApprovals": false,
        "requireAllParallel": true,
        "allowSkipSteps": false,
        "allowReassignment": true,
        "expirationDays": 30,
        "onExpiration": "escalate",
        "notifyRequesterOnEachStep": true,
        "allowWithdraw": true,
        "requireAttachments": false
    }'::jsonb,
    
    -- Status and versioning
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_org_id ON workflow_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_category ON workflow_definitions(category);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_is_active ON workflow_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_created_by ON workflow_definitions(created_by);

-- Enable RLS
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view workflow definitions in their organization"
    ON workflow_definitions FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM app_users WHERE id = auth.uid()
    ));

CREATE POLICY "Admins can create workflow definitions"
    ON workflow_definitions FOR INSERT
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM app_users WHERE id = auth.uid()
    ));

CREATE POLICY "Admins can update workflow definitions"
    ON workflow_definitions FOR UPDATE
    USING (organization_id IN (
        SELECT organization_id FROM app_users WHERE id = auth.uid()
    ));

CREATE POLICY "Admins can delete workflow definitions"
    ON workflow_definitions FOR DELETE
    USING (organization_id IN (
        SELECT organization_id FROM app_users WHERE id = auth.uid()
    ));

CREATE POLICY "Service role can manage all workflow definitions"
    ON workflow_definitions FOR ALL
    USING (auth.role() = 'service_role');

-- Add workflow_definition_id to requests table to link requests to their workflow
ALTER TABLE requests ADD COLUMN IF NOT EXISTS workflow_definition_id UUID REFERENCES workflow_definitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_requests_workflow_definition_id ON requests(workflow_definition_id);

-- Add step_definition to request_steps to store the step config snapshot
ALTER TABLE request_steps ADD COLUMN IF NOT EXISTS step_definition JSONB DEFAULT '{}'::jsonb;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_workflow_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_workflow_definitions_updated_at ON workflow_definitions;
CREATE TRIGGER trigger_workflow_definitions_updated_at
    BEFORE UPDATE ON workflow_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_definitions_updated_at();
