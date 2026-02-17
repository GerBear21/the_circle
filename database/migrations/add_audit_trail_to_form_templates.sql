-- Add audit trail fields to form_templates table
-- This tracks who edited the form, when, and why

-- Add audit trail columns
ALTER TABLE form_templates
ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS edit_reason TEXT;

-- Create audit log table for detailed change history
CREATE TABLE IF NOT EXISTS form_template_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
    edited_by UUID NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
    edited_at TIMESTAMPTZ DEFAULT NOW(),
    edit_reason TEXT,
    change_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'published', 'unpublished'
    changes_made JSONB, -- Detailed diff of what changed
    previous_version JSONB, -- Snapshot of form before changes
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_form_template_audit_log_template_id ON form_template_audit_log(form_template_id);
CREATE INDEX IF NOT EXISTS idx_form_template_audit_log_edited_by ON form_template_audit_log(edited_by);
CREATE INDEX IF NOT EXISTS idx_form_template_audit_log_edited_at ON form_template_audit_log(edited_at);

-- Enable RLS on audit log
ALTER TABLE form_template_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit log
CREATE POLICY "Users can view audit logs for forms in their organization"
    ON form_template_audit_log FOR SELECT
    USING (form_template_id IN (
        SELECT id FROM form_templates WHERE organization_id IN (
            SELECT organization_id FROM app_users WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Service role can manage all audit logs"
    ON form_template_audit_log FOR ALL
    USING (auth.role() = 'service_role');

-- Function to automatically log form template changes
CREATE OR REPLACE FUNCTION log_form_template_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log updates, not inserts (creation is logged separately)
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO form_template_audit_log (
            form_template_id,
            edited_by,
            edited_at,
            edit_reason,
            change_type,
            changes_made,
            previous_version
        ) VALUES (
            NEW.id,
            NEW.last_edited_by,
            NEW.last_edited_at,
            NEW.edit_reason,
            'updated',
            jsonb_build_object(
                'name_changed', OLD.name != NEW.name,
                'description_changed', OLD.description != NEW.description,
                'fields_changed', OLD.form_fields != NEW.form_fields,
                'workflow_changed', OLD.workflow_definition_id != NEW.workflow_definition_id,
                'scope_changed', OLD.scope != NEW.scope
            ),
            row_to_json(OLD)::jsonb
        );
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO form_template_audit_log (
            form_template_id,
            edited_by,
            edited_at,
            change_type,
            changes_made
        ) VALUES (
            NEW.id,
            NEW.created_by,
            NEW.created_at,
            'created',
            jsonb_build_object('initial_creation', true)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit logging
DROP TRIGGER IF EXISTS trigger_log_form_template_changes ON form_templates;
CREATE TRIGGER trigger_log_form_template_changes
    AFTER INSERT OR UPDATE ON form_templates
    FOR EACH ROW
    EXECUTE FUNCTION log_form_template_changes();

-- Add index for last_edited_by
CREATE INDEX IF NOT EXISTS idx_form_templates_last_edited_by ON form_templates(last_edited_by);

-- Comments for documentation
COMMENT ON COLUMN form_templates.last_edited_by IS 'User who last edited this form template';
COMMENT ON COLUMN form_templates.last_edited_at IS 'Timestamp of last edit';
COMMENT ON COLUMN form_templates.edit_reason IS 'Reason provided for the last edit';
COMMENT ON TABLE form_template_audit_log IS 'Detailed audit trail of all changes to form templates';
