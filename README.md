# CliniSend PH — SMS Appointment Reminder Platform

**System Name:** Clinic SMS Reminder & Two-Way Confirmation Platform
**Short Name:** CliniSend PH
**Project Folder:** `clinisend/`
**Primary Deployment Platform:** Vercel (frontend) + Railway or Render (backend) + Supabase (DB/Auth)
**Status:** Planning and Architecture Preparation
**Coding Status:** Not started — planning must be approved first

**Who may implement:** Solo developer using AI-assisted development (Claude Code), following the phase gates below.

---

## 1. Purpose of This Document

This is the planning and SDLC guide for CliniSend PH, written before any code is generated. It defines the business problem, MVP, roles, workflow, data model, agent responsibilities, phases, and approval gates so that vibe-coding sessions have a fixed scope to build against instead of drifting.

> **Rule:** No code should be generated until Sections 6 (Scope), 8 (Roles), 10 (Workflow), and 19 (Data Model) are approved by you.

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
| SMS (outbound + inbound) | Semaphore API (PH-focused, supports sending; inbound requires a receiving number/webhook setup — confirm current Semaphore inbound support before Phase 4, as this is the highest-risk integration point) |
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
Owns everything Semaphore-specific: outbound send calls, delivery status polling/webhooks, inbound message parsing, keyword matching, retry/failure handling. This is split out from the general Backend Agent because it's the riskiest and most PH-specific integration point (confirm inbound SMS capability and webhook format with Semaphore's actual docs before building Phase 4).

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

**Phase 0 — Approval**
Approve this document's scope, roles, workflow, and data model before any code.

**Phase 1 — Foundation**
Supabase project, tables, RLS policies, staff auth (Super Admin, Clinic Admin, Doctor, Receptionist), clinic signup + approval flow.

**Phase 2 — Patients and Appointments**
Receptionist CRUD for patients and appointments; Doctor read-only view; basic dashboard shell per role.

**Phase 3 — Outbound SMS**
Templates, Semaphore integration, scheduler (`pg_cron` or node-cron) sending reminders at the configured lead time, delivery log.

**Phase 4 — Inbound SMS (two-way)**
Webhook endpoint, keyword parsing, ambiguity handling (flag when unclear), status auto-update on CONFIRM/CANCEL.

**Phase 5 — Patient Portal**
OTP request/verify, view own appointment, confirm/cancel via web.

**Phase 6 — Reporting**
Clinic-level report (delivery rate, no-show rate, cost), Super Admin platform-wide view.

**Phase 7 — Hardening**
Tenant-isolation tests, OTP rate-limit tests, webhook signature verification, audit log completeness.

**Phase 8 — Staging Deployment**
Deploy to Vercel + Railway/Render staging, seed test data, run through Section 14's MVP checklist end to end.

**Phase 9 — Pilot**
Onboard one real clinic, monitor closely, fix real-world issues (message formatting, delivery failures, wrong timezone edge cases).

**Phase 10 — Production Launch**
Open self-serve signup publicly, monitor approval queue and platform usage.

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
- Manually verify a restore at least once before the pilot phase (Phase 9), so "we have backups" isn't just an assumption.

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
| Semaphore inbound SMS support doesn't match assumptions | High | Verify inbound/webhook capability with Semaphore docs/support before Phase 4 |
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

1. Confirm Semaphore's inbound SMS / webhook capability before committing to Phase 4 design.
2. Create the `clinisend` repo and save this file as `clinisend/README.md`.
3. Set up the Supabase project (staging) and draft the schema from Section 19.
4. Approve Sections 6, 8, 10, and 19.
5. Begin Phase 1.
