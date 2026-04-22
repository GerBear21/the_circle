-- ============================================================
-- User Biometrics (WebAuthn/FIDO2 Passkey Credentials)
-- ============================================================
-- Stores registered biometric/platform authenticators (Windows Hello,
-- Touch ID, Face ID, etc.) used for high-risk approval step-up auth.
--
-- Cryptography: the public_key is a COSE-encoded ECDSA/RSA public key.
-- The private key never leaves the user's device. We only ever verify
-- signatures using the stored public_key — nothing sensitive is stored
-- server-side. The credential_id is an opaque authenticator handle.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_biometrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,

    -- Base64url-encoded credential identifier returned by the authenticator.
    -- Must be globally unique so we can find the correct public key at
    -- assertion time.
    credential_id TEXT NOT NULL UNIQUE,

    -- Base64url-encoded COSE public key. Used with @simplewebauthn/server
    -- verifyAuthenticationResponse() to validate assertions.
    public_key TEXT NOT NULL,

    -- WebAuthn signature counter, used to detect cloned authenticators.
    -- Updated after every successful verification.
    counter BIGINT NOT NULL DEFAULT 0,

    -- Human-friendly label shown to the user ("Windows Hello on Work Laptop")
    device_name TEXT,

    -- Transports the authenticator advertises (usb, nfc, ble, internal, hybrid)
    transports TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Authenticator attachment hint (platform = built-in, cross-platform = roaming)
    attachment TEXT,

    -- AAGUID of the authenticator (useful for model identification / fraud checks)
    aaguid TEXT,

    -- Whether this credential is backed up to cloud (iCloud Keychain etc.)
    backup_eligible BOOLEAN DEFAULT FALSE,
    backup_state BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,

    -- Soft-disable without deletion (e.g. if user reports lost device)
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Indexes for hot paths
CREATE INDEX IF NOT EXISTS idx_user_biometrics_user_id
    ON user_biometrics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_biometrics_credential_id
    ON user_biometrics(credential_id);
CREATE INDEX IF NOT EXISTS idx_user_biometrics_active
    ON user_biometrics(user_id, is_active)
    WHERE is_active = TRUE;

-- ============================================================
-- Challenge store for in-flight WebAuthn ceremonies
-- ============================================================
-- WebAuthn requires the server to issue a cryptographically random
-- challenge and verify the authenticator signs it. We persist challenges
-- briefly so the server can be stateless across the two-phase ceremony
-- (options endpoint -> client -> verify endpoint).
-- ============================================================
CREATE TABLE IF NOT EXISTS webauthn_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    challenge TEXT NOT NULL,

    -- 'registration' (adding a new credential) or 'authentication' (step-up)
    ceremony_type TEXT NOT NULL CHECK (ceremony_type IN ('registration', 'authentication')),

    -- Optional linkage to the approval that triggered the challenge, so the
    -- verify endpoint can tie the assertion to a specific approval action.
    request_id UUID,
    step_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Challenges are short-lived (60s). Anything past this is rejected.
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes')
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user
    ON webauthn_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires
    ON webauthn_challenges(expires_at);

-- Housekeeping: delete stale challenges so the table never grows unbounded.
-- A cron job or scheduled task should call this periodically.
CREATE OR REPLACE FUNCTION cleanup_expired_webauthn_challenges()
RETURNS void AS $$
BEGIN
    DELETE FROM webauthn_challenges WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Documentation
COMMENT ON TABLE user_biometrics IS
    'Registered WebAuthn/FIDO2 credentials for high-risk approval step-up authentication.';
COMMENT ON COLUMN user_biometrics.credential_id IS
    'Base64url-encoded opaque credential identifier from the authenticator (not sensitive).';
COMMENT ON COLUMN user_biometrics.public_key IS
    'Base64url-encoded COSE public key. Private key never leaves user device.';
COMMENT ON COLUMN user_biometrics.counter IS
    'Signature counter for clone detection. Updated on every successful verification.';

COMMENT ON TABLE webauthn_challenges IS
    'Short-lived server-issued challenges for WebAuthn registration/authentication ceremonies.';
