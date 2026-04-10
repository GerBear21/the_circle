-- Add approval workflow columns to approval_delegations
-- Delegations now require admin approval before becoming active

ALTER TABLE approval_delegations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_comment TEXT;

-- Update existing active delegations to approved status
UPDATE approval_delegations SET status = 'approved' WHERE is_active = true;
UPDATE approval_delegations SET status = 'rejected' WHERE is_active = false;

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_approval_delegations_status ON approval_delegations(status);
