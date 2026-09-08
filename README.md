# CliniSend PH — SMS Appointment Reminder Platform

**System Name:** Clinic SMS Reminder & Two-Way Confirmation Platform
**Short Name:** CliniSend PH
**Project Folder:** `clinisend/`
**Primary Deployment Platform:** Vercel (frontend) + Railway or Render (backend) + Supabase (DB/Auth)
**Status:** Planning and Architecture Preparation
**Coding Status:** Not started — first code phase is Phase 8; Phases 0–7 are document-only
**Plan of record:** Section 22 (26 phases, 0–25, each gated)

**Who may implement:** Solo developer using AI-assisted development (Claude Code), following the phase gates below.

---

## 1. Purpose of This Document

This is the planning and SDLC guide for CliniSend PH, written before any code is generated. It defines the business problem, MVP, roles, workflow, data model, agent responsibilities, phases, and approval gates so that vibe-coding sessions have a fixed scope to build against instead of drifting.

> **Rule:** No application code is generated before Phase 8. Phases 0–7 in Section 22 are document-only (Phase 7 produces mockups). Sections 6 (Scope), 8 (Roles), 10 (Workflow), and 19 (Data Model) must be approved before Phase 8 begins, and each phase's own gate must pass before the next starts.

Section 22 is the plan of record for sequencing. Section 2 below describes the general SDLC order; where the two differ in detail, Section 22 wins.

---

## 2. SDLC Framework Order

1. Understand the business problem
2. Approve the MVP scope
3. Define roles and permissions
4. Define the workflow and statuses
5. Define the data model
6. Assign AI development agents and subagents
7. Create development phases
8. Prepare security, testing, deployment plans
9. Begin implementation, phase by phase
10. Test and validate each phase before moving to the next
11. Deploy to staging
12. Pilot with one real clinic
13. Deploy to production
14. Monitor, support, iterate

---

## 3. Business Story

Philippine clinics (small private clinics, dental clinics, diagnostic centers) currently manage appointment reminders manually: a receptionist calls or texts each patient individually, or does not remind them at all. This causes:

- High no-show rates, wasting doctor time slots
- Receptionists spending hours per day on manual calls/texts
- No record of whether a reminder was even sent
- No way for a patient to easily confirm, cancel, or reschedule outside clinic hours
- No visibility for the clinic owner into no-show trends or staff performance
- Difficulty scaling to multiple branches without hiring more front-desk staff

CliniSend PH replaces this manual process with a shared platform: any clinic can sign up, add their patients and appointments, and the system automatically sends SMS reminders and accepts SMS replies to update appointment status, with SMS chosen specifically because smartphone/data access is inconsistent among older or rural Filipino patients, while basic SMS reach is near-universal across Globe, Smart, and DITO.

---

## 4. Project Vision

CliniSend PH provides one platform where:

- Any clinic in the Philippines can register and start sending reminders within a day
- Each clinic's data is fully isolated from every other clinic (multi-tenant)
- Receptionists manage patients and appointments without technical knowledge
- Doctors see their clinic's schedule without managing it
- Patients receive reminders and can reply CONFIRM, CANCEL, or RESCHEDULE by text, with no app or login required for the reply itself
- Patients who want more can also check their appointment status through a lightweight web portal via OTP
- The platform owner (you) approves new clinics and monitors platform health across all tenants

---

## 5. Project Objectives

CliniSend PH must:

1. Allow clinics to self-register, pending platform-owner approval.
2. Isolate each clinic's patients, appointments, and messages from all other clinics.
3. Provide role-based dashboards for Super Admin, Clinic Admin, Doctor, and Receptionist.
4. Send automated SMS reminders ahead of scheduled appointments via Semaphore.
5. Accept and parse inbound SMS replies (CONFIRM/CANCEL/RESCHEDULE/HELP) and update appointment status accordingly.
6. Provide a lightweight OTP-based patient portal to view/confirm appointments.
7. Track delivery status and cost per message.
8. Provide basic security best practices appropriate for handling patient contact and appointment data.
9. Deploy on Vercel + Railway/Render with Supabase as the managed database and auth layer.
10. Remain free for v1 (no billing), with the data model ready to add subscriptions later.

---

## 6. Scope

### 6.1 In Scope for MVP

