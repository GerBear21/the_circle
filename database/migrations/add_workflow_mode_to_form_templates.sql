-- Add workflow mode and signatory columns to form_templates
-- Supports new workflow options: none, self_sign, individual_signatory, select, create

-- Add workflow_mode column
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS workflow_mode VARCHAR(50) DEFAULT 'select';

-- Add signatory columns for individual_signatory mode
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS signatory_email VARCHAR(255);
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS signatory_name VARCHAR(255);

-- Add form_version and approval_date columns
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS form_version VARCHAR(50);
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS approval_date DATE;

-- Add autofill_requestor_info column
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS autofill_requestor_info BOOLEAN DEFAULT true;

-- Add form_layout column (single_page, multi_page)
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS form_layout VARCHAR(50) DEFAULT 'single_page';

-- Add total_pages column for multi-page forms
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 1;

-- Add audience configuration columns
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS audience_type VARCHAR(50) DEFAULT 'all';
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS audience_department_ids UUID[];
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS audience_individual_emails TEXT[];
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS audience_group_name VARCHAR(255);
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS audience_positions TEXT[];

-- Add recurrence column
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS recurrence VARCHAR(50) DEFAULT 'none';

-- Add response settings columns
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS allow_submit_another BOOLEAN DEFAULT false;
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS thank_you_message TEXT DEFAULT 'Thank you for your submission! Your response has been recorded.';
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS notify_on_response BOOLEAN DEFAULT true;

-- Add scope_multi_business_unit_ids for multi_business_unit scope
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS scope_multi_business_unit_ids UUID[];

-- Create index on workflow_mode
CREATE INDEX IF NOT EXISTS idx_form_templates_workflow_mode ON form_templates(workflow_mode);
