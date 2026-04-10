-- E-Sign invitations: tracks PDFs that the requestor has sent out for
-- other people to sign electronically. Each row is one (document, signer)
-- pair. The signer accesses the document via a unique token URL.

CREATE TABLE IF NOT EXISTS esign_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  requester_id    uuid REFERENCES app_users(id) ON DELETE SET NULL,
  requester_email text NOT NULL,
  requester_name  text,

  document_name   text NOT NULL,
  document_path   text NOT NULL,           -- Supabase storage path of source PDF
  signed_path     text,                    -- Supabase storage path of signed PDF (when complete)

  signer_email    text NOT NULL,
  signer_name     text,

  subject         text,
  message         text,

  token           text NOT NULL UNIQUE,    -- random URL token used by signer
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','viewed','signed','declined','expired','cancelled')),

  sent_at         timestamptz,
  viewed_at       timestamptz,
  signed_at       timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '30 days'),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS esign_invitations_requester_idx
  ON esign_invitations(requester_id);
CREATE INDEX IF NOT EXISTS esign_invitations_signer_email_idx
  ON esign_invitations(signer_email);
CREATE INDEX IF NOT EXISTS esign_invitations_status_idx
  ON esign_invitations(status);
CREATE INDEX IF NOT EXISTS esign_invitations_token_idx
  ON esign_invitations(token);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION set_esign_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_esign_invitations_updated_at ON esign_invitations;
CREATE TRIGGER trg_esign_invitations_updated_at
  BEFORE UPDATE ON esign_invitations
  FOR EACH ROW EXECUTE FUNCTION set_esign_invitations_updated_at();

-- NOTE: a Supabase storage bucket named `esign-documents` (private) must
-- exist. Create it via the dashboard or:
--   insert into storage.buckets (id, name, public) values
--     ('esign-documents','esign-documents', false)
--   on conflict do nothing;
