# INITIATION & PLANNING DOCUMENT

---

## DOCUMENT CONTROL

| Field | Details |
|---|---|
| **Document Title** | Initiation & Planning Document — The Circle Enterprise Approval Platform |
| **System Name** | The Circle |
| **Version** | v1.0 |
| **Author** | AI-Generated (Claude Sonnet 4.6 — Anthropic) — Pending Human Review |
| **Date** | 05 May 2026 |
| **Classification** | INTERNAL — RESTRICTED |
| **Document Status** | Draft — Pending Approval |

---

### Approval Section

| Role | Name | Signature | Date |
|---|---|---|---|
| Prepared by | AI Systems Analysis Agent | *(AI-generated)* | 05 May 2026 |
| Reviewed by | *(Project Owner / Technical Lead)* | | |
| Approved by | *(Executive Sponsor / IT Director)* | | |

---

### Change History

| Version | Date | Author | Description of Change |
|---|---|---|---|
| v1.0 | 05 May 2026 | AI-Generated | Initial document — generated from full codebase and schema analysis |

---

---

## 1. EXECUTIVE SUMMARY

### 1.1 Purpose

The Circle is an enterprise-grade, multi-tenant digital approval and workflow management platform designed to replace manual, paper-based, or ad hoc approval processes across an organisation. It provides a single, governed system through which employees initiate requests — spanning capital expenditure, travel authorisation, accommodation bookings, finance instruments, and custom forms — and through which designated approvers process those requests with cryptographically verifiable, legally defensible audit trails.

### 1.2 Business Value

The platform delivers measurable business value across four dimensions:

- **Control**: Every approval decision is bound to an authenticated identity, a timestamped signature, a device fingerprint, and a risk-assessed authentication ceremony — producing an audit record that can withstand regulatory or legal scrutiny.
- **Efficiency**: Multi-step workflow chains that previously required physical routing, email chasing, or manual sign-off are executed digitally, in parallel or in sequence, with automated notifications at each step.
- **Auditability**: A fully extended audit trail — capturing authentication method, risk level, IP address, device information, signature type, and credential reference — is persisted at the database level for every approval action.
- **Governance**: Role-based access control (RBAC) with scoped assignments, expiring roles, and delegation management ensures that approval authority is always correctly bounded and independently auditable.

### 1.3 Key Capabilities

1. **Dynamic, Data-Driven Workflow Engine**: Approval chains (sequential or parallel) are defined as JSON workflow templates stored in the database. New workflow types can be created without code deployment.
2. **Risk-Based Step-Up Authentication**: Every approval action is risk-scored at the server (low / medium / high) using monetary value, department sensitivity, workflow category, and chain position. Authentication requirements escalate accordingly — from session confirmation through Microsoft Entra MFA to WebAuthn biometric verification.
3. **Electronic Signature Capture**: Approvers may sign using a saved signature, a drawn (canvas) signature, or a typed signature. All signature data is stored and referenced in the audit record.
4. **RBAC with Delegation**: Fine-grained permissions govern every system action. Approval authority can be formally delegated with date-bound, auditable delegation records.
5. **HRIMS Integration**: The system integrates with a separate Human Resource Information Management System (HRIMS) Supabase tenant to resolve approvers dynamically from the live organisational chart — supporting approver types such as department head, line manager, and Nth-level organogram supervisor.
6. **Automated PDF Archiving**: Upon workflow completion, a tamper-evident PDF archive is auto-generated, embedding the request form, approval decisions, signatures, and audit metadata.
7. **Real-Time Notifications**: Supabase real-time subscriptions drive in-app notifications; transactional emails are dispatched via Resend and/or Microsoft Graph Mail.

### 1.4 Architecture and Deployment Summary

The Circle is a server-rendered web application built on **Next.js 14** (React 18, TypeScript 5.7), hosted on a Node.js-compatible platform (Vercel deployment inferred). The primary database is **Supabase** (PostgreSQL with real-time subscriptions and object storage). Authentication is federated through **Microsoft Entra ID** (Azure AD) via NextAuth, supplemented by **WebAuthn** biometric credentials. A secondary Supabase tenant hosts the HRIMS organogram data. The backend consists entirely of Next.js API routes under `/pages/api`, with core business logic centralised in a dedicated `/lib` directory.

---

---

## 2. BUSINESS CONTEXT

### 2.1 Problem Statement

Organisations managing approval-intensive processes — capital expenditure authorisation, travel approvals, finance instruments, accommodation requests — face recurring operational and governance failures under manual regimes:

- **No enforceable authentication**: A paper or email approval cannot prove the approver's identity was verified at the moment of decision.
- **No structured audit trail**: Decision rationale, timestamps, and the identity of the approver are dispersed across inboxes and filing systems.
- **Workflow opacity**: Requesters cannot see where their request sits in the approval chain or what is blocking progress.
- **Delegation risk**: Ad hoc delegations (email, verbal) are untracked and non-auditable.
- **No risk differentiation**: A \\$500 petty cash request and a \\$2,000,000 capital expenditure are processed through the same casual email chain.

### 2.2 Current Business Process (Inferred)

Prior to The Circle, the following manual process is presumed to have been in operation:

1. Requester completes a paper or Word/Excel-based form.
2. Form is submitted via email to the first approver.
3. Approver reviews and manually forwards to the next approver, or physically signs and routes.
4. HR/Finance manually records the outcome.
5. No structured archive is created; audit reconstruction requires searching email history.

### 2.3 Target Improved Process

Post-implementation, the target process is:

1. Requester logs into The Circle (authenticated via Microsoft Entra SSO).
2. Requester selects the appropriate request type and completes a structured, validated digital form.
3. The workflow engine automatically initialises the approval chain (sequential or parallel) from the applicable workflow template.
4. Each approver receives a real-time notification and email.
5. Approver authenticates at the level required by the system's risk assessment (session / MFA / biometric) and submits a signed decision.
6. The system routes to the next step (sequential) or aggregates decisions (parallel).
7. On completion, a PDF archive is auto-generated and stored.
8. All actors can view real-time workflow status throughout.

### 2.4 Business Drivers

