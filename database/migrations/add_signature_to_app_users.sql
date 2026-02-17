-- Add signature_url column to app_users table
-- This stores the URL to the user's signature image in Supabase storage

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_users' AND column_name = 'signature_url') THEN 
        ALTER TABLE app_users ADD COLUMN signature_url TEXT;
    END IF;
END $$;