- Clinic self-registration with Super Admin approval step
- Staff login (email + password) for Clinic Admin, Doctor, Receptionist
- Patient login (SMS OTP, no password) for the patient portal
- Clinic Admin: manage clinic profile, invite/manage staff (Doctor, Receptionist), manage message templates, view clinic-wide reports
- Receptionist: manage patients, create/edit/cancel appointments, send manual SMS, view delivery log
- Doctor: view all appointments/patients in their clinic (read-only on patient records, can mark appointment as completed/no-show)
- Patient portal: view own upcoming appointment, confirm/cancel via web as an alternative to SMS reply
- Automated reminder scheduler (cron): sends reminder N hours before appointment (default 24h, configurable per clinic)
- Manual/ad-hoc SMS sending to one patient or a filtered list
- Inbound SMS handling: parse CONFIRM / CANCEL / RESCHEDULE / HELP keywords, update appointment status, log unrecognized replies for manual review
- Message templates with placeholders (`{patient_name}`, `{date}`, `{time}`, `{doctor_name}`, `{clinic_name}`)
- Delivery log per message: sent, delivered, failed, cost
- Super Admin dashboard: list clinics, approve/reject/suspend clinics, view platform-wide usage
- Basic audit log: who created/edited/cancelled what, and when
- Row-level tenant isolation enforced at the database layer, not just in application code
- Staging deployment

### 6.2 Out of Scope for MVP (add later if validated)

- Subscription billing and payment collection (PayMongo/Xendit integration)
- Multiple SMS provider fallback (Semaphore-only for v1)
- Native mobile app
- Full electronic medical records (this is appointment/reminder data only, not clinical records)
- Multi-branch support within a single clinic account
- Calendar sync (Google Calendar, Outlook)
- Email notifications as a fallback channel
- Advanced analytics (no-show prediction, patient segmentation)
- White-labeling per clinic (custom domain, custom sender name per clinic)
- Formal Data Privacy Act (RA 10173) compliance documentation (basic best practices only for v1)

---

## 7. Authentication Rules

### 7.1 Staff (Super Admin, Clinic Admin, Doctor, Receptionist)

- Email + password login only.
- Clinic Admin, Doctor, and Receptionist accounts are created by the Clinic Admin (Doctor/Receptionist) or by Super Admin during clinic setup (Clinic Admin).
- Super Admin account(s) are seeded manually, not self-registered.
- Passwords hashed (Supabase Auth handles this).
- Password reset flow required.
- Deactivated staff cannot log in; their historical actions remain visible in audit logs.

### 7.2 Patients

- No password. Patient enters mobile number, receives a 6-digit OTP via SMS, enters it to view their portal.
- OTP expires after 5 minutes, single use, rate-limited to prevent SMS-bombing abuse (max 3 requests per number per 10 minutes).
- A patient record is looked up by phone number; if no appointment exists for that number, the portal shows "no upcoming appointments" rather than creating an account.

---

## 8. User Roles and Permissions

### 8.1 Super Admin (Platform Owner — you)

Can:
- Approve, reject, or suspend clinic registrations
- View all clinics and platform-wide usage/cost
- Deactivate any clinic or staff account
- View platform-wide audit logs

Cannot:
- Directly edit a clinic's patients or appointments (stays out of clinic-level data by default)

### 8.2 Clinic Admin (Clinic Owner/Manager)

Can:
- Manage clinic profile (name, address, sender info, reminder timing default)
- Invite and manage Doctor and Receptionist accounts within their clinic
- Manage message templates
- View all patients, appointments, and messages within their clinic
- View clinic-level reports (no-show rate, delivery success rate, SMS cost)

Cannot:
- View or access other clinics' data
- Access Super Admin functions

### 8.3 Doctor

Can:
- View all appointments and patients within their clinic
- Mark an appointment as Completed or No-show

Cannot:
- Create/edit/delete patients or appointments
- Manage staff or templates
- Send manual SMS

### 8.4 Receptionist

Can:
- Create, edit, cancel, and reschedule patients and appointments
- Send manual SMS to one patient or a filtered group
- View the delivery log and inbound reply log
- Mark unrecognized inbound replies as resolved

Cannot:
- Manage staff accounts or clinic settings
- Access other clinics' data

### 8.5 Patient (Portal, OTP-based)

Can:
- View own upcoming appointment(s)
- Confirm, cancel, or request reschedule via the portal (mirrors the SMS reply keywords)

Cannot:
- View other patients' data
- View clinic-internal data (templates, staff, reports)

---

## 9. Development Seed Users

For local/staging testing, seed one account per role:

| Role | Email | Password | Notes |
|---|---|---|---|
| Super Admin | admin@clinisend.dev | seeded | platform owner |
| Clinic Admin | admin@democlinic.dev | seeded | belongs to "Demo Clinic" |
| Doctor | doctor@democlinic.dev | seeded | belongs to "Demo Clinic" |
| Receptionist | frontdesk@democlinic.dev | seeded | belongs to "Demo Clinic" |
| Patient | N/A (OTP only) | N/A | seeded with a test phone number and one upcoming appointment |

---

## 10. Main Workflow