| Driver | Description |
|---|---|
| **Regulatory Compliance** | Finance and HR processes require demonstrable approval controls for internal audit, external audit, and potential regulatory inspection. |
| **Fraud Prevention** | High-value approvals (CAPEX, financial instruments) require identity-binding authentication to prevent unauthorised or fraudulent authorisation. |
| **Operational Efficiency** | Reduction in approval cycle time through automated routing, notifications, and parallel processing. |
| **Governance Maturity** | Delegation management, expiring roles, and scoped RBAC support a maturity uplift in access governance. |
| **Auditability** | Immutable, timestamped, device-fingerprinted approval records support both internal and external audit requirements. |

---

---

## 3. STAKEHOLDER IDENTIFICATION

### 3.1 Stakeholder Table

| Role | Responsibilities | System Interaction |
|---|---|---|
| **Requester (Standard User)** | Initiates requests; tracks own request status; withdraws draft requests. | Creates requests; views own requests; responds to information requests; downloads approved archives. |
| **Approver** | Reviews requests assigned to their workflow step; approves or rejects with comment and signature; may delegate authority. | Receives notifications; authenticates (risk-appropriate); signs and submits decisions; manages delegations. |
| **HR Director / Finance Approver** | Responsible for cost allocation decisions on travel and accommodation requests; holds sensitive departmental approval authority. | Specific step in travel/accommodation workflows; high-risk authentication required; allocates cost centres. |
| **System Administrator** | Manages users, roles, and permissions; configures workflows and form templates; monitors system settings. | Full access to `/admin` panel; manages `roles`, `user_roles`, `workflow_definitions`, `system_settings`. |
| **Workflow Designer** | Designs and maintains workflow templates and form schemas stored in the database. | Accesses workflow and form template management APIs; configures step types, approver resolution, conditions. |
| **Department Head** | May be dynamically resolved as an approver by the workflow engine for departmental requests. | Approver role; receives targeted notifications; authenticates per risk level. |
| **Line Manager** | Resolved dynamically via HRIMS as the requester's direct supervisor for manager-type approval steps. | Approver role; resolved at workflow runtime via HRIMS organogram integration. |
| **IT / Platform Support** | Maintains the platform, monitors infrastructure, manages database migrations, handles incidents. | Supabase dashboard; deployment pipeline; environment variable management; error log review. |
| **Internal Auditor** | Reviews approval records, audit trails, RBAC logs, and archived PDFs for compliance and forensic purposes. | Read-only access to audit logs, approval records, archived documents, RBAC audit log. |
| **Executive Sponsor** | Oversees the platform's strategic alignment; approves major changes; receives dashboard KPI reports. | Dashboard / reports view; escalation recipient for overrides. |
| **HRIMS System** | Provides live organogram, employee, department, and position data to resolve dynamic approvers. | External system; integrated via a dedicated Supabase tenant; queried via `hrimsClient.ts`. |

---

---

## 4. SCOPE DEFINITION

### 4.1 In-Scope Features

The following capabilities are within scope for the current system:

| # | Feature | Status |
|---|---|---|
| 1 | Multi-step approval workflow engine (sequential and parallel modes) | Implemented |
| 2 | Risk-based step-up authentication (low / medium / high, biometric / MFA / session) | Implemented |
| 3 | Electronic signature capture (saved, drawn canvas, typed) | Implemented |
| 4 | Extended audit trail (auth method, risk level, IP, device info, signature reference) | Implemented |
| 5 | RBAC system with scoped roles, expiring assignments, and delegation | Implemented |
| 6 | Request types: CAPEX, Travel Authorisation, Accommodation, Petty Cash, Voucher, Credit/Debit Note, Journal | Implemented |
| 7 | Custom/dynamic form templates via form builder | Implemented |
| 8 | HRIMS organogram integration for dynamic approver resolution | Implemented |
| 9 | Microsoft Entra ID SSO authentication | Implemented |
| 10 | WebAuthn biometric credential registration and authentication | Implemented |
| 11 | Elevation session cookies (step-up auth reuse within configurable TTL) | Implemented |
| 12 | Automated PDF archive generation on workflow completion | Implemented |
| 13 | Real-time in-app notifications and transactional email notifications | Implemented |
| 14 | Approval delegation with date-bounded active windows | Implemented |
| 15 | CAPEX tracker (capital expenditure lifecycle: awaiting funding → approved → complete) | Implemented |
| 16 | E-signature workflow (sign existing PDFs) | Implemented |
| 17 | Dashboard with KPI metrics and SLA compliance reporting | Implemented |
| 18 | Cost allocation for travel/accommodation requests (HR Director step) | Implemented |
| 19 | Reference code generation per request type | Implemented |
| 20 | Archived document storage (Supabase Storage) | Implemented |
| 21 | Admin panel: user management, system settings, RBAC management | Implemented |
| 22 | Mobile signature capture interface | Implemented (page exists) |

### 4.2 Out-of-Scope

The following are explicitly **outside** the current system boundary:

| # | Item | Rationale |
|---|---|---|
| 1 | HRIMS core HR management (employee records, payroll, leave) | The Circle consumes HRIMS data; it does not manage it. HRIMS is a separate system. |
| 2 | Financial ledger / ERP integration | The Circle captures approval decisions; it does not post entries to financial systems. *(Assumption — no ERP integration code found.)* |
| 3 | Document version control / DMS | The Circle archives approved documents; it does not provide full document lifecycle management. |
| 4 | External supplier / vendor portal | All users are internal employees authenticated via Microsoft Entra. |
| 5 | Mobile native application (iOS/Android) | The system is a responsive web application; no native app code is present. |
| 6 | Offline operation | The platform requires network connectivity to Supabase and Microsoft Entra. |
| 7 | Multi-tenancy management UI | While the data model includes `organizations`, there is no visible tenant onboarding UI. *(Assumption.)* |

### 4.3 Assumptions

*(See also Section 13 — Assumptions Log for full list.)*

