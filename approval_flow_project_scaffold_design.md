# ApprovalFlow — Mobile-first Web App Scaffold

**Stack:** Next.js (app router), Tailwind CSS, Supabase (Postgres + Auth/Storage), Azure AD for SSO/OAuth, Lottie for micro-animations.

---

## 1 — Project file structure (scaffold)

```
approvalflow/
├─ app/                        # Next.js App Router
│  ├─ api/                     # API route handlers (server actions / edge functions)
│  ├─ (auth)/                  # auth-related pages (login callback, sign-out)
│  ├─ dashboard/               # main app area
│  │  ├─ [workspace]/          # workspace scoped routes
│  │  │  ├─ approvals/         # approval lists
│  │  │  ├─ requests/          # create / view requests
│  │  │  └─ settings/          # workspace settings
│  ├─ _middleware.ts           # optional global middleware (auth guard)
│  └─ layout.tsx
├─ components/
│  ├─ ui/                      # small UI primitives (Button, Input, Modal)
│  ├─ layout/                  # AppHeader, BottomNav, Drawer, MobileNav
│  ├─ approvals/               # RequestCard, ApproverList, SignaturePad wrapper
│  ├─ animations/              # Lottie wrapper components
│  └─ forms/                   # FormField, FormContainer
├─ lib/
│  ├─ supabaseClient.ts
│  ├─ azureAuth.ts             # helpers for Azure AD token handling (server-side)
│  └─ validators/
├─ hooks/
│  ├─ useCurrentUser.ts
│  ├─ useApprovals.ts
│  └─ useRealtime.ts           # supabase realtime subscriptions
├─ prisma/ or supabase-migrations/ # optional SQL migration files
├─ db/                        # SQL schema docs / seeds
├─ styles/
│  ├─ globals.css
│  └─ tailwind.css
├─ public/
│  └─ lottie/                  # stored lottie JSONs or references
├─ scripts/
│  └─ deploy.sh
├─ .env                        # env vars (local only)
├─ next.config.js
├─ tailwind.config.js
├─ package.json
└─ README.md
```

> Use the App Router (``app/``) for layouts and nested routing; pages can be used if you prefer the pages router.

---

## 2 — Core modules & responsibilities

1. **Auth & Identity**
   - Azure AD SSO, token exchange, and session management.
   - Map Azure AD groups/roles to application roles.
2. **Workspaces / Organizations**
   - Multi-tenant-ish: workspace table to isolate data per organization.
3. **Requests / Documents**
   - Create, attach files, assign approvers, set due dates.
4. **Approval Flows (Workflows)**
   - Sequential and parallel flows; configurable steps.
5. **Signer / eSignature**
   - Basic signature pad + stored signature, or integrate with eSignature provider.
6. **Notifications & Activity**
   - Email + in-app push (Supabase realtime, or webhooks), audit trail.
7. **Admin / Settings**
   - Manage users, roles, workflows, integrations.
8. **Audit & Compliance**
   - Immutable audit log, tamper-evident entries, versioned document storage.

---

## 3 — Database schema (key tables, simplified)

- **workspaces** (id, name, domain, settings, created_at)
- **users** (id, email, display_name, azure_sub, workspace_id, role)
- **requests** (id, workspace_id, creator_id, title, description, status, metadata, created_at, updated_at)
- **request_steps** (id, request_id, step_index, type, approver_role_or_user, status, due_at)
- **approvals** (id, request_id, step_id, approver_id, decision, comment, signed_at)
- **documents** (id, request_id, filename, storage_path, checksum)
- **audit_logs** (id, entity_type, entity_id, actor_id, action, payload, created_at)
- **signatures** (id, user_id, svg_or_image, created_at)

Use Supabase Row Level Security (RLS) policies to restrict reads/writes by workspace and role.

---

## 4 — User roles & access control (suggested)

**Global roles (workspace-scoped):**
- Owner — full control (manage billing, workspace settings, roles)
- Admin — manage users, workflows, templates
- Approver — can approve requests assigned to them
- Requester — can submit requests
- Auditor / Viewer — read-only access for audits

**Permissions matrix (examples):**
- Create request: Requester, Admin, Owner
- Edit request (before any approval): Requester, Admin, Owner
- Approve request: Approver, Admin, Owner
- Manage users/roles: Admin, Owner
- View audit logs: Auditor, Admin, Owner

