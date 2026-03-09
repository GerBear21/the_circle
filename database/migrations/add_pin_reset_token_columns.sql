-- Add PIN reset token columns to app_users table
-- These columns store a hashed reset token and expiration time for PIN reset functionality

DO $$ 
BEGIN 
    -- Add pin_reset_token_hash column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_users' AND column_name = 'pin_reset_token_hash') THEN 
        ALTER TABLE app_users ADD COLUMN pin_reset_token_hash TEXT;
    END IF;
    
    -- Add pin_reset_token_expires column for token expiration
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_users' AND column_name = 'pin_reset_token_expires') THEN 
        ALTER TABLE app_users ADD COLUMN pin_reset_token_expires TIMESTAMPTZ;
    END IF;
END $$;

COMMENT ON COLUMN app_users.pin_reset_token_hash IS 'SHA-256 hash of the PIN reset token. Token is sent via email, hash is stored for verification.';
COMMENT ON COLUMN app_users.pin_reset_token_expires IS 'Expiration timestamp for the PIN reset token. Tokens expire after 1 hour.';