1. The organisation uses Microsoft Entra ID (Azure AD) as the identity provider for all employees.
2. An HRIMS system is in operational use and its Supabase tenant is maintained by a separate team.
3. The platform is deployed to a Vercel-compatible Node.js hosting environment.
4. All users access the system via modern browsers supporting WebAuthn (FIDO2).
5. Supabase row-level security (RLS) policies are either applied or are a planned control. *(Not confirmed from codebase — marked as a gap.)*
6. The system operates within a single organisational tenant at this stage of development.

### 4.4 Constraints

| Type | Constraint |
|---|---|
| **Technical** | WebAuthn biometric authentication requires a secure origin (HTTPS) and a compatible browser/device; users without biometric hardware fall back to Microsoft MFA. |
| **Technical** | The HRIMS integration depends on a live, separately maintained Supabase tenant; organogram resolution fails if HRIMS is unavailable. |
| **Technical** | Step-up token TTL is 120 seconds by default; approval actions must be completed within this window after the authentication ceremony. |
| **Operational** | Workflow template changes require administrative access and database-level understanding; no end-user visual workflow designer is confirmed at this time. |
| **Security** | `NEXTAUTH_SECRET` is used both for session JWT signing and step-up token signing; rotation of this secret invalidates all active sessions and pending step-up tokens simultaneously. |
| **Compliance** | Supabase row-level security (RLS) status is unconfirmed; without RLS, authorisation relies entirely on API-layer RBAC checks, which creates a defence-in-depth gap. |
| **Regulatory** | Digital signatures captured via the system may not meet the legal threshold for qualified electronic signatures (QES) under eIDAS or equivalent legislation without additional certification. *(Assumption — legal review required.)* |

---

---

## 5. SYSTEM OVERVIEW

### 5.1 Architecture Summary

The Circle follows a **server-rendered full-stack web architecture** with the following layers:

```
┌─────────────────────────────────────────────────────────┐
│                   CLIENT BROWSER                        │
│  React 18 / Next.js 14 (TypeScript, Tailwind CSS)       │
│  WebAuthn Browser API │ Microsoft Entra Popup Auth      │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────┐
│              NEXT.JS APPLICATION SERVER                  │
│  Pages / App Router │ API Routes (/pages/api)           │
│  NextAuth (session) │ Approval Engine │ RBAC Engine     │
│  Risk Evaluator │ Step-Up Token Issuer │ PDF Generator  │
└──────┬──────────────────────────────┬────────────────────┘
       │                              │
┌──────▼──────────┐        ┌──────────▼──────────────────┐
│  SUPABASE (Main) │        │   SUPABASE (HRIMS Tenant)   │
│  PostgreSQL DB   │        │   Organogram / Employees    │
│  Storage Buckets │        │   Departments / Positions   │
│  Real-time Subs  │        └─────────────────────────────┘
└─────────────────┘
       │
┌──────▼────────────────────────────────────────────────────┐
│            EXTERNAL SERVICES                              │
│  Microsoft Entra ID (SSO, MFA step-up, Graph Mail)        │
│  Resend (Transactional Email)                             │
└───────────────────────────────────────────────────────────┘
```

### 5.2 Technology Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend Framework** | Next.js | 14.2.5 |
| **UI Library** | React | 18.3.1 |
| **Language** | TypeScript | 5.7 (strict mode) |
| **Styling** | Tailwind CSS | 3.4 |
| **Animation** | Framer Motion | 12.23.25 |
| **Icons** | Lucide React | 0.563 |
| **Charts** | Recharts | 3.7.0 |
| **PDF Generation/Manipulation** | React PDF, PDF-lib, PDFKit | 10.4.1 / 1.17.1 / 0.17.2 |
| **QR Code** | QRCode.React | 4.2.0 |
| **Primary Database** | Supabase (PostgreSQL) | 2.45.0 |
| **Authentication** | NextAuth | 4.24.7 |
| **Identity Provider** | Microsoft Entra ID (Azure AD) | — |
| **Biometric Authentication** | SimpleWebAuthn (FIDO2/WebAuthn) | 13.3.0 |
| **Password Hashing** | Argon2 | 0.44.0 |
| **Email (Transactional)** | Resend | 6.9.3 |
| **Email (Microsoft)** | Microsoft Graph Mail API | — |
| **Hosting** | Vercel (inferred) | — |

### 5.3 Key Modules

| Module | Location | Description |
|---|---|---|
| **Approval Engine** | `lib/approvalEngine.ts` | Core workflow processor: create requests, initialise steps, process decisions, resolve approvers, evaluate conditions. |
| **Risk Evaluator** | `lib/approvalRisk.ts` | Deterministic risk classification: maps request attributes to low/medium/high risk with required auth method. |
| **Elevated Session Manager** | `lib/elevatedSession.ts` | Issues, verifies, and clears httpOnly elevation cookies for step-up auth reuse. |
| **Step-Up Token Engine** | `lib/stepUpToken.ts` | HS256 JWT tokens binding an authentication event to an approval action; time-limited (120s default). |
| **RBAC Engine** | `lib/rbac.ts` | Full role/permission system: assign, revoke, check, scope, audit. |
| **HRIMS Client** | `lib/hrimsClient.ts` | Integration layer to the HRIMS Supabase tenant: fetch employees, organogram tree, resolve approval chains. |
| **Reference Code Generator** | `lib/requestCode.ts` | Generates human-readable, type-prefixed, timestamp-randomised request reference codes. |
| **Approval Action API** | `pages/api/approvals/action.ts` | Primary server-side enforcement point: re-evaluates risk, verifies step-up token, executes approval decision. |
| **Request API** | `pages/api/requests/index.ts` | Request creation with workflow initialisation; visibility-filtered request listing. |
| **PDF Archive API** | `pages/api/archives/generate-pdf.ts` | Auto-generates approval archive PDF on workflow completion. |
| **WebAuthn API** | `pages/api/webauthn/` | Biometric credential registration and assertion verification. |
| **Step-Up API** | `pages/api/stepup/ms/` | Microsoft MFA step-up ceremony initiation and callback processing. |
| **Elevation API** | `pages/api/auth/elevation.ts` | Elevation state query and revocation. |

### 5.4 External Integrations