1. Clinic signs up (clinic name, contact info, admin email/password) → status `PENDING_APPROVAL`.
2. Super Admin reviews and approves → status `ACTIVE`; Clinic Admin can now log in.
3. Clinic Admin sets up clinic profile, default reminder timing, message templates, and invites Doctor/Receptionist accounts.
4. Receptionist adds patients and creates appointments.
5. Scheduler (cron) checks upcoming appointments continuously and sends a reminder SMS at the configured lead time (default 24h before).
6. Patient replies CONFIRM, CANCEL, or RESCHEDULE (or does nothing).
7. Inbound webhook parses the reply, updates appointment status, logs the raw message.
8. Unrecognized replies are flagged for Receptionist review, not auto-processed.
9. Doctor marks the appointment Completed or No-show after the visit.
10. Clinic Admin reviews reports (no-show rate, delivery rate, cost) periodically.

---

## 11. Appointment Statuses

`Scheduled` → `Reminder Sent` → `Confirmed` / `Cancelled` / `Reschedule Requested` → `Completed` / `No-show`

- `Reschedule Requested` requires Receptionist action to actually move the appointment (the system does not auto-reschedule).
- `No-show` can only be set by Doctor or Receptionist, never automatically.

---

## 12. Multi-Tenancy and Data Isolation Rules

- Every tenant-scoped table has a `clinic_id` column.
- Supabase Row-Level Security (RLS) policies enforce that a user can only read/write rows where `clinic_id` matches their own clinic — enforced at the database level, not just in application code, so a backend bug cannot leak data across clinics.
- Super Admin has a separate policy path that allows read access across all clinics for approval/monitoring, but not write access to clinic operational data.
- Phone number lookups for the OTP flow must be scoped correctly so a patient does not see another clinic's appointment if they happen to share a phone number across two clinics (edge case — flag in testing).

---

## 13. Two-Way SMS Rules

- Recognized keywords (case-insensitive, tolerant of common variants): `CONFIRM` / `YES` / `OO`, `CANCEL` / `HINDI`, `RESCHEDULE`.
- Reply is matched to the patient's most recent `Reminder Sent` appointment by phone number.
- If a phone number has more than one pending appointment, the reply is not auto-applied — it is flagged for Receptionist review to avoid updating the wrong appointment.
- Every inbound message is logged in full regardless of whether it was understood.
- `HELP` returns an auto-reply with the clinic's contact number.

---

## 14. MVP Definition

The MVP is done when:

- A clinic can sign up, get approved, and log in.
- Receptionist can add a patient and create an appointment.
- The scheduler sends a reminder SMS at the correct lead time.
- A patient reply of CONFIRM/CANCEL correctly updates the appointment status.
- Doctor can view the clinic's appointments and mark one Completed/No-show.
- Clinic Admin can see a delivery log and a basic report (sent/delivered/failed counts, no-show count).
- Data from one clinic is never visible to another clinic (verified by explicit test, not assumption).
- Deployed and reachable on a staging URL.

---

## 15. Core User Stories (sample, expand per phase)

**Clinic Admin**
> As a Clinic Admin, I want to invite a Receptionist account, so that front-desk staff can manage appointments without me creating every record myself.
> Acceptance: invite sends an email/temp credential; new user is scoped to my clinic only; I can deactivate them later.

**Receptionist**
> As a Receptionist, I want to create an appointment for a patient, so that a reminder is automatically scheduled.
> Acceptance: appointment requires patient, date, time, doctor; reminder job picks it up without manual triggering.

**Doctor**
> As a Doctor, I want to see today's appointments for my clinic, so that I know who's coming in.
> Acceptance: list is clinic-scoped, sorted by time, shows current status.

**Patient**
> As a Patient, I want to reply CANCEL to a reminder text, so that I don't have to call the clinic.
> Acceptance: appointment status updates to Cancelled; Receptionist sees it in their dashboard within the delivery/reply log.

**Super Admin**
> As the Super Admin, I want to approve a new clinic signup, so that only legitimate clinics can use the platform.
> Acceptance: clinic cannot log in until approved; approval/rejection is logged.

---

## 16. Non-Functional Requirements

- Reminder scheduler must run reliably even if the backend restarts (durable cron, not in-memory timers).
- SMS delivery status should be reflected within a few minutes of Semaphore's callback, not require manual refresh forever.
- System should handle at least a few hundred patients and appointments per clinic without redesign (Postgres easily covers this; no premature scaling work needed).
- OTP requests are rate-limited per phone number to prevent cost abuse.
- All traffic over HTTPS.
- Passwords and API keys never stored in source code or client-side bundles.

---

