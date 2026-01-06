-- Add department_id and business_unit_id columns to app_users table
-- This allows users to select their department and business unit

DO $$ 
BEGIN 
    -- Add department_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_users' AND column_name = 'department_id') THEN 
        ALTER TABLE app_users ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
    END IF;
    
    -- Add business_unit_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_users' AND column_name = 'business_unit_id') THEN 
        ALTER TABLE app_users ADD COLUMN business_unit_id UUID REFERENCES business_units(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_users_department_id ON app_users(department_id);
CREATE INDEX IF NOT EXISTS idx_app_users_business_unit_id ON app_users(business_unit_id);
