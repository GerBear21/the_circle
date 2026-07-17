-- Reporting line captured during onboarding for users who are in Azure AD but
-- not (yet) in HRIMS. Stored on the Circle profile so approvals can resolve a
-- line manager for them. Once the user exists in HRIMS, lookups resolve from
-- HRIMS first and this column is ignored — no webhook required.
alter table public.app_users
  add column if not exists reports_to_user_id uuid references public.app_users(id) on delete set null;