**Enforcement:**
- Authentication: Azure AD -> create local user record on first login (map `azure_sub`).
- Authorization: Use server-side checks in API routes and RLS in Supabase. Also include client-side guards for UX, but server must enforce.

---

## 5 — Authentication & Authorization (Azure AD + Supabase)

**High-level flow:**
1. Register an app in Azure AD (Azure Portal):
   - Redirect URI(s): your app callback (e.g. `https://app.example.com/api/auth/callback`) and local dev `http://localhost:3000/api/auth/callback`.
   - Configure required API permissions for `openid`, `profile`, `email`.
   - Optionally configure group claims if mapping groups to roles.
2. Use OIDC / OAuth2 authorization code flow to sign in users.
   - Options to implement in Next.js:
     - **NextAuth.js** with the Azure AD provider — easiest for session management.
     - **MSAL (Microsoft Authentication Library)** — more control for advanced MS features.
3. After successful login:
   - Read the `sub` or `oid` claim from token and upsert into `users` table (with workspace mapping).
   - Map Azure groups or custom claims to app roles. Store role in users table.
4. Protect routes:
   - On the server (API routes / server components) verify and decode the access token (JWT) and enforce scope/role checks.
   - Use Supabase RLS to restrict DB access by `auth.uid()` or by custom claims in JWT if you route DB access through Supabase Auth (but here you're using Azure AD; you can issue your own JWT for Supabase or use a service role to validate server-side).

**Implementation suggestions:**
- For a first version use **NextAuth.js** with the Azure AD provider and a secure session cookie. On sign-in callback, call a server function to `upsert` the user into Supabase `users` table.
- For tighter integration (serverless): use Azure AD access token in Authorization header; validate on server using `jwks` and perform RBAC.
- If you want Supabase's built-in Auth to be the primary provider, consider configuring Supabase to accept external OIDC provider (Supabase supports external OAuth/OIDC providers) — however many teams prefer using Azure AD directly for enterprise SSO and keep Supabase as DB only.

---

## 6 — UI / UX ideas & styles

**Design language:**
- Mobile-first: Bottom navigation, large tappable areas (min 44–48px), short lists, single-column cards.
- Minimal, elevated cards, rounded corners (2xl), soft shadows.
- Micro-interactions: Lottie entry/confirm animations for approvals, subtle motion on state change.

**Tailwind config suggestions:**
- base font-size 16px; set `theme.extend` with brand colors, spacing scale, border radius `2xl` as default for cards.
- Example tokens: `--brand-500`, `--accent-400`, `--muted-500`.

**Key screens/components:**
- Onboarding (SSO + workspace selector)
- Dashboard (assigned approvals, pending requests, quick create)
- Request detail (document preview, steps timeline, approve/reject CTA)
- Create request wizard (attach files, set approvers, set approval flow)
- Inbox / Notifications
- Admin: user/role management, workflow templates

**Lottie usage (good places):**
- Empty states (no pending approvals)
- Confirmation after a successful approval
- Micro-feedback when upload completes

**Accessibility:**
- Color contrast checks, keyboard navigation, focus states, aria labels on interactive components.

---

## 7 — Realtime & Notifications

- Use Supabase Realtime (listen on `approvals` and `requests`) to push in-app notifications.
- For email, implement transactional emails (SendGrid or Azure Communication Services).
- Push notifications (future): use web push or mobile wrappers (Expo / PWAs).

---

## 8 — Security & Compliance considerations

- Use HTTPS, secure cookies, and strong CSP.
- Store signatures and documents with checksum and versioning.
- Immutable audit logs (write-only append style) — ensure only server has service_role key to append.
- Retention and data export: workspace owner should be able to export.

---

## 9 — CI/CD & deployment

- Host Next.js on Vercel or Azure App Services / Static Web Apps.
- Use Supabase for DB and storage; configure production and staging projects.
- Protect secrets in environment variables (Azure app secrets, Supabase service role key).

---

## 10 — Roadmap / MVP checklist

**MVP (small):**
- SSO with Azure AD + user mapping.
- Create request + attach files (upload to Supabase Storage).
- Simple sequential approval (single approver step).
- In-app notifications and activity feed.
- Audit log and basic admin UI.

**Next (v1):**
- Parallel flows, templates, signer capture, email notifications, role management UI.
- Mobile PWA behavior, offline draft support.

---

## 11 — Example Tailwind snippet (tailwind.config.js)

```js
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f8ff',
          500: '#2563eb',
        },
      },
      borderRadius: {
        '2xl': '1rem'
      }
    }
  },
  plugins: [],
}
```

---

### Want me to:
- scaffold actual `package.json`, `next.config.js`, `tailwind.config.js`, and a couple of starter components? (I can generate files you can paste)
- or generate example SQL for Supabase and RLS policies?

Tell me which of the above you want next and I will generate files/snippets directly into the project.



---

## 12 — Generated: Supabase SQL schema + RLS (ready-to-run)

> **Note:** run these in your Supabase SQL editor. Replace `pgcrypto` functions availability as needed.

```sql
-- Enable uuid/gen_random_uuid
create extension if not exists "pgcrypto";

-- Organizations (tenants)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  azure_tenant_id text not null unique,
  created_at timestamptz default now()
);

-- Workspaces (optional subdivision of organizations)
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- Users table: app-level users (not Supabase Auth users)
create table app_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  workspace_id uuid references workspaces(id),
  azure_oid text not null,
  email text not null,
  display_name text,
  role text default 'requester', -- owner|admin|approver|requester|auditor
  created_at timestamptz default now(),
  unique(organization_id, azure_oid)
);

-- Example domain table: requests
create table requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  workspace_id uuid references workspaces(id),
  creator_id uuid references app_users(id) not null,
  title text not null,
  description text,
  status text default 'draft', -- draft|pending|approved|rejected
  created_at timestamptz default now()
);

-- Enable RLS on sensitive tables
alter table app_users enable row level security;
alter table organizations enable row level security;
alter table workspaces enable row level security;
alter table requests enable row level security;

-- RLS policies
-- Organizations: read if org id equals claim org_id
create policy "select_org_by_org_id_claim"
  on organizations
  for select
  using ( id::text = (current_setting('jwt.claims', true) ->> 'org_id') );

-- App users: allow select/insert/update only for matching org
create policy "app_users_org_select"
  on app_users
  for select
  using ( organization_id::text = (current_setting('jwt.claims', true) ->> 'org_id') );

create policy "app_users_insert_server"
  on app_users
  for insert
  with check ( organization_id::text = (current_setting('jwt.claims', true) ->> 'org_id') );

create policy "app_users_update_org"
  on app_users
  for update
  using ( organization_id::text = (current_setting('jwt.claims', true) ->> 'org_id') )
  with check ( organization_id::text = (current_setting('jwt.claims', true) ->> 'org_id') );

-- Workspaces
create policy "workspaces_org_select"
  on workspaces
  for select
  using ( organization_id::text = (current_setting('jwt.claims', true) ->> 'org_id') );

-- Requests
create policy "requests_org_select"
  on requests
  for select
  using ( organization_id::text = (current_setting('jwt.claims', true) ->> 'org_id') );

create policy "requests_insert_server"
  on requests
  for insert
  with check ( organization_id::text = (current_setting('jwt.claims', true) ->> 'org_id') );

create policy "requests_update_org"
  on requests
  for update
  using ( organization_id::text = (current_setting('jwt.claims', true) ->> 'org_id') )
  with check ( organization_id::text = (current_setting('jwt.claims', true) ->> 'org_id') );

-- Seed: (example) add the hotel organization (replace with actual tid)
-- insert into organizations (name, azure_tenant_id) values ('Hotel Group', 'REPLACE_WITH_TID');
```

**Important notes for RLS & JWT:**
- The SQL policies above use `current_setting('jwt.claims', true)` which is how Supabase exposes JWT claims to Postgres when the JWT secret on Supabase is configured to accept your JWT issuer's secret. To make this work you must **set your Supabase project's JWT secret** to match the JWT secret used by NextAuth (see below) or configure Supabase to accept an external JWT issuer. This step is in the instructions below.

---

## 13 — Generated: NextAuth (Azure AD) + Supabase provisioning code

I generated a sample Next.js + NextAuth configuration that:
- Uses Azure AD (multi-tenant)
- On sign-in, maps `tid` -> organization in Supabase
- Upserts the user into `app_users` using the Supabase service role key (server-side)
- Adds `org_id` to the NextAuth JWT/session so it becomes available to the client and can be used as a claim for Supabase RLS

> Files added (you'll find these in this canvas):
> - `env.example` (env variables you must set)
> - `pages/api/auth/[...nextauth].ts` (NextAuth config)
> - `lib/supabaseAdmin.ts` (server-side supabase client using service_role key)
> - `lib/supabaseClient.ts` (client for browser, will not contain service key)
> - `lib/authHelpers.ts` (small helpers)

### env.example
```
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace_with_secure_random

# Azure
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret
AZURE_TENANT=common

# Supabase
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_ANON_KEY=anon-public-key
SUPABASE_SERVICE_ROLE_KEY=service_role_key (keep secret)

# IMPORTANT: To enable Supabase to accept your NextAuth JWT claims
# go to Supabase -> Settings -> API -> JWT Secret and set it to NEXTAUTH_SECRET
# (or coordinate with Supabase docs for external JWT configuration)
```

---

### pages/api/auth/[...nextauth].ts

```ts
import NextAuth from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const options = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      // using 'common' allows multi-tenant sign in
      tenantId: process.env.AZURE_TENANT || 'common',
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }) {
      // profile contains oid and tid
      // we allow sign-in only if the tenant exists in our organizations table
      const tid = (profile as any).tid;
      if (!tid) return false;

      // look up organization by tid
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('azure_tenant_id', tid)
        .limit(1)
        .single();

      if (!org) {
        // organization not enabled in your app (Option A)
        return false;
      }

      return true;
    },

    async jwt({ token, user, account, profile, isNewUser }) {
      // On first sign in, add org_id and azure_oid to token
      if (profile) {
        const tid = (profile as any).tid;
        const oid = (profile as any).oid;
        const email = (profile as any).email || token.email;

        // find org
        const { data: org } = await supabaseAdmin
          .from('organizations')
          .select('id')
          .eq('azure_tenant_id', tid)
          .limit(1)
          .single();

        if (org && org.id) {
          token.org_id = org.id;
          token.azure_oid = oid;
          token.email = email;

          // upsert user record in app_users using service role key (server-side)
          await supabaseAdmin.from('app_users').upsert({
            organization_id: org.id,
            azure_oid: oid,
            email: email,
            display_name: token.name || user?.name || null
          }, { onConflict: ['organization_id','azure_oid'] });
        }
      }
      return token;
    },

    async session({ session, token, user }) {
      // expose org_id to the client session
      (session as any).user.org_id = token.org_id;
      (session as any).user.azure_oid = token.azure_oid;
      return session;
    }
  }
};

export default NextAuth(options);
```

---

### lib/supabaseAdmin.ts (server-side only)

```ts
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```


### lib/supabaseClient.ts (browser)

```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

---

## 14 — How to wire Supabase JWT settings (critical)

To have Supabase RLS read the `org_id` claim from your NextAuth JWT, you must configure Supabase to accept the same signing secret.

1. In Supabase dashboard → Settings → API → JWT secret
2. Paste the same secret as `NEXTAUTH_SECRET` (or a compatible secret used by your NextAuth JWT signer)

**Why:** Supabase validates JWTs and exposes claims to Postgres via `current_setting('jwt.claims', true)`. If the secrets don't match, Postgres won't see your claims and RLS policies above will fail.

**Important security note:**
- Using NEXTAUTH_SECRET as Supabase JWT secret means any JWT signed with NEXTAUTH_SECRET will be accepted by your Supabase project. Keep secrets safe and rotate if compromised.

---

## 15 — Next steps I recommend you run locally now

1. Add the `organizations` row for the hotel:
   - Go to Supabase SQL editor and run:
     ```sql
     insert into organizations (name, azure_tenant_id) values ('Hotel Group', 'THE_HOTEL_TENANT_ID');
     ```
2. Set env vars from `env.example` locally and in Vercel when deploying.
3. Start Next.js and visit `/api/auth/signin` to test sign-in. Only users in the tenant you added will be allowed.
4. Test that `session.user.org_id` is populated after sign-in.
5. Test basic DB access via serverless API routes that use `supabaseAdmin`.

---

## 16 — Caveats & alternatives (short)

- **Alternative approach:** Use Supabase Auth and configure Azure as an external provider in Supabase. That delegates user tokens to Supabase and RLS works natively with `auth.uid()`. This can be simpler but ties you to Supabase Auth flows.

- **Security trade:** When you set Supabase JWT secret to NEXTAUTH_SECRET, ensure you protect NEXTAUTH_SECRET carefully.

---

If you'd like, I can now:
- add these code files into the project scaffold in the canvas as actual files (so you can copy), or
- generate API route examples to create `requests` and demonstrate RLS in practice.

Tell me which next step you want and I'll add it to the canvas.

