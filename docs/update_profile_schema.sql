DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_users' AND column_name = 'job_title') THEN 
        ALTER TABLE app_users ADD COLUMN job_title TEXT; 
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_users' AND column_name = 'department') THEN 
        ALTER TABLE app_users ADD COLUMN department TEXT; 
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_users' AND column_name = 'phone') THEN 
        ALTER TABLE app_users ADD COLUMN phone TEXT; 
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_users' AND column_name = 'bio') THEN 
        ALTER TABLE app_users ADD COLUMN bio TEXT; 
    END IF;
END $$;