| Integration | Purpose | Dependency Level |
|---|---|---|
| **Microsoft Entra ID** | Primary SSO authentication; MFA step-up ceremony; Graph Mail API for notifications | **Critical** — login is unavailable without this |
| **HRIMS (Supabase Tenant)** | Organogram data for dynamic approver resolution | **High** — workflows using organogram-type approvers fail if unavailable |
| **Supabase (Primary)** | All application data, file storage, real-time notifications | **Critical** — platform is non-functional without this |
| **Resend** | Transactional email notifications (approval requests, decisions) | **Medium** — platform functions; notifications degrade |
| **Microsoft Graph Mail** | Alternative email routing (delegate mail) | **Low** — fallback/supplement to Resend |

---

---

## 6. HIGH-LEVEL PROCESS FLOWS

### 6.1 Request Lifecycle — Sequential Approval

**Actors**: Requester, Approver(s) (N steps), System, Notification Engine, Archive Service

```
Step 1 — Request Initiation
  Actor: Requester
  Action: Select request type → Complete dynamic form → Submit (or save as Draft)
  System: Generates reference code (e.g. LTA-05052026-1430-A7)
           Evaluates workflow template → Initialises request_steps
           Sets Step 1 to "pending"; Steps 2..N to "waiting"
           Sends notification + email to Step 1 approver

Step 2 — Approval Decision (Step 1)
  Actor: Approver 1
  System: Evaluates risk server-side (monetary value, department, category, chain position)
           Risk LOW:    Session authentication sufficient
           Risk MEDIUM: Requires Microsoft Entra MFA step-up token
           Risk HIGH:   Requires WebAuthn biometric step-up token
  Action: Approver completes authentication ceremony → Selects signature → Adds comment → Submits
  System: Verifies step-up token (method, binding, expiry)
           Records decision in approvals table (with signature, auth method, device info, IP)
           Marks Step 1 as "approved" (or "rejected")

  Decision Point A: REJECTED?
    Yes → Request status set to "rejected" → Requester notified → END
    No  → Continue to Step 3

Step 3 — Sequential Progression
  System: Marks Step 2 as "pending"
           Sends notification + email to Step 2 approver
  Action: Repeat Step 2 logic for each subsequent approver

Step 4 — Final Approval
  System: All steps approved → Request status set to "approved"
           Triggers PDF archive generation
           Stores archive in Supabase Storage + archived_documents table
           Notifies requester and relevant watchers

Decision Point B: DELEGATION ACTIVE?
  Yes → ApprovalEngine resolves delegate → Routes to delegate's account
  No  → Routes to originally resolved approver
```

---

### 6.2 Request Lifecycle — Parallel Approval

```
Step 1 — Request Initiation
  (Same as Sequential — see 6.1)
  System: All steps set to "pending" simultaneously
           All approvers notified simultaneously

Step 2 — Independent Decisions
  Each approver independently authenticates + approves/rejects
  System: Records each decision independently (no ordering constraint)

Step 3 — Aggregation
  System: After each decision, checks if all steps are resolved

  Decision Point A: ANY REJECTED?
    Yes → Request status set to "rejected" → Requester notified → END
    No  → Continue

  Decision Point B: ALL APPROVED?
    Yes → Request status set to "approved" → Archive generated → END
    No  → Continue waiting for remaining approvers
```

---

### 6.3 Risk-Based Authentication Ceremony

**Actor**: Approver
**Trigger**: Approver initiates approval action on request detail page

```
Step 1 — Client Risk Pre-Assessment
  System (client): Calls getApprovalRisk() with request metadata
  Displays risk badge and required authentication method to approver

Step 2 — Elevation Check
  System: Checks active elevation cookie (httpOnly)
  If valid and within TTL (default 15 min) → skip ceremony → proceed to Step 5
  If expired or absent → continue to Step 3

Step 3 — Authentication Ceremony
  Risk LOW:
    Modal shows confirmation prompt → one-click confirm
    authMethod = "session"

  Risk MEDIUM:
    System calls /api/stepup/ms/initiate → returns OAuth URL
    Microsoft Entra MFA popup launched
    Callback to /api/stepup/ms/callback → verifies token → issues step-up JWT
    authMethod = "microsoft_mfa"

  Risk HIGH:
    System checks if user has registered WebAuthn credential
    If YES: WebAuthn challenge issued → user verifies biometric
             /api/webauthn/authenticate/verify → issues step-up JWT
             authMethod = "biometric"
    If NO:  Fallback to Microsoft MFA (inclusivity provision)
             authMethod = "microsoft_mfa"

Step 4 — Elevation Cookie Issued
  System: Sets httpOnly elevation cookie (TTL = org setting, default 15 min)
  Subsequent approvals within TTL window bypass ceremony

Step 5 — Approval Submission
  Client POSTs to /api/approvals/action:
    { requestId, stepId, action, signatureType, signatureData, stepUpToken, authMethod, deviceInfo }
  Server re-evaluates risk (authoritative — client value not trusted)
  Server verifies stepUpToken (method rank, binding, expiry)
  If satisfied: ApprovalEngine.processApprovalAction() executed
  If not satisfied: 401 Unauthorized returned

Step 6 — Audit Record Created
  approvals row inserted with:
    decision, comment, signature_type, signature_reference,
    authentication_method, risk_level, auth_reference,
    ip_address, device_info (userAgent, platform, timezone, language)
```

---

### 6.4 Approval Delegation Flow

```
Step 1 — Delegation Configuration
  Actor: Original Approver (with approvals.configure_delegation permission)
  Action: Creates approval_delegations record:
    { delegator_id, delegate_id, start_date, end_date, scope }

Step 2 — Delegation Resolution
  System: On each workflow step initialisation, calls resolveDelegate()
  Checks: Is there an active delegation for this approver (within start_date..end_date)?
  If YES: Routes step to delegate user → delegate receives notification
  If NO:  Routes to original approver

Step 3 — Audit
  Delegation used in approval → recorded in audit trail
  All delegation records retained (RBAC audit log)
```

---

### 6.5 CAPEX Tracker Flow

