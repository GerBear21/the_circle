-- Add visibility tracking to archived_documents table
-- Only users involved in the workflow (requester, approvers, watchers) can view the archived document

-- Add columns to track who can view the document
ALTER TABLE archived_documents ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES app_users(id);
ALTER TABLE archived_documents ADD COLUMN IF NOT EXISTS approver_ids UUID[] DEFAULT '{}';
ALTER TABLE archived_documents ADD COLUMN IF NOT EXISTS watcher_ids UUID[] DEFAULT '{}';

-- Create index for efficient visibility queries
CREATE INDEX IF NOT EXISTS idx_archived_documents_creator_id ON archived_documents(creator_id);
CREATE INDEX IF NOT EXISTS idx_archived_documents_approver_ids ON archived_documents USING GIN(approver_ids);
CREATE INDEX IF NOT EXISTS idx_archived_documents_watcher_ids ON archived_documents USING GIN(watcher_ids);

-- Drop existing RLS policy and create new one with visibility restrictions
DROP POLICY IF EXISTS "Users can view archived documents in their organization" ON archived_documents;

-- New RLS Policy: Users can only view archived documents they are involved in
CREATE POLICY "Users can view archived documents they are involved in"
    ON archived_documents
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM app_users WHERE id = auth.uid()
        )
        AND (
            creator_id = auth.uid()
            OR auth.uid() = ANY(approver_ids)
            OR auth.uid() = ANY(watcher_ids)
            OR archived_by = auth.uid()
        )
    );

-- Add comments
COMMENT ON COLUMN archived_documents.creator_id IS 'The user who created the original request';
COMMENT ON COLUMN archived_documents.approver_ids IS 'Array of user IDs who approved the request';
COMMENT ON COLUMN archived_documents.watcher_ids IS 'Array of user IDs who were watchers on the request';
