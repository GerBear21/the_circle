-- Create request_steps table for tracking approval workflow steps
CREATE TABLE IF NOT EXISTS request_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    step_type VARCHAR(50) NOT NULL DEFAULT 'approval',
    approver_role VARCHAR(100),
    approver_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'pending', 'approved', 'rejected', 'skipped')),
    due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_request_steps_request_id ON request_steps(request_id);
CREATE INDEX IF NOT EXISTS idx_request_steps_approver_user_id ON request_steps(approver_user_id);
CREATE INDEX IF NOT EXISTS idx_request_steps_status ON request_steps(status);
CREATE INDEX IF NOT EXISTS idx_request_steps_step_index ON request_steps(step_index);

-- Enable RLS
ALTER TABLE request_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view request steps for their organization"
    ON request_steps FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM requests r
            JOIN app_users u ON u.organization_id = r.organization_id
            WHERE r.id = request_steps.request_id
            AND u.id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all request steps"
    ON request_steps FOR ALL
    USING (auth.role() = 'service_role');