```
Step 1 — CAPEX Request Submitted
  System: On request creation with type = "capex" or "capital_expenditure"
           Creates capex_tracker row with status = "awaiting_funding"

Step 2 — Request Approved
  System: Workflow reaches approved status
           capex_tracker updated to "approved"

Step 3 — Funding Confirmed
  Actor: Finance administrator
  Action: Marks CAPEX tracker item as "funding_complete"

Step 4 — Lifecycle Tracking
  All CAPEX status transitions visible in CAPEX-specific view (/requests/capex)
  Archive PDF linked to tracker record
```

---

---

## 7. RISK IDENTIFICATION — INITIAL RISK REGISTER

### 7.1 Risk Assessment Matrix

| Risk ID | Risk | Description | Impact | Likelihood | Overall | Mitigation |
|---|---|---|---|---|---|---|
| **SEC-01** | Step-up token replay | A valid step-up token could theoretically be intercepted and replayed to authorise an unintended approval. | HIGH | LOW | MEDIUM | Tokens are bound to requestId+stepId; 120-second TTL; HS256 signature via NEXTAUTH_SECRET. Replay window is narrow. |
| **SEC-02** | Elevation cookie scope too broad | Elevation cookies are issued as "unbound" (no requestId/stepId), allowing reuse across multiple approvals within the TTL window. A compromised session could leverage an elevation cookie to approve multiple high-risk requests. | HIGH | MEDIUM | HIGH | **Current Gap**: Organisational policy should define acceptable TTL. Consider binding elevation cookies to a single approval session for HIGH-risk requests. |
| **SEC-03** | NEXTAUTH_SECRET dual-use | The same secret signs both session JWTs and step-up tokens. A compromise of this secret undermines all authentication boundaries simultaneously. | CRITICAL | LOW | HIGH | Secret rotation policy required. Recommend deriving a separate HMAC key for step-up tokens. Regular rotation procedure should be documented and tested. |
| **SEC-04** | Supabase RLS not confirmed | If row-level security (RLS) policies are not enforced at the database level, all data access control relies solely on API-layer RBAC checks. A direct database connection or compromised service role key bypasses all controls. | CRITICAL | MEDIUM | HIGH | **Current Gap**: Implement and document RLS policies for all sensitive tables (requests, approvals, user_roles, etc.). Supabase service role key access must be restricted to server-only code. |
| **SEC-05** | Service role key exposure | The Supabase service role key grants unrestricted database access. If leaked (e.g. via accidental commit or environment variable exposure), all data is compromised. | CRITICAL | LOW | HIGH | Key must never appear in client-side code. Confirm `SUPABASE_SERVICE_ROLE_KEY` is only used in server-side API routes. `.env.local` must not be committed to version control. |
| **SEC-06** | WebAuthn credential management | If a user registers a biometric credential on a shared or compromised device, HIGH-risk approvals could be authorised by an unintended party. | HIGH | LOW | MEDIUM | Users should be educated not to register credentials on shared devices. Credential revocation capability must be operational (WebAuthn credentials API exists). |
| **SEC-07** | Biometric fallback downgrade | The system falls back from WebAuthn (HIGH-risk) to Microsoft MFA when no biometric credential is registered. This effectively reduces the authentication assurance level for HIGH-risk approvals for unconfigured users. | HIGH | MEDIUM | HIGH | **Current Gap**: Policy must mandate biometric enrolment for roles that regularly approve HIGH-risk requests. A grace period with forced enrolment prompt should be implemented. |
| **SEC-08** | Signature legal sufficiency | Drawn canvas signatures and typed text signatures may not constitute qualified electronic signatures (QES) under eIDAS or equivalent local legislation. | HIGH | MEDIUM | HIGH | **Current Gap**: Legal review required. Consider integrating a QES provider (e.g. DocuSign, Adobe Sign) for legally regulated document types. |
| **SEC-09** | HRIMS tenant access | The HRIMS Supabase service role key is stored in environment variables. Compromise of this key exposes all employee and organogram data in the HRIMS tenant. | HIGH | LOW | MEDIUM | Principle of least privilege: HRIMS integration should use a read-only, restricted API key. |
| **PRO-01** | Workflow bypass via API | A technically capable user could attempt to call `/api/approvals/action` directly with a fabricated payload, bypassing the client-side risk assessment. | HIGH | LOW | MEDIUM | Risk is re-evaluated server-side (authoritative) in `action.ts`. Step-up token is server-verified. Session must be valid. Mitigated by design. |
| **PRO-02** | Delegation abuse | An approver could configure a delegation to an account they control, effectively self-approving requests. | HIGH | LOW | MEDIUM | **Current Gap**: Delegation records should be reviewed by a supervisor or system admin. Automated alerts for self-delegation attempts should be implemented. |
| **PRO-03** | Orphaned workflow steps | If an HRIMS position is vacated (employee leaves), dynamically resolved approvers (organogram_position type) may fail to resolve, blocking a workflow. | MEDIUM | MEDIUM | MEDIUM | HRIMS data currency is an operational dependency. Fallback approver or exception routing logic should be designed. Admin notification on resolution failure is needed. |
| **PRO-04** | Parallel approval denial manipulation | In parallel mode, a single approver can reject a request and block the workflow before all other approvers have reviewed it. | MEDIUM | LOW | LOW | This is by design (any rejection fails the request). If undesirable, a voting-threshold model (e.g. majority approval) should be considered per workflow. |
| **TECH-01** | HRIMS unavailability | If the HRIMS tenant is unavailable, workflows requiring organogram-based approver resolution will fail at step initialisation or notification. | HIGH | LOW | MEDIUM | Implement graceful degradation: cache last-known organogram state; surface clear error to admins; allow manual approver assignment as fallback. |
| **TECH-02** | Supabase single-tenant dependency | The platform has a hard dependency on a single Supabase project. An outage renders the platform entirely unavailable. | CRITICAL | LOW | MEDIUM | Supabase Pro/Enterprise tier with point-in-time recovery. Documented RTO/RPO targets. Regular backup verification. |
| **TECH-03** | PDF generation at scale | PDF archive generation is triggered synchronously on final approval. Under high load, this may introduce latency or failures in the approval completion response. | MEDIUM | MEDIUM | MEDIUM | Move PDF generation to an asynchronous background job (e.g. Supabase Edge Function, n8n workflow). |
| **TECH-04** | Real-time subscription leak | Supabase real-time subscriptions, if not properly cleaned up on component unmount, may accumulate open connections, degrading performance. | LOW | MEDIUM | LOW | Code review of `useRealtime.ts` and subscription lifecycle management. |
| **COMP-01** | Audit log immutability | Approval records in the `approvals` table are standard mutable database rows. A database administrator could alter or delete audit records. | HIGH | LOW | MEDIUM | **Current Gap**: Implement append-only audit table via database triggers or Supabase policies that prevent UPDATE/DELETE on `approvals`. Consider write-once object storage for archive PDFs. |
| **COMP-02** | Data retention policy absent | No data retention or purging policy is observable in the codebase. Indefinite retention of personal data (device info, IP addresses) may conflict with data protection regulations (e.g. GDPR, local equivalents). | MEDIUM | HIGH | HIGH | **Current Gap**: Define and implement a documented data retention and purging policy. Ensure personal data fields (ip_address, device_info) are treated as personal data under applicable law. |

