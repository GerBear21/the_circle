-- ============================================================
-- Scope WebAuthn credentials to their Relying Party (rp_id)
-- ============================================================
-- Credentials are cryptographically bound to the RP ID (domain) they were
-- registered under: a passkey created on localhost or staging can NEVER
-- authenticate on production, and vice versa. Because local development and
-- the staging deployment share the same database, credentials registered in
-- one environment used to show up in the other but silently fail the
-- authentication ceremony — which looked like registrations "vanishing".
--
-- Recording rp_id lets the app (a) only offer credentials that are usable on
-- the current domain during authentication, and (b) tell the user honestly
-- that a device is registered for a different environment.
--
-- NULL = legacy row registered before this column existed (treated as usable).

ALTER TABLE user_biometrics ADD COLUMN IF NOT EXISTS rp_id TEXT;
CREATE INDEX IF NOT EXISTS idx_user_biometrics_rp ON user_biometrics(user_id, rp_id);

COMMENT ON COLUMN user_biometrics.rp_id IS
    'WebAuthn Relying Party ID (domain) the credential is bound to. NULL = legacy.';
