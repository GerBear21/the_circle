-- Add approval_pin_hash column to app_users table
-- This stores an Argon2id-hashed 4-digit PIN for secure approval signing
-- Argon2id is the winner of the Password Hashing Competition and is memory-hard,
-- making it resistant to GPU/ASIC attacks. The hash cannot be reversed.

DO $$ 
BEGIN 
    -- Add approval_pin_hash column if it doesn't exist
    -- Using TEXT type to store Argon2id hash
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_users' AND column_name = 'approval_pin_hash') THEN 
        ALTER TABLE app_users ADD COLUMN approval_pin_hash TEXT;
    END IF;
    
    -- Add pin_setup_completed flag to track if user has completed PIN setup
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_users' AND column_name = 'pin_setup_completed') THEN 
        ALTER TABLE app_users ADD COLUMN pin_setup_completed BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add pin_last_changed timestamp for security auditing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_users' AND column_name = 'pin_last_changed') THEN 
        ALTER TABLE app_users ADD COLUMN pin_last_changed TIMESTAMPTZ;
    END IF;
END $$;

-- Add comment explaining the security model
COMMENT ON COLUMN app_users.approval_pin_hash IS 'Argon2id-hashed 4-digit PIN for approval signing. Cannot be decrypted - only verified via argon2.verify()';
