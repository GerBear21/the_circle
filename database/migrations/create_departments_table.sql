-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_departments_organization_id ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);

-- Add RLS (Row Level Security) policies
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view departments from their organization
CREATE POLICY "Users can view departments from their organization"
  ON departments
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM app_users 
      WHERE id = auth.uid()
    )
  );

-- Policy: Admins can insert departments for their organization
CREATE POLICY "Admins can insert departments"
  ON departments
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM app_users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Policy: Admins can update departments from their organization
CREATE POLICY "Admins can update departments"
  ON departments
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM app_users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Policy: Admins can delete departments from their organization
CREATE POLICY "Admins can delete departments"
  ON departments
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM app_users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );
