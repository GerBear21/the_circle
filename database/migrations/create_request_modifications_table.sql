-- Migration: Create request_modifications table
-- This table tracks changes made by approvers to requests

CREATE TABLE IF NOT EXISTS request_modifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    modified_by UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    modification_type VARCHAR(50) NOT NULL, -- 'field_edit', 'document_upload', 'document_delete'
    field_name VARCHAR(255), -- The field that was modified (null for document changes)
    old_value TEXT, -- Previous value (null for document uploads)
    new_value TEXT, -- New value (null for document deletes)
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL, -- Reference to document if applicable
    document_filename VARCHAR(255), -- Store filename in case document is deleted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_request_modifications_request_id ON request_modifications(request_id);
CREATE INDEX IF NOT EXISTS idx_request_modifications_modified_by ON request_modifications(modified_by);
CREATE INDEX IF NOT EXISTS idx_request_modifications_created_at ON request_modifications(created_at);

-- Add RLS policies
ALTER TABLE request_modifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Users can view request modifications" ON request_modifications;
DROP POLICY IF EXISTS "Approvers can insert modifications" ON request_modifications;

-- Policy: Users can view modifications for requests they have access to
CREATE POLICY "Users can view request modifications"
    ON request_modifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM requests r
            WHERE r.id = request_modifications.request_id
            AND (
                r.creator_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM request_steps rs
                    WHERE rs.request_id = r.id
                    AND rs.approver_user_id = auth.uid()
                )
                OR r.metadata->>'watchers' LIKE '%' || auth.uid()::text || '%'
            )
        )
    );

-- Policy: Approvers can insert modifications for requests they are approving
CREATE POLICY "Approvers can insert modifications"
    ON request_modifications
    FOR INSERT
    WITH CHECK (
        modified_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM request_steps rs
            WHERE rs.request_id = request_modifications.request_id
            AND rs.approver_user_id = auth.uid()
            AND rs.status = 'pending'
        )
    );
