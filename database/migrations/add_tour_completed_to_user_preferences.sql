-- Migration: persist the post-onboarding feature-tour completion server-side.
--
-- Previously the "has this user finished the guided tour?" flag lived only in
-- the browser's localStorage (key `tour:done:<userId>`). That re-triggered the
-- tour whenever the same user signed in from a different browser or device,
-- used a private window, or had their site data cleared. Storing it on the
-- user's preferences row makes "tour done" follow the user across devices.
--
-- Additive and safe: defaults to FALSE so existing users are unaffected until
-- they finish (or have already finished) the tour. user_preferences is
-- service-role-only, so no RLS policy changes are needed.

ALTER TABLE user_preferences
    ADD COLUMN IF NOT EXISTS tour_completed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN user_preferences.tour_completed IS 'Whether the user has completed (or dismissed) the post-onboarding feature tour. Set once; suppresses the tour on every device.';