## 17. Proposed Technology Stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite) |
| Backend | Node.js + Express |
| Database / Auth | Supabase (Postgres + Row-Level Security + Supabase Auth for staff) |
| SMS (outbound + inbound) | Semaphore API (PH-focused, supports sending; inbound requires a receiving number/webhook setup — verified in Phase 4 before any inbound design is finalized, as this is the highest-risk integration point) |
| Scheduler | node-cron (simple) or Supabase Edge Functions + `pg_cron` (more durable) — recommend `pg_cron` for reliability |
| Patient OTP delivery | Same Semaphore account, separate template |
| Hosting | Vercel (frontend), Railway or Render (backend) |

---

## 18. Architecture Direction

- Single shared Postgres database (via Supabase), multi-tenant by `clinic_id` + RLS — not separate databases per clinic, to keep this buildable solo.
- Backend exposes a REST API; frontend is a single React app with role-based routing (Super Admin, Clinic Admin, Doctor, Receptionist views, plus a separate lightweight Patient Portal route that only needs OTP, not the staff auth system).
- Inbound SMS webhook is a public endpoint that verifies the request is genuinely from Semaphore before processing (shared secret or signature check) to prevent spoofed status updates.
- Scheduler runs independently of user requests (cron), writes directly to the `messages` table and calls the Semaphore send API.

---

## 19. High-Level Data Model

```
platform_admins: id, email, created_at

clinics: id, name, contact_email, contact_phone, status (pending_approval/active/suspended),
         default_reminder_hours_before, sender_name, created_at

clinic_users: id, clinic_id, role (admin/doctor/receptionist), name, email, created_at, is_active

patients: id, clinic_id, name, mobile_number, notes, created_at

appointments: id, clinic_id, patient_id, doctor_user_id, appointment_date, appointment_time,
              status, created_by, created_at, updated_at

templates: id, clinic_id, name, body, created_at

messages: id, clinic_id, appointment_id (nullable), patient_id, direction (outbound/inbound),
          body, status (sent/delivered/failed/received), semaphore_message_id, cost, created_at

audit_logs: id, clinic_id (nullable for platform-level), actor_user_id, action, target_table,
            target_id, created_at
```

---

## 20. API Domain Areas

- `auth` — staff login, patient OTP request/verify
- `clinics` — signup, approval, profile management (Super Admin + Clinic Admin scoped)
- `clinic_users` — invite/manage staff
- `patients` — CRUD, scoped to clinic
- `appointments` — CRUD, status transitions
- `templates` — CRUD
- `messages` — outbound send, inbound webhook receiver, delivery log
- `reports` — clinic-level and platform-level summaries
- `audit` — read-only log viewer

---

## 21. AI Development Agents and Subagents

Since this is solo + AI-assisted, "agents" here means distinct prompt roles/hats to switch between in Claude Code, not separate human teams. Each has a clear job so a single session doesn't blur planning, building, and reviewing together.

### 21.1 Product Manager Agent
Maintains scope (Section 6), writes user stories, blocks scope creep, decides what's actually in the current phase.

### 21.2 Architect Agent
Owns Sections 18–20 (architecture, data model, API domains). Reviews any schema change against tenant-isolation rules before it's implemented.

### 21.3 Database Agent
Writes and reviews Supabase migrations, RLS policies, and indexes. Specifically responsible for verifying tenant isolation with actual test queries, not assumptions.

### 21.4 Frontend Agent
Builds the React app: role-based routing, dashboard views, the patient portal, form validation.

### 21.5 Backend Agent
Builds Express routes, business logic, appointment status transitions, template rendering.

### 21.6 SMS Integration Subagent
Owns everything Semaphore-specific: outbound send calls, delivery status polling/webhooks, inbound message parsing, keyword matching, retry/failure handling. This is split out from the general Backend Agent because it's the riskiest and most PH-specific integration point. Runs the Phase 4 capability spike, then builds Phases 14–16.

