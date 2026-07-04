-- Migration: per-user notification/auto-archiving preferences + Microsoft 365 links on archives
--
-- user_preferences powers the toggles on /system/settings. It is read and
-- written exclusively through the service role (next-auth API routes), so RLS
-- is enabled with no anon/authenticated policies — same posture as the other
-- sensitive tables.

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,

    -- Email notification toggles
    email_request_updates BOOLEAN NOT NULL DEFAULT TRUE,   -- step approvals/rejections on my requests
    email_approval_tasks  BOOLEAN NOT NULL DEFAULT TRUE,   -- a request is waiting on my approval
    email_completion_pdf  BOOLEAN NOT NULL DEFAULT TRUE,   -- final approval email with the signed PDF
    approval_reminders    BOOLEAN NOT NULL DEFAULT TRUE,   -- nudge while an approval task is pending
    weekly_digest         BOOLEAN NOT NULL DEFAULT FALSE,  -- weekly activity summary

    -- Auto-archiving toggles
    auto_archive_onedrive BOOLEAN NOT NULL DEFAULT TRUE,   -- save approved PDFs to my OneDrive
    onedrive_folder       TEXT,                            -- optional custom OneDrive folder name

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE user_preferences IS 'Per-user email notification and auto-archiving preferences (service-role access only)';

-- Where the approved PDF landed in Microsoft 365 (webUrls returned by Graph):
-- { "onedrive": "...", "sharepoint": "...", "teams": "..." }
ALTER TABLE archived_documents
    ADD COLUMN IF NOT EXISTS microsoft_links JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS microsoft_synced_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN archived_documents.microsoft_links IS 'Graph webUrls of the synced copies: onedrive/sharepoint/teams';
