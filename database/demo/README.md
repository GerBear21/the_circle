# Staging demo environment (CAPEX with auto-detected positions)

This sets up a **staging-only** demo where controlled, non-Microsoft accounts can
sign in and have their HRIMS position/department auto-detected — without a HRIMS
dev environment and **without affecting production**.

## How it stays out of production

Everything is gated by **`DEMO_MODE`** (server) / **`NEXT_PUBLIC_DEMO_MODE`**
(client login form). Set these **only on the staging deployment**. Production
runs the same committed code but, with the flags unset:

- the Credentials provider is never registered → Azure AD remains the only login;
- the demo login form never renders;
- production keeps pointing `HRIMS_SUPABASE_*` at the real HRIMS.

There is **no HRIMS-side code change** — the HRIMS client is already env-driven
(`lib/hrimsClient.ts`), so staging simply points at a throwaway HRIMS clone.

## Components

| Piece | Where | File |
|------|-------|------|
| Credentials provider + callbacks | code (gated) | `pages/api/auth/[...nextauth].ts` |
| Demo login form | code (gated) | `pages/index.tsx` |
| Fake HRIMS org chart | new "HRIMS DEMO" Supabase project | `01_hrims_demo_schema_and_seed.sql` |
| Allowed demo logins | The Circle **staging** Supabase | `02_staging_demo_users.sql` |
| Reset staging users | The Circle **staging** Supabase | `03_staging_reset_app_users.sql` |

## Setup steps

1. **Create a new Supabase project** named `HRIMS DEMO` (free tier is fine — it is
   throwaway). Run `01_hrims_demo_schema_and_seed.sql` in its SQL editor.

2. **Point staging at the demo HRIMS.** On the **staging** deployment only, set:
   - `HRIMS_SUPABASE_URL` = the HRIMS DEMO project URL
   - `HRIMS_SUPABASE_SERVICE_ROLE_KEY` = the HRIMS DEMO service-role key
   - `DEMO_MODE=true`
   - `NEXT_PUBLIC_DEMO_MODE=true`

   Leave production's values untouched.

3. **Seed the credential allowlist.** Run `02_staging_demo_users.sql` on
   **The Circle staging** Supabase.

4. **Reset staging users.** Review the ⚠ note, then run
   `03_staging_reset_app_users.sql` on **The Circle staging** Supabase.

5. **Redeploy staging** so the new env vars take effect.

## Using the demo

- Open the staging URL → a "Demo access" form appears under "Sign in with Microsoft".
- Sign in as any account below (default password `Demo@2026!`), or as
  **Geraldine** via the normal Microsoft button.

  | Login email      | Person            | Role (auto-detected)         |
  |------------------|-------------------|------------------------------|
  | `rudo@rtg.demo`  | Rudo Chasi        | ICT Officer (the requester)  |
  | `it@rtg.demo`    | Brian Chari       | Head of IT (dept head)       |
  | `fm@rtg.demo`    | Chipo Dube        | Finance Manager              |
  | `proc@rtg.demo`  | Tatenda Sibanda   | Procurement Manager          |
  | `proj@rtg.demo`  | Kudakwashe Nyathi | Projects Manager             |
  | `chod@rtg.demo`  | Nomsa Khumalo     | Corporate Head of Department |
  | `fd@rtg.demo`    | Farai Moyo        | Finance Director             |
  | `md@rtg.demo`    | Rumbidzai Madziva | Managing Director            |
  | `ceo@rtg.demo`   | Tendai Chikwava   | CEO                          |

  Live project refs: HRIMS DEMO = `tdlfzjelerzueqtlsspc`
  (`https://tdlfzjelerzueqtlsspc.supabase.co`); The Circle staging =
  `kidreqxqapouxndqomdp`.
