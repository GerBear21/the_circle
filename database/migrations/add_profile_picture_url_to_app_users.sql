-- Add profile_picture_url column to app_users table
-- This stores the URL to the user's profile picture in Supabase storage

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_users' AND column_name = 'profile_picture_url') THEN 
        ALTER TABLE app_users ADD COLUMN profile_picture_url TEXT;
    END IF;
END $$;
