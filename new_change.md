MVP Prompt Pack (UPDATED for your new navigation decision)
What changed vs previous pack
Mobile uses the same Sidebar pattern (no bottom nav).
Default on mobile: icon-only rail
Expand shows full labels + sections.
CAPEX Tracker link is NOT in the sidebar for now (to keep nav clean for MVP).
It will be accessible via Dashboard CTA and/or Desktop Header quick link.
Everything else is preserved: canonical routes, request type standardization, approvals pipeline, tracker requirements, detail page behavior, and the MVP checklist.

Canonical routes (MVP)
Dashboard: /dashboard
Requests list (My Requests): /requests (canonical)
Create request chooser: /requests/new
Request detail: /requests/[id]
Approvals (My Tasks): /approvals (canonical)
CAPEX tracker: /requests/capex (canonical tracker route)
Legacy routes to redirect (eliminate duplicates)
/requests/my-requests → /requests
/requests/approvals → /approvals
Navigation spec (single Sidebar used everywhere)
Sidebar behavior
Desktop: normal Sidebar (icons + labels)
Mobile:
collapsed state: icon-only rail (narrow)
expanded state: full sidebar with labels + section headers
toggle: hamburger / menu button in header
Sidebar items (MVP minimal)
Dashboard → /dashboard
Requests → /requests
Create → /requests/new
Approvals → /approvals
Settings → /system/settings (or the correct settings route you want)
CAPEX tracker placement (per your request)
Do not put “CAPEX Tracker” in Sidebar
Access instead via:
Dashboard card: “CAPEX Tracker” → /requests/capex
Optional desktop header shortcut (link/button) visible only on large screens
Prompt 0 — “Implement new nav approach: Sidebar is shared + mobile icon rail; bottom nav removed”
text
Update navigation so both desktop and mobile use the same Sidebar component.
 
Requirements:
- Remove/disable BottomNav usage for mobile. The app should not rely on BottomNav at all for MVP.
- On mobile, the Sidebar should render in a collapsed icon-only rail by default (narrow width).
- Provide an expand/collapse toggle:
  - collapsed: icons only
  - expanded: icons + labels + section titles
- Keep AppHeader menu button to open/close Sidebar overlay behavior, but adjust so the mobile experience feels like a rail that can expand.
- Ensure the nav items point to canonical routes:
  - /dashboard
  - /requests
  - /requests/new
  - /approvals
  - /system/settings (or chosen settings route)
- Do NOT add CAPEX tracker to Sidebar for now.
 
Deliverables:
- Updated AppLayout + Sidebar implementation to support mobile collapsed rail.
- Remove BottomNav rendering (or set hideNav true everywhere and delete its use).
- Ensure route targets are consistent and match canonical.
 
Constraints:
- Do not create any .md files.
Prompt 1 — “Unify routes + remove duplicates (canonical routes + redirects)”
text
You are working in a Next.js (pages router) app. Make routing consistent and eliminate duplicate experiences.
 
Requirements:
- Canonical routes:
  - /requests = My Requests list
  - /approvals = My Approvals list
- Add redirects so legacy routes still work:
  - /requests/my-requests -> /requests
  - /requests/approvals -> /approvals
- Update any internal links (dashboard CTA buttons, sidebar links) to point to canonical routes.
- Keep user experience identical, just remove confusion.
 
Deliverables:
- Redirect pages or Next.js redirect config
- Updated internal links
 
Constraints:
- Do not create any .md files.
Prompt 2 — “Standardize request type field (required for CAPEX tracker + reliable filtering)”
text
Standardize request type naming across UI + API.
 
Problem:
- Some pages send requestType, others send type; API reads metadata.request_type vs metadata.requestType.
 
Requirements:
- Single source of truth: metadata.requestType (camelCase).
- Allowed MVP values:
  - capex
  - travel_authorization
  - hotel_booking_internal
  - hotel_booking_external
- Update request creation in all existing form pages to send requestType consistently into metadata.requestType.
- Update read paths (APIs and pages) to use metadata.requestType.
- Backward compatibility: if existing rows contain metadata.request_type or metadata.requestType, normalize at read time.
 
Deliverables:
- Update pages/api/requests/index.ts and pages/api/requests/my-requests.ts
- Update CAPEX, travel, hotel booking pages to submit consistent fields
 
Constraints:
- Do not create any .md files.
Prompt 3 — “Fix the approvals pipeline: ensure request_steps exist for submitted requests”
text
Make approvals work end-to-end for CAPEX as the MVP core.
 
Current:
- /api/requests/[id]/publish creates request_steps from request.metadata.approvers and sets request.status='pending'.
- Some forms directly create requests as pending without calling publish, causing request_steps not to exist => approvals list empty.
 
