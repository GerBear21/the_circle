-- Migration: Create archived_documents table
-- This table stores PDF archives of fully approved requests with all signatures

CREATE TABLE IF NOT EXISTS archived_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Document metadata
    filename VARCHAR(500) NOT NULL,
    storage_path VARCHAR(1000) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    
    -- Archive metadata
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_by UUID REFERENCES app_users(id),
    
    -- Request snapshot at time of archiving
    request_title VARCHAR(500),
    request_reference VARCHAR(100),
    requester_name VARCHAR(255),
    requester_department VARCHAR(255),
    total_amount DECIMAL(15, 2),
    currency VARCHAR(10),
    
    -- Approval summary
    approval_completed_at TIMESTAMPTZ,
    approver_count INTEGER,
    
    -- Attached documents info (JSON array of document references)
    attached_documents JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_archived_documents_request_id ON archived_documents(request_id);
CREATE INDEX IF NOT EXISTS idx_archived_documents_organization_id ON archived_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_archived_documents_archived_at ON archived_documents(archived_at DESC);

-- Enable RLS
ALTER TABLE archived_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view archived documents in their organization
CREATE POLICY "Users can view archived documents in their organization"
    ON archived_documents
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM app_users WHERE id = auth.uid()
        )
    );

-- RLS Policy: Service role can insert archived documents
CREATE POLICY "Service role can insert archived documents"
    ON archived_documents
    FOR INSERT
    WITH CHECK (true);

-- Add comment
COMMENT ON TABLE archived_documents IS 'Stores PDF archives of fully approved requests with signatures';
