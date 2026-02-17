-- Add folder organization to archived_documents table
-- Each form template gets its own folder for automatic organization

-- Add folder_name column to store which folder this document belongs to
ALTER TABLE archived_documents ADD COLUMN IF NOT EXISTS folder_name VARCHAR(500);

-- Add template_id to link documents to their form templates
ALTER TABLE archived_documents ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES form_templates(id) ON DELETE SET NULL;

-- Add category column for additional categorization (e.g., 'self_signed_forms', 'approved_requests')
ALTER TABLE archived_documents ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Create index for efficient folder queries
CREATE INDEX IF NOT EXISTS idx_archived_documents_folder_name ON archived_documents(folder_name);
CREATE INDEX IF NOT EXISTS idx_archived_documents_template_id ON archived_documents(template_id);
CREATE INDEX IF NOT EXISTS idx_archived_documents_category ON archived_documents(category);

-- Add comment
COMMENT ON COLUMN archived_documents.folder_name IS 'Folder name for organizing documents, typically the form template name';
COMMENT ON COLUMN archived_documents.template_id IS 'Reference to the form template this document was created from';
COMMENT ON COLUMN archived_documents.category IS 'Category for additional organization (e.g., self_signed_forms, approved_requests)';