---

---

## 8. COMPLIANCE & GOVERNANCE CONSIDERATIONS

### 8.1 ISO/IEC 27001 — Information Security Management

| Control Domain | System Implementation | Status |
|---|---|---|
| **A.9 — Access Control** | RBAC with granular permissions (requests.*, approvals.*, admin.*, etc.); scoped role assignments (dept/BU); expiring role assignments; delegation with date bounds. | **Implemented** — Comprehensive. RLS at DB layer unconfirmed (gap). |
| **A.9.4 — System and Application Access** | NextAuth session management; Microsoft Entra SSO; WebAuthn biometric; Microsoft MFA step-up; elevation cookies with TTL. | **Implemented** — Strong. Biometric enrolment mandate policy gap noted. |
| **A.10 — Cryptography** | HS256 step-up tokens signed with NEXTAUTH_SECRET; httpOnly, Secure, SameSite elevation cookies; Argon2 password hashing. | **Implemented** — Adequate. Dual-use of NEXTAUTH_SECRET is a noted risk (SEC-03). |
| **A.12.4 — Logging and Monitoring** | Extended audit trail in `approvals` table: decision, signature, auth method, risk level, IP, device info, credential reference. RBAC audit log (`rbac_audit_log`). | **Implemented** — Good depth. Immutability of audit records not enforced (gap, COMP-01). |
| **A.14 — System Acquisition, Development and Maintenance** | TypeScript strict mode; server-side re-evaluation of all risk/auth decisions; input validation at API boundary. | **Partially Implemented** — No observable automated security scanning pipeline. |
| **A.18 — Compliance** | Digital signature capture; audit trail depth supports evidential requirements. | **Partial Gap** — Legal sufficiency of signatures under QES frameworks not addressed (SEC-08). |

### 8.2 ISO 9001 — Quality Management

| Principle | System Implementation | Status |
|---|---|---|
| **Process Approach** | Data-driven, template-based workflow engine ensures consistent process execution across all request types. | **Implemented** |
| **Evidence-Based Decision Making** | Every approval decision is recorded with context, rationale (comment), and authentication evidence. | **Implemented** |
| **Continuous Improvement** | Dashboard KPI metrics and SLA compliance reports provide quantitative data for process improvement. | **Implemented** |
| **Customer Focus** | Real-time notifications, transparent workflow status, and request tracking keep requesters informed throughout the process. | **Implemented** |
| **Documented Information** | Workflow definitions, form templates, and approval archives constitute documented process records. | **Implemented** — Archive PDF completeness should be verified. |

### 8.3 ISO/IEC 20000 — Service Management

| Requirement | System Implementation | Status |
|---|---|---|
| **Incident Management** | No observable incident management module within the platform itself. Platform errors are surfaced to end users; escalation path not defined within the system. | **Gap** |
| **Change Management** | Workflow definitions and form templates can be modified by admins. No change management workflow (approval for config changes) is evident. | **Gap** — Admin configuration changes bypass the approval engine they configure. |
| **Service Level Management** | SLA compliance reports (`/reports`) suggest SLA targets exist. SLA thresholds themselves are not visible in configurable settings. | **Partial** — SLA configuration mechanism not confirmed. |
| **Availability Management** | No internal health check, status page, or availability monitoring is observable in the codebase. | **Gap** |
| **Continuity Management** | Supabase backup capability exists at the infrastructure level but no application-level continuity procedure is documented. | **Gap** |

### 8.4 Identified Compliance Gaps Summary

| Gap ID | Description | Severity | Recommended Action |
|---|---|---|---|
| **GAP-01** | Supabase RLS policies not confirmed | HIGH | Implement RLS for all sensitive tables; document policies. |
| **GAP-02** | Audit record immutability not enforced | HIGH | Implement DB-level append-only enforcement on `approvals` table. |
| **GAP-03** | Data retention policy absent | HIGH | Define retention periods; implement purging for personal data fields. |
| **GAP-04** | Biometric enrolment mandate absent | MEDIUM | Require enrolment for HIGH-risk approver roles; implement forced setup prompt. |
| **GAP-05** | Legal sufficiency of electronic signatures | HIGH | Obtain legal review; consider QES integration for regulated document types. |
| **GAP-06** | Admin configuration change control absent | MEDIUM | Route workflow/form template changes through a review and approval process. |
| **GAP-07** | NEXTAUTH_SECRET dual-use | MEDIUM | Derive separate HMAC key for step-up tokens; document rotation procedure. |
| **GAP-08** | No incident/availability management | MEDIUM | Implement health check endpoint; define escalation and incident response procedures. |
| **GAP-09** | Delegation self-approval risk | MEDIUM | Add supervisor review requirement or automated alert for delegation configuration. |
| **GAP-10** | HRIMS failover/fallback absent | MEDIUM | Implement organogram caching and manual approver fallback. |

---

---

## 9. HIGH-LEVEL PROJECT PLAN