Choose and implement Option A (recommended):
- Forms create requests as 'draft' first.
- On Submit, call POST /api/requests/[id]/publish:
  - validate metadata.approvers exists (or return clear error)
  - create request_steps sequentially
  - set request.status='pending'
 
Also fix lifecycle:
- When an approver approves a step:
  - update that request_step to approved
  - move the next step to pending (if next step exists)
  - when final step approved -> set request.status='approved'
- On rejection:
  - mark current step rejected
  - set request.status='rejected'
- Ensure approvals audit trail is recorded in approvals table.
 
Deliverables:
- CAPEX form must support:
  - Save Draft
  - Submit (draft -> publish -> pending)
- Approvals list should show pending tasks for user
- Request detail should allow approve/reject and advance workflow
 
Constraints:
- Do not create any .md files.
Prompt 4 — “CAPEX Tracker (manager + finance view) — accessible via Dashboard/Header, not Sidebar”
text
Implement a CAPEX tracker page (manager/finance tracking + reporting) as a view over CAPEX requests.
 
Route:
- /requests/capex
 
Navigation access rules:
- Do NOT add this link to the Sidebar for MVP.
- Add a prominent Dashboard card and/or a desktop header quick link that navigates to /requests/capex.
 
Purpose:
- Digitalize CAPEX request tracking: creation + approvals + tracking.
- Must cover: see all CAPEX requests, pending approvals, and tracking totals.
 
UI requirements:
- Summary metrics (at least):
  - Total CAPEX requests (filtered by date range)
  - Total amount pending
  - Total amount approved
  - Total amount rejected
  - Average age of pending (days)
- Table columns (minimum):
  - CAPEX title / project name
  - Business unit
  - Department
  - Amount + currency
  - Status
  - Current step index + current approver (if available)
  - Created date + Age
- Filters:
  - status
  - date range
  - business unit
  - department
  - free-text search (title/project/requester)
- Actions:
  - click row -> /requests/[id]
  - export CSV (client-side is fine)
 
Data requirements:
- Filter by metadata.requestType='capex'
- Amount + currency come from metadata (capex form)
- Ensure API supports this efficiently (server-side filtering preferred)
 
Constraints:
- Do not create any .md files.
Prompt 5 — “Single request detail page that supports approvals cleanly (/requests/[id])”
text
Make /requests/[id] a single, clear request detail page that supports both requester and approver roles.
 
Requirements:
- Show a top summary:
  - title, status, requestType, created_at, requester
- Render CAPEX fields from metadata in a clean, grouped layout
- Show workflow timeline from request_steps:
  - each step, status, approver, timestamp (if available)
- If current user is the pending approver for current step:
  - show Approve/Reject actions
  - require a comment on rejection
- After approve/reject:
  - update database (request_steps + requests + approvals audit)
  - refresh UI
  - show a success message
 
Constraints:
- Do not create any .md files.
Prompt 6 — “Polish for presentation (MVP UX pass)”
text
Do an MVP polish pass to make the demo presentable and consistent.
 
Requirements:
- All request forms (CAPEX / Travel / Hotel) must have:
  - consistent page title/header
  - consistent back behavior
  - consistent sticky action bar (Save Draft / Submit where applicable)
  - consistent success destination:
    - either /requests (My Requests) or /requests/[id] (preferred)
- Terminology consistency:
  - Requests = my submissions
  - Approvals = my tasks
  - CAPEX Tracker = manager/finance tracking
- Remove or deprioritize unfinished sections (Inbox) so they don’t distract during demo.
- Ensure there is no duplicate approvals experience (only /approvals).
 
Constraints:
- Do not create any .md files.
MVP demo checklist (acceptance criteria)
CAPEX creation
Draft
can save and appears in /requests with status Draft
Submit
validates approvers
creates request_steps
request becomes Pending
appears in /approvals for assigned approver(s)
Approval flow
Approver sees CAPEX in /approvals
Approver can approve/reject from /requests/[id]
Step advancement works
Final approval sets request status = Approved
Rejection sets request status = Rejected
Audit trail exists (approvals table)
CAPEX tracking (manager/finance)
/requests/capex shows CAPEX only
Filters work
Totals match filtered set
Row click opens /requests/[id]
Access via Dashboard (and optionally desktop header quick link), not via Sidebar
Navigation (your new model)
Only one nav system: Sidebar everywhere
Mobile: icon rail collapsed + expand
Desktop: normal sidebar
No conflicting routes (redirects handle old links)
One final decision for the tracker totals (so it doesn’t break in demo)
For CAPEX totals, use Option A:

Amount is Number(metadata.amount) from the CAPEX form
Currency is metadata.currency
If amount is stored as a formatted string right now, normalize it in the tracker API by stripping commas and parsing safely.

