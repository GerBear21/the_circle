-- Migration: Add approval redirection/delegation support
-- This allows users to redirect approvals to another person when the original approver is absent

-- Add redirection columns to request_steps table
ALTER TABLE request_steps 
ADD COLUMN IF NOT EXISTS is_redirected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS original_approver_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS redirected_by_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS redirected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS redirect_reason TEXT,
ADD COLUMN IF NOT EXISTS redirect_job_title VARCHAR(255);

-- Create approval_redirections audit table for tracking all redirections
CREATE TABLE IF NOT EXISTS approval_redirections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES request_steps(id) ON DELETE CASCADE,
    original_approver_id UUID NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
    new_approver_id UUID NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
    redirected_by_id UUID NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
    redirect_reason TEXT,
    redirect_job_title VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_approval_redirections_request_id ON approval_redirections(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_redirections_step_id ON approval_redirections(step_id);
CREATE INDEX IF NOT EXISTS idx_approval_redirections_original_approver ON approval_redirections(original_approver_id);
CREATE INDEX IF NOT EXISTS idx_approval_redirections_new_approver ON approval_redirections(new_approver_id);
CREATE INDEX IF NOT EXISTS idx_request_steps_is_redirected ON request_steps(is_redirected) WHERE is_redirected = TRUE;

-- Enable RLS on approval_redirections
ALTER TABLE approval_redirections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for approval_redirections
CREATE POLICY "Users can view redirections for their organization"
    ON approval_redirections FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM requests r
            JOIN app_users u ON u.organization_id = r.organization_id
            WHERE r.id = approval_redirections.request_id
            AND u.id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all redirections"
    ON approval_redirections FOR ALL
    USING (auth.role() = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE approval_redirections IS 'Audit trail for approval redirections when original approver is absent';
COMMENT ON COLUMN request_steps.is_redirected IS 'Whether this step was redirected to a different approver';
COMMENT ON COLUMN request_steps.original_approver_id IS 'The original approver before redirection';
COMMENT ON COLUMN request_steps.redirect_job_title IS 'Job title of the person acting on behalf of the original approver';