### 21.7 Scheduler Subagent
Owns the reminder cron logic: querying which appointments need a reminder now, avoiding duplicate sends, handling timezone correctly (Philippine Standard Time, UTC+8, must be explicit — don't rely on server default timezone).

### 21.8 Security Agent
Reviews RLS policies, OTP rate-limiting, secrets handling, webhook signature verification.

### 21.9 QA Agent
Writes test cases per role and per status transition, especially tenant-isolation tests and inbound-SMS-ambiguity tests (two pending appointments, same phone number).

### 21.10 DevOps Agent
Handles Vercel/Railway/Render config, environment variables, Supabase project setup, staging vs production separation.

---

## 22. Development Phases

This section is the authoritative sequencing plan. 26 phases, 0 through 25, each with one approved deliverable and a gate. Nothing in a phase starts until the previous phase's gate is signed off by you.

The **Code?** column is binding. A phase marked **No** produces documents only — writing implementation code during it is out of process, even if the code would be correct. Phases 0–7 are entirely planning: eight consecutive document phases before the first line of application code in Phase 8. That is intentional, because tenant isolation, the SMS message budget, and Semaphore's actual inbound capability are all cheaper to get wrong on paper than in a migration.

### 22.1 Phase Table

| # | Phase | Code? | Primary deliverable | Gate to pass |
|---|---|---|---|---|
| 0 | Project Initialization | No | Repo/docs structure, decision log, risk register, backlog, agent roster | Docs skeleton exists; decision log has its first entry; §21 roster and §31 risks moved to living files |
| 1 | Business Analysis & Clinic Brief | No | As-is manual reminder process, to-be workflow, stakeholder map | Real observed clinic behavior and a baseline no-show number replace assumptions in §3 |
| 2 | MVP, Roles & User Stories | No | Locked MVP list, permission matrix, appointment status model, DoR/DoD, success metrics | Permission matrix and status-transition table approved — they become the Phase 20 test matrix |
| 3 | SMS Message Catalog & Keyword Spec | No | Every outbound message, 160-char budget, frozen placeholder set, EN/TL variants, inbound keyword vocabulary, HELP reply, opt-out | Worst-case character count proven for each message |
| 4 | Semaphore Capability Verification | No (spike) | Verified answers on inbound/webhook support, sender registration, per-SMS cost, rate limits, staging sender | Inbound confirmed with citations, or the portal-only fallback adopted in writing |
| 5 | Architecture & Data Design | No | ERD, RLS policy design, API contract, tenancy model, PHT strategy, ADRs | Every tenant-scoped table has `clinic_id` and a written policy per role |
| 6 | Security & Privacy Plan | No | Threat model, OTP abuse controls, webhook auth, PII handling, retention | Each threat maps to a named Phase 19 test |
| 7 | UX & Prototype | Mockups | Wireframes for 4 staff dashboards + mobile-first patient portal, design standards | Every MVP story has a screen; no screen implies out-of-scope work |
| 8 | Foundation Implementation | Yes | Repo scaffold, Supabase project, migration pipeline, health endpoint, CI, env config, test framework | CI green, health endpoint reachable, migrations run forward and back |
| 9 | Tenancy & RLS | Yes | Schema, `clinic_id`, RLS policies, isolation test harness | Harness passes — and fails when a policy is deliberately dropped |
| 10 | Staff Authentication & Roles | Yes | Staff login, role + `clinic_id` session claim, route guards, password reset | Role and clinic come from the database, never the client |
| 11 | Clinic Registration & Approval Lifecycle | Yes | Signup → `PENDING_APPROVAL`, Super Admin approve/reject/suspend | Unapproved clinic cannot log in; every decision is audited |
| 12 | Clinic Profile & Staff Provisioning | Yes | Clinic profile, default lead time, sender name, staff invite/deactivate | New staff are scoped to the inviting clinic only |
| 13 | Patients & Appointments | Yes | Receptionist CRUD, Doctor read-only, per-role dashboards | Doctor cannot write patient/appointment records; only Completed/No-show |
| 14 | Templates & Manual Outbound SMS | Yes | Template CRUD, placeholder rendering, Semaphore send, delivery log | Rendered length shown before send; cost and status recorded per message |
| 15 | Reminder Scheduler | Yes | `pg_cron` job, PHT correctness, duplicate-send prevention | Reminder fires at correct PH local time and exactly once across restarts and retries |
| 16 | Inbound SMS & Two-Way Replies | Yes | Webhook, signature verification, keyword parse, ambiguity queue | Unverified requests rejected; ambiguous replies change nothing |
| 17 | Patient Portal | Yes | OTP request/verify, view/confirm/cancel | OTP limits enforced server-side; same number across clinics handled correctly |
| 18 | Reporting & Audit Log Views | Yes | Clinic reports, Super Admin platform view | Super Admin totals never expose clinic operational records |
| 19 | Security Hardening & Isolation Suite | Fixes | Phase 6 mitigations implemented as an executable suite | Suite passes; no new features added in this phase |
| 20 | Quality Assurance | Test only | Full matrix per role and per status transition | Every cell run and recorded, including illegal transitions |
| 21 | Staging Deployment & Seed Data | Deploy | Vercel + Railway/Render staging, seeded tenants | §14 MVP checklist passes end to end on staging |
| 22 | Clinic Pilot / UAT | Fixes only | One real clinic, monitored | One full week, no critical bug, before/after numbers vs the Phase 1 baseline |
| 23 | Production Readiness | Checklist | §27 checklist, verified backup restore, user + admin manuals, incident runbook | Restore actually performed, not assumed |
| 24 | Production Deployment | Deploy | Production Supabase + production sender, public signup open | Monitoring live before signup opens |
| 25 | Hypercare & Continuous Improvement | Yes | Watch window, then backlog work | Each improvement re-enters at Phase 2 scope discipline |

### 22.2 Phase Notes

**Phase 0 — Project Initialization.** Stand up `docs/` with the decision log (one file per decision, numbered, including the ones already made in §17 and §18), the risk register promoted out of §31 into a living file with owners, the backlog that absorbs §6.2, and the agent roster from §21. Nothing here is throwaway paperwork: the decision log is what stops a later session quietly re-litigating the stack.

**Phase 1 — Business Analysis & Clinic Brief.** §3 is currently written from reasonable assumption. This phase replaces it with observation from at least one real clinic: how reminders happen today, who does them, how long it takes, what the actual no-show rate is. Without a real baseline number, the success metric in §32 ("no-show rate reduction") cannot be measured later.

**Phase 2 — MVP, Roles & User Stories.** Expands §8 into a full permission matrix (role × resource × action, with an explicit deny for every cell that is not allowed) and §11 into a transition table naming who may trigger each transition. Both artifacts are consumed directly by Phase 20, so ambiguity here becomes untested behavior there.

**Phase 3 — SMS Message Catalog & Keyword Spec.** Enumerate every outbound message: reminder, OTP, HELP auto-reply, confirm/cancel/reschedule acknowledgements, and manual sends. Each is budgeted against 160 characters using worst-case placeholder values (longest realistic patient name, longest clinic name), not typical ones. Placeholder set is frozen here. English and Tagalog variants are specified together so a Tagalog variant is never a longer afterthought that silently splits into two billable messages. Inbound side: the accepted keyword vocabulary with variants and common misspellings, and opt-out handling — what STOP suppresses and what it must still allow.

**Phase 4 — Semaphore Capability Verification.** A spike, not a build. Produce cited answers to: does the account support inbound SMS, what does the webhook payload look like, how is it authenticated, how is a sender name registered and how long does it take, what is the real per-SMS cost and credit model, what are the rate limits, and is there a staging sender or test mode. This is the highest-risk unknown in the project. Phase 5 must not be finalized before it closes, and Phase 16 is blocked on it outright. If inbound is unavailable, the Phase 17 portal becomes the only two-way channel and Phase 16 is rescoped rather than dropped silently.

**Phase 5 — Architecture & Data Design.** ERD, per-table per-role RLS policy design, REST API contract, tenancy model, and the PHT strategy stated explicitly (store UTC `timestamptz`, compute in `Asia/Manila`, schedule in PH time — never the host default). Records the rule that `clinic_id` is derived only from the authenticated session claim or a stored row, never from a request path, header, body, or webhook payload. Decisions land as ADRs in the Phase 0 decision log.

**Phase 6 — Security & Privacy Plan.** Threat model per trust boundary (public webhook, patient OTP, staff session, Super Admin path), OTP abuse controls, webhook authenticity, a PII inventory of what is actually stored, and retention/deletion behavior. Every identified threat gets a mitigation with a matching test name reserved in Phase 19.

**Phase 7 — UX & Prototype.** Mockups only, no application code. Wireframes for the Super Admin, Clinic Admin, Doctor, and Receptionist dashboards plus the mobile-first patient portal, and a design standards doc covering states (loading, empty, error), form validation presentation, and accessibility basics (contrast, focus visibility, labelled inputs, touch target size). Patient portal is designed mobile-first because the patients least likely to have a smartphone are the ones this platform exists for.

**Phase 8 — Foundation Implementation.** First code phase. Repo scaffold for frontend and backend, staging Supabase project, migration pipeline, `/health` endpoint, CI, environment configuration with no secrets in the repo, and the test framework itself. Ends with a real but near-empty test suite running green in CI, so every later phase has somewhere to put tests.

**Phase 9 — Tenancy & RLS.** The schema from Phase 5, `clinic_id` on every tenant-scoped table, RLS enabled, and an isolation harness that authenticates as each role in clinic A and asserts zero reads and denied writes against clinic B. The gate includes a negative control: deliberately drop one policy and confirm the harness catches it. A test that cannot detect a leak is not evidence of isolation.

**Phase 10–12 — Access and tenant lifecycle.** Staff auth with the role and clinic carried as a server-verified session claim; clinic signup, approval, rejection, and suspension with audit entries; then clinic profile, default reminder lead time, sender name, and staff provisioning scoped to the inviting clinic.

**Phase 13 — Patients & Appointments.** Receptionist CRUD, Doctor read-only with Completed/No-show only, and the per-role dashboards from the Phase 7 wireframes.

**Phase 14–15 — Outbound.** Templates drawn from the Phase 3 catalog with rendered-length feedback before sending, Semaphore send, delivery log with status and cost. Then the `pg_cron` scheduler: correct PH local time, and duplicate-send prevention that holds under retries, restarts, and overlapping runs. A patient receiving the same reminder twice reads as a broken system, so idempotency is a requirement here, not a refinement.

**Phase 16 — Inbound SMS & Two-Way Replies.** Public webhook that verifies authenticity before doing anything with the payload, keyword parsing against the Phase 3 vocabulary, auto-apply only when the sender number resolves to exactly one appointment in `Reminder Sent`, and a review queue for everything else. Zero candidates or multiple candidates change nothing.

**Phase 17 — Patient Portal.** OTP request and verify (6-digit, 5-minute expiry, single use, 3 requests per 10 minutes per number, enforced server-side), then view, confirm, and cancel. Handles a phone number that exists at two clinics without cross-clinic leakage.

**Phase 18 — Reporting & Audit Log Views.** Clinic-level delivery rate, no-show rate, reply-resolution rate, and SMS cost; Super Admin platform-wide usage that aggregates without exposing clinic operational records; audit log viewers scoped by role.

**Phase 19–20 — Stabilization.** Phase 19 is fixes only: implement the Phase 6 mitigations as a runnable suite alongside the Phase 9 isolation harness. Phase 20 is tests only, no fixes and no features: run the full matrix from Phase 2 — every role against every resource and action, every status transition including the illegal ones, inbound ambiguity, OTP abuse, timezone correctness, and webhook spoofing. Splitting them keeps "we fixed it" separate from "we verified it."

**Phase 21 — Staging Deployment & Seed Data.** Staging frontend and backend deployed, §9 seed users loaded, §14 MVP checklist run end to end against a staging sender so no real patient is texted during testing.

**Phase 22 — Clinic Pilot / UAT.** One real clinic, closely monitored, fixes only. Runs at least a full week and compares no-show numbers against the Phase 1 baseline. Real-world failure modes to expect: message formatting, delivery failures, and timezone edge cases.

**Phase 23 — Production Readiness.** The §27 checklist, a backup restore actually performed and verified end to end, a user manual for clinic staff, an admin manual for the Super Admin, and an incident runbook covering SMS provider outage, webhook downtime, a missed scheduler window, and suspected cross-tenant exposure.

**Phase 24 — Production Deployment.** Separate production Supabase project and production Semaphore sender, public self-serve signup opened, monitoring in place before the door opens.

**Phase 25 — Hypercare & Continuous Improvement.** A defined watch window with response expectations, then the Phase 0 backlog worked one validated item at a time. Anything from §6.2 re-enters through Phase 2 scope discipline rather than being appended to a working system.

### 22.3 Mapping From the Earlier Numbering

Earlier drafts and the steering file describe an 8–10 phase plan. It maps into this one as follows, so older references still resolve:

| Old phase | Now |
|---|---|
| Approval / planning | Phases 0–7 |
| Foundation | Phases 8–12 |
| Patients & Appointments | Phase 13 |
| Outbound SMS | Phases 14–15 |
| Inbound SMS | Phase 16 (gated by Phase 4) |
| Patient Portal | Phase 17 |
| Reporting | Phase 18 |
| Hardening | Phases 19–20 |
| Staging Deploy | Phase 21 |
| Pilot | Phase 22 |
| Production Launch | Phases 23–25 |

The substantive change is not just finer granularity. The old plan folded planning into a single approval step and had no dedicated phase for the SMS message catalog, the Semaphore capability spike, the threat model, UX, QA-as-its-own-phase, or production readiness. Those are now gates in their own right.

---

## 23. Security Plan (Basic Best Practices)

- All tenant-scoped tables protected by RLS, not just application-layer checks.
- Passwords via Supabase Auth (hashed, never handled directly).
- OTP: 6-digit, 5-minute expiry, single use, rate-limited per phone number.
- Semaphore webhook endpoint verifies a shared secret/signature before trusting inbound data.
- Environment variables (Semaphore API key, Supabase service key) never committed to source control.
- HTTPS enforced everywhere (default on Vercel/Railway/Render).
- Audit log for create/edit/cancel/status-change actions, including actor and timestamp.

---

## 24. Testing Plan

- Unit tests: template rendering, keyword parsing, status transition rules.
- Integration tests: full reminder send flow, full inbound reply flow.
- Tenant isolation tests: attempt cross-clinic reads/writes as each role, confirm all are rejected by RLS.
- Ambiguity test: two pending appointments same phone number, confirm reply is flagged not auto-applied.
- OTP abuse test: confirm rate limiting actually blocks the 4th request within the window.
- Timezone test: confirm reminders fire at the correct PH local time regardless of server timezone.

---

## 25. Deployment Plan

- Frontend → Vercel, connected to the `clinisend` repo, auto-deploy on push to `main`.
- Backend → Railway or Render, environment variables set there (never in repo).
- Database/Auth → Supabase project, separate staging and production projects.
- Semaphore → separate sender/template setup for staging vs production if the plan allows, to avoid accidentally texting real patients during testing.

---

## 26. Backup and Recovery Plan

- Rely on Supabase's automated daily backups for v1.
- Manually verify a restore in Phase 23, before production deployment, so "we have backups" isn't just an assumption.

---

## 27. Production-Readiness Checklist

- [ ] MVP checklist (Section 14) fully passes in staging
- [ ] Tenant isolation tests pass
- [ ] OTP rate limiting verified
- [ ] Webhook signature verification verified
- [ ] At least one successful backup restore test
- [ ] Pilot clinic ran for at least one full week without a critical bug
- [ ] Basic monitoring/error logging in place (even simple console/log aggregation counts for v1)

---

## 28. Definition of Ready

A feature is ready to build only when:
- Business purpose is clear
- Role is identified
- User story and acceptance criteria are written
- Data model impact is identified
- Tenant-isolation impact is identified
- Test cases are identified

## 29. Definition of Done

A feature is done only when:
- Code complete and reviewed (by you, reading the diff)
- Acceptance criteria pass
- Relevant tests pass, including any tenant-isolation test if data access changed
- No secrets committed
- Migration included if schema changed

---

## 30. Standard AI Task Prompt Template

```text
Project: CliniSend PH

Business Goal:
[Explain the business value.]

User Role:
[Super Admin / Clinic Admin / Doctor / Receptionist / Patient]

User Story:
As a [role], I want [action], so that [benefit].

Acceptance Criteria:
1.
2.
3.

Tenant Isolation Impact:
[Does this touch clinic-scoped data? How is isolation preserved?]

Affected Modules:
- Frontend:
- Backend:
- Database:
- SMS (outbound/inbound):

Security Requirements:
[Access rules, rate limits, secret handling.]

Testing Requirements:
[Unit / integration / isolation tests needed.]

Constraints:
- Do not bypass RLS or role checks.
- Do not hardcode secrets.
- Do not auto-apply an inbound SMS reply if it's ambiguous.
- Do not change unrelated modules.
```

---

## 31. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Semaphore inbound SMS support doesn't match assumptions | High | Phase 4 is a dedicated verification spike; Phase 16 is blocked until it closes. Fallback: portal-only two-way via Phase 17 |
| Message exceeds 160 chars once placeholders expand (esp. Tagalog variants) | Medium | Phase 3 budgets every message at worst-case placeholder length before any template is built |
| Duplicate reminders sent after a restart or overlapping cron run | High | Phase 15 gate requires proven exactly-once delivery per appointment per lead window |
| Cross-clinic data leakage | Critical | RLS enforced at DB layer + explicit isolation tests |
| OTP abuse driving up SMS cost | Medium | Rate limiting per phone number |
| Ambiguous inbound reply wrongly applied to wrong appointment | High | Flag-for-review rule when multiple pending appointments exist |
| Timezone bugs in scheduler | Medium | Explicit PH timezone handling, tested |
| Scope creep (billing, EMR features, mobile app) | High | Section 6.2 out-of-scope list enforced until MVP is validated |
| Solo-developer bandwidth | Medium | Phase gates prevent building everything at once |

---

## 32. Success Metrics

- Number of clinics approved and active
- Reminder delivery success rate
- No-show rate reduction for pilot clinic (before/after comparison)
- Percentage of reminders resolved via SMS reply vs manual follow-up
- Zero cross-clinic data incidents

---

## 33. Immediate Next Actions

Current position: pre-Phase 0. The next work is Phase 0, which is document-only.

1. Approve Section 22 as the plan of record (26 phases, 0–25).
2. Start Phase 0: create the `docs/` structure, the decision log (backfilling the stack and architecture decisions already made in Sections 17–18), the risk register promoted from Section 31, the backlog seeded from Section 6.2, and the agent roster from Section 21.
3. Do not create the Supabase project yet — that is Phase 8. Setting it up before Phase 5 produces the ERD would invert the gate.
4. Line up a real clinic contact for the Phase 1 brief, since Phase 1 needs an observed baseline no-show rate rather than an assumed one.
5. Note that Phase 4 (Semaphore verification) is the earliest phase that can block architecture. It can be started in parallel with Phases 1–3 if a Semaphore account and support contact are available sooner, since its only dependency is the message catalog's cost questions.
