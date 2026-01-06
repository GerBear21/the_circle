-- Create business_units table
CREATE TABLE IF NOT EXISTS business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_business_units_organization_id ON business_units(organization_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view business units from their organization
CREATE POLICY "Users can view business units from their organization"
  ON business_units
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM app_users 
      WHERE id = auth.uid()
    )
  );

-- Policy: Admins can insert business units for their organization
CREATE POLICY "Admins can insert business units"
  ON business_units
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM app_users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Policy: Admins can update business units from their organization
CREATE POLICY "Admins can update business units"
  ON business_units
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM app_users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Policy: Admins can delete business units from their organization
CREATE POLICY "Admins can delete business units"
  ON business_units
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM app_users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );
