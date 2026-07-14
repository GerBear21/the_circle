-- ====================================================================
-- Migration: Per-user reminder channel/frequency + landing page
-- ====================================================================
-- Adds the knobs behind the reworked reminder system and the "default
-- landing page" preference in My Settings.
--
--   reminder_channel   how reminders are delivered: email | in_app | both | none
--   reminder_frequency how often: daily | every_2_days | weekly | off
--   draft_reminders    also remind me about my own stale drafts
--   landing_page       page to open after login (path)
--
-- The legacy approval_reminders boolean is kept as the email gate that
-- lib/notificationEmail.ts already checks for kind='reminder'; the app
-- keeps it in sync with reminder_channel on save.
-- ====================================================================

BEGIN;

ALTER TABLE user_preferences
    ADD COLUMN IF NOT EXISTS reminder_channel TEXT NOT NULL DEFAULT 'both',
    ADD COLUMN IF NOT EXISTS reminder_frequency TEXT NOT NULL DEFAULT 'daily',
    ADD COLUMN IF NOT EXISTS draft_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS landing_page TEXT;

COMMENT ON COLUMN user_preferences.reminder_channel IS 'email | in_app | both | none';
COMMENT ON COLUMN user_preferences.reminder_frequency IS 'daily | every_2_days | weekly | off';
COMMENT ON COLUMN user_preferences.draft_reminders IS 'Remind the user about their own unsubmitted drafts.';
COMMENT ON COLUMN user_preferences.landing_page IS 'Default page path to open after login.';

COMMIT;