### 9.1 Reconstructed Development Phases

Based on system complexity, commit history, and feature completeness, the following development phases are inferred:

| Phase | Name | Key Activities | Status |
|---|---|---|---|
| **Phase 1** | Foundation & Authentication | Next.js scaffolding; Supabase schema design; Microsoft Entra SSO integration; NextAuth configuration; basic RBAC structure; user management API. | **Complete** |
| **Phase 2** | Core Workflow Engine | Workflow definition data model; sequential approval engine; request creation and lifecycle management; step initialisation; basic notification system; reference code generation. | **Complete** |
| **Phase 3** | Request Type Expansion | CAPEX form and tracker; Travel Authorisation with cost allocation; Accommodation bookings (complimentary and external); Petty Cash, Voucher, Journal, Credit/Debit Note forms; dynamic form templates. | **Complete** |
| **Phase 4** | Security Uplift — Step-Up Auth | Risk classification engine (`approvalRisk.ts`); step-up token architecture (`stepUpToken.ts`); WebAuthn biometric registration and verification; Microsoft MFA step-up ceremony; elevation session cookies; `ApprovalConfirmModal` orchestrator. | **Complete** |
| **Phase 5** | Electronic Signatures & Archiving | Signature pad component; saved/drawn/typed signature handling; signature storage in Supabase Storage; PDF archive auto-generation on workflow completion; archived_documents table. | **Complete** |
| **Phase 6** | HRIMS Integration | HRIMS client (`hrimsClient.ts`); organogram-based approver resolution; supervisor chain walking; employee profile sync; `useUserHrimsProfile` hook. | **Complete** |
| **Phase 7** | Governance & Delegation | Approval delegation model; RBAC scoped/expiring roles; `rbac_audit_log`; extended audit trail fields (auth_method, risk_level, ip_address, device_info); parallel approval mode. | **Complete** |
| **Phase 8** | Reporting, Dashboard & Admin** | KPI dashboard; SLA compliance reports; admin panel (user/role/workflow management); system settings (elevation TTL, org preferences); CAPEX tracker lifecycle. | **Complete (Substantial)** |
| **Phase 9** | Hardening & Compliance** | Supabase RLS implementation; audit immutability enforcement; data retention policy; biometric enrolment mandate; legal signature review; security scanning pipeline; incident management. | **IN PROGRESS / PLANNED** |
| **Phase 10** | Production Readiness & Go-Live | End-to-end testing; load testing; penetration testing; user acceptance testing; training material; go-live plan; post-launch support model. | **PLANNED** |

---

---

## 10. SUCCESS CRITERIA

The following measurable success criteria are defined for The Circle:

### 10.1 Process Integrity

| Criterion | Measure | Target |
|---|---|---|
| **Workflow Completion Integrity** | Percentage of submitted requests that complete the full approval chain without manual intervention | ≥ 98% |
| **Approver Resolution Rate** | Percentage of workflow steps where the approver is successfully resolved (no orphaned steps) | ≥ 99.5% |
| **Correct Risk Classification** | Proportion of approvals where the server-side risk assessment correctly categorises the request | 100% (deterministic function) |
| **Authentication Enforcement** | Percentage of MEDIUM/HIGH risk approvals with a verified step-up token in the audit record | 100% |

### 10.2 Efficiency

| Criterion | Measure | Target |
|---|---|---|
| **Cycle Time Reduction** | Average elapsed time from request submission to final approval decision vs. manual baseline | ≥ 50% reduction |
| **Notification Latency** | Time between approval action and next approver notification | < 60 seconds |
| **Manual Intervention Rate** | Percentage of approval cycles requiring admin intervention to unblock | < 2% |

### 10.3 Audit & Traceability

| Criterion | Measure | Target |
|---|---|---|
| **Audit Record Completeness** | Percentage of approval decisions with a complete audit record (all required fields populated) | 100% |
| **Archive Generation Success** | Percentage of completed workflows with a successfully generated and stored PDF archive | ≥ 99% |
| **Signature Capture Rate** | Percentage of approvals with a captured signature reference | 100% |

### 10.4 System Reliability

| Criterion | Measure | Target |
|---|---|---|
| **Platform Availability** | Measured uptime (excluding planned maintenance) | ≥ 99.5% |
| **Authentication Ceremony Success Rate** | Percentage of step-up ceremonies completed without timeout or error | ≥ 97% |
| **HRIMS Resolution Availability** | Percentage of organogram-dependent steps that resolve successfully | ≥ 99% (dependent on HRIMS SLA) |

### 10.5 Governance

| Criterion | Measure | Target |
|---|---|---|
| **RBAC Coverage** | Percentage of API routes protected by permission checks | 100% |
| **Delegation Audit Coverage** | Percentage of delegation-used approvals with delegation reference in audit trail | 100% |
| **Role Assignment Compliance** | Zero role assignments without an approver or justification record | 0 violations |

---

---

## 11. DEPENDENCIES

### 11.1 Internal System Dependencies

| Dependency | Nature | Risk if Unavailable |
|---|---|---|
| Supabase (Primary DB + Storage + Real-time) | **Critical** — all application data | Platform non-functional |
| `lib/approvalEngine.ts` | All workflow processing | No requests can be created or approved |
| `lib/approvalRisk.ts` | Risk-based auth enforcement | All approvals default to lowest auth tier or block |
| `lib/rbac.ts` | All access control decisions | Unauthorised access possible |
| `lib/stepUpToken.ts` + `lib/elevatedSession.ts` | Medium/High risk approval enforcement | Step-up auth cannot be verified; HIGH/MEDIUM approvals blocked or bypassed |

### 11.2 External Service Dependencies

| Service | Purpose | SLA Dependency | Fallback |
|---|---|---|---|
| **Microsoft Entra ID** | Primary login; MFA step-up; Graph Mail | If unavailable: no login, no MEDIUM-risk approvals | None (critical single point of failure for authentication) |
| **HRIMS Supabase Tenant** | Dynamic approver resolution | If unavailable: organogram-type steps fail | **None currently** — gap (see GAP-10) |
| **Resend** | Transactional email notifications | If unavailable: emails not sent; in-app notifications still work | Microsoft Graph Mail (partial fallback) |
| **Vercel (inferred hosting)** | Application serving | If unavailable: platform inaccessible | No hot standby confirmed |