- Open **New request → CAPEX**: the requester's position/department auto-detect
  from the fake org chart, and the approver chain resolves to the seeded people
  (Finance Manager, Procurement Manager, Projects Manager, Corporate HOD,
  Finance Director, Managing Director, CEO, and the requester's department head).
- To walk the full approval flow, sign in as each approver and approve in turn.

## Managing demo accounts (you control this)

A demo login involves **up to three rows**, and which ones you need depends on
what you want the account to do:

| Want the account to…                 | Needs a row in… |
|--------------------------------------|-----------------|
| Log in at all                        | `demo_users` (staging) — email + password |
| Be assignable / show a name in-app   | `app_users` (staging) |
| Auto-detect a position on the CAPEX form, or be resolved as an approver | `employees` + `organogram_positions` (HRIMS DEMO) |

The three must agree on **email** (matched case-insensitively). Quick ops below.

### Revoke or re-enable a login (no redeploy)
```sql
-- on The Circle staging
update demo_users set is_active = false where email = 'fm@rtg.demo';  -- revoke
update demo_users set is_active = true  where email = 'fm@rtg.demo';  -- re-enable
```

### Change a password
```bash
# from the repo root — generates an argon2 hash
node -e "require('argon2').hash(process.argv[1]).then(h=>console.log(h))" 'NewPassword123!'
```
```sql
-- on The Circle staging, paste the hash
update demo_users set password_hash = '<paste-hash>' where email = 'fm@rtg.demo';
```

### Add a brand-new demo person (full walkthrough)

Say you want **Anesu Moyo**, an *Internal Auditor* who reports to the CEO, with
login `audit@rtg.demo`.

**Step 1 — Add them to the HRIMS DEMO org chart** (project `tdlfzjelerzueqtlsspc`),
so their position auto-detects. An employee + a position, cross-linked:
```sql
-- 1a. the person
insert into public.employees
  (id, organization_id, business_unit_id, department_id, employee_number,
   first_name, last_name, email, job_title, employment_status)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000aa',
   'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005',
   'D011', 'Anesu', 'Moyo', 'audit@rtg.demo', 'Internal Auditor', 'active');

-- 1b. their position in the tree (parent = CEO position a…01), wired both ways
with e as (select id from public.employees where email = 'audit@rtg.demo')
insert into public.organogram_positions
  (id, organization_id, business_unit_id, position_title, level, status,
   count, filled_count, parent_position_id, employee_id, department_id, sort_order, is_active)
select gen_random_uuid(), '00000000-0000-0000-0000-0000000000aa',
   'b0000000-0000-0000-0000-000000000001', 'Internal Auditor', 2, 'filled',
   1, 1, 'a0000000-0000-0000-0000-000000000001', e.id,
   'd0000000-0000-0000-0000-000000000005', 9, true
from e;

-- 1c. point the employee at their new position
update public.employees e set current_position_id = p.id
from public.organogram_positions p
where p.employee_id = e.id and e.email = 'audit@rtg.demo';
```

**Step 2 — Add the app_users row** (project `kidreqxqapouxndqomdp`), same email:
```sql
insert into public.app_users (organization_id, azure_oid, email, display_name, role)
values ('053914de-d77e-4b1e-b87b-97e060cd4d40', 'demo:audit@rtg.demo',
        'audit@rtg.demo', 'Anesu Moyo', 'requester')
on conflict (organization_id, azure_oid) do nothing;
```
> `azure_oid` is required and unique; the `demo:<email>` convention keeps demo
> rows distinct from real Microsoft ones.

**Step 3 — Add the login** (project `kidreqxqapouxndqomdp`):
```bash
node -e "require('argon2').hash(process.argv[1]).then(h=>console.log(h))" 'Demo@2026!'
```
```sql
insert into public.demo_users (email, password_hash, display_name)
values ('audit@rtg.demo', '<paste-hash>', 'Anesu Moyo')
on conflict (email) do update set password_hash = excluded.password_hash;
```

That's it — no redeploy. They can now sign in at the staging URL and, on any
form, will auto-detect as *Internal Auditor*.

> **Tip:** if you only need a new *login* for someone who already exists in the
> org chart (e.g. a second person), you can skip Step 1. If you only need them to
> appear as an *approver* (never logging in themselves), you can skip Step 3.

## Teardown

- Set `DEMO_MODE` / `NEXT_PUBLIC_DEMO_MODE` to unset (or `false`) on staging.
- Optionally `drop table public.demo_users;` on staging.
- Delete the `HRIMS DEMO` Supabase project.
- Re-point staging `HRIMS_SUPABASE_*` at whatever it should normally use.
