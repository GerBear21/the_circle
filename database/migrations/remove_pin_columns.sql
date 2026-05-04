-- ============================================================
-- Remove PIN-based approval authentication
-- ============================================================
-- PINs have been superseded by risk-based authentication:
--   low risk    -> session + confirmation modal
--   medium risk -> Microsoft Entra step-up (prompt=login, tenant MFA)
--   high risk   -> WebAuthn biometric (Windows Hello / Touch ID / Face ID)
--
-- This migration DROPs the Argon2-hashed PIN columns and the email-reset
-- token columns from `app_users`. Run AFTER:
--   1. create_user_biometrics_table.sql
--   2. extend_approvals_audit_trail.sql
-- ...and AFTER the application code has been deployed that no longer
-- references these columns.
--
-- SAFETY: this is destructive for any user mid-PIN-reset. The reset flow
-- has been removed from the UI; tokens in flight will simply no-op.
-- ============================================================

DO $$
BEGIN
    -- Argon2id hash of the 4-digit PIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'app_users' AND column_name = 'approval_pin_hash'
    ) THEN
        ALTER TABLE app_users DROP COLUMN approval_pin_hash;
    END IF;

    -- Flag: user completed PIN setup
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'app_users' AND column_name = 'pin_setup_completed'
    ) THEN
        ALTER TABLE app_users DROP COLUMN pin_setup_completed;
    END IF;

    -- Audit: when the PIN was last rotated
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'app_users' AND column_name = 'pin_last_changed'
    ) THEN
        ALTER TABLE app_users DROP COLUMN pin_last_changed;
    END IF;

    -- Reset-flow: SHA-256-hashed reset token
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'app_users' AND column_name = 'pin_reset_token_hash'
    ) THEN
        ALTER TABLE app_users DROP COLUMN pin_reset_token_hash;
    END IF;

    -- Reset-flow: token expiry
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'app_users' AND column_name = 'pin_reset_token_expires'
    ) THEN
        ALTER TABLE app_users DROP COLUMN pin_reset_token_expires;
    END IF;
END $$;