### 11.3 User and Process Dependencies

| Dependency | Description |
|---|---|
| **User Enrolment in Microsoft Entra** | All users must have a Microsoft Entra account. New employees must be provisioned before they can access the system. |
| **WebAuthn Credential Enrolment** | Users who will approve HIGH-risk requests must register a biometric credential before they encounter such a request. |
| **HRIMS Data Currency** | Organisational chart data in HRIMS must be kept up to date. Stale data causes approver misrouting. |
| **Workflow Template Maintenance** | Workflow definitions must be created and maintained by a qualified system administrator before any request type can be used. |
| **Signature Pre-registration** | Users who prefer to use a saved signature must pre-register it in their profile. |

---

---

## 12. ASSUMPTIONS LOG

| ID | Assumption | Basis | Risk if Wrong |
|---|---|---|---|
| **A-01** | The organisation uses Microsoft Entra ID (Azure AD) as its identity provider for all employees. | Azure AD env vars present (`AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`); NextAuth Entra provider configured. | Low — this is a direct code observation. |
| **A-02** | The platform is deployed to a Vercel-compatible hosting environment (Node.js, serverless-friendly). | Next.js 14 stack is strongly associated with Vercel; no Docker/K8s config observed. | Medium — if self-hosted, some serverless assumptions may not apply. |
| **A-03** | Supabase row-level security (RLS) is either already implemented or is an imminent planned control. | RLS is the standard Supabase security model. Not observable from application code alone. | **HIGH** — if RLS is absent, the DB layer is unprotected. |
| **A-04** | The HRIMS system is a separately maintained Supabase tenant belonging to the same organisation. | Separate `HRIMS_SUPABASE_URL` and `HRIMS_SUPABASE_SERVICE_ROLE_KEY` environment variables; dedicated `hrimsClient.ts`. | Low — direct code observation. |
| **A-05** | The organisation operates in a single-tenant configuration at this development stage. | Single org model observed in DB schema; no multi-tenant onboarding UI detected. | Medium — if multi-tenancy is live, additional data isolation controls are needed. |
| **A-06** | All approver users access the system via WebAuthn-capable browsers on non-shared devices. | Platform requires WebAuthn for HIGH-risk approvals. | Medium — shared/kiosk devices or older browsers require fallback policy. |
| **A-07** | The legal jurisdiction governing this platform does not require Qualified Electronic Signatures (QES) for all document types processed by the system. | No QES provider integration observed. | **HIGH** — if QES is required by law or contract, canvas/typed signatures are legally insufficient. |
| **A-08** | Supabase automated backups are enabled and point-in-time recovery is configured at the infrastructure level. | No application-level backup logic observed; standard Supabase feature. | Medium — if not configured, data loss risk is elevated. |
| **A-09** | The `system_settings` table contains per-organisation configuration for elevation TTL; the default (15 minutes) is acceptable to the business. | `getElevationTtlMinutes()` reads from `system_settings` with a 15-minute default fallback. | Low — configurable per org; can be adjusted without code changes. |
| **A-10** | The `NEXTAUTH_SECRET` environment variable is managed as a secret (not committed to version control) and is rotated periodically. | Standard NextAuth requirement; not verifiable from code alone. | **HIGH** — if this secret is compromised, all session and step-up token security collapses. |
| **A-11** | Electronic signature data (canvas drawings, saved images) stored in Supabase Storage is not accessible to unauthenticated users. | Supabase Storage bucket policies are not visible from the application codebase. | HIGH — if buckets are public, signature data is exposed. |
| **A-12** | The travel authorisation cost allocation step (HR Director) is always present as the final step in the travel_authorization workflow template. | Code in `action.ts` includes special handling for HR Director cost allocation in the `travel_authorization` request type. | Low — direct code observation; confirmed by special handling logic. |

---

---

## 13. DOCUMENT NOTES

### 13.1 System Maturity Assessment

The Circle is a **technically sophisticated** system. The core approval engine, risk-based authentication framework, electronic signature infrastructure, and HRIMS integration represent enterprise-grade engineering. The audit trail depth (authentication method, risk level, device fingerprint, credential reference) exceeds the standard observed in many commercial workflow platforms.

The system is assessed as **approximately Phase 8 complete** out of a 10-phase development lifecycle. The primary outstanding work is in the compliance hardening layer (RLS, audit immutability, retention policies) and production readiness activities (penetration testing, UAT, go-live planning).

### 13.2 Priority Recommendations Before Production Deployment

The following actions are recommended as **blockers for production go-live**:

1. **[P0] Confirm and document Supabase RLS policies** — This is the single most significant data security control gap identified.
2. **[P0] Implement audit record immutability** — Prevent UPDATE/DELETE on the `approvals` table at the database level.
3. **[P0] Engage legal review on electronic signature sufficiency** — Determine whether canvas/typed signatures meet the legal standard for all document types in scope.
4. **[P1] Separate step-up token signing secret from NEXTAUTH_SECRET** — Reduce blast radius of a secret compromise.
5. **[P1] Define and implement data retention policy** — Ensure compliance with applicable data protection law.
6. **[P1] Mandate and track WebAuthn enrolment** for users in HIGH-risk approver roles.
7. **[P1] Confirm Supabase Storage bucket policies** restrict access to authenticated, authorised users only.
8. **[P2] Implement HRIMS organogram caching and manual fallback** — Prevent workflow blockage during HRIMS outages.
9. **[P2] Conduct penetration test** — Specifically targeting the step-up authentication bypass, delegation abuse, and API authorisation bypass vectors.
10. **[P2] Implement change control for admin configuration** — Workflow and form template changes should be subject to a documented review and approval process.

---

*End of Document*

---

**Document Classification**: INTERNAL — RESTRICTED
**Next Review Date**: 05 August 2026 *(Assumption: quarterly review cycle)*
**Document Owner**: *(To be assigned — IT Director / Project Owner)*
