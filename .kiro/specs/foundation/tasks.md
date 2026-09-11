# Implementation Plan

This plan implements the Foundation spec (`requirements.md`) per the design (`design.md`). Tasks are grouped under **README Section 22 phases 8–12**, the declared plan of record, matching design [Section 15](design.md). Each task cites the requirement criteria (`R<req>.<crit>`) and correctness properties (`P<n>`) it satisfies.

Notation: `R2.11` = Requirement 2, criterion 11. `P1` = Correctness Property 1.

## How to use this plan

- Do one task at a time, top to bottom. Later tasks depend on earlier ones.
- A task is done only when its cited criteria are covered by passing code and tests (Definition of Done, README Section 29).
- Every schema or data-access task must run the tenant-isolation harness once it exists (task 9.7), not just its own tests.

## Blocking gates — resolve before the dependent tasks

These are the design's open decisions ([design Section 16](design.md)). Tasks below are marked **[BLOCKED: Gate N]** where they cannot start until you rule. Unblocked tasks proceed regardless.

- **Gate 1 — Phase numbering.** Resolved for this file: README phases 8–12 govern. No task blocked.
- **Gate 2 — Transactional email provider.** Choose a provider (or accept Supabase's built-in SMTP for non-production). Blocks every notification/invitation/reset delivery task.
- **Gate 3 — Three added platform tables** (`rate_limit_counters`, `staff_invitations`, `notification_outbox`). Approve, or relax the criteria needing durable state. Blocks the migrations that create them and everything built on them.
- **Gate 4 — "Explicit UTC+8 offset" wording** (`R7.9`, `R13.5`). Confirm `timestamptz` + render-in-PHT satisfies intent. Affects test assertions only, not structure.
- **Gate 5 — 5-second gate cache TTL.** Confirm 5s (meets `R5.4`) vs relaxing `R5.4` to 30s. Affects one constant.
- **Gate 6 — `SECURITY DEFINER` aggregate counts function.** Approve the one intentional RLS bypass. Blocks the Super Admin counts task.

---

## Phase 8 — Foundation Implementation

Repo scaffold, Supabase project, migration pipeline, `/health`, CI, env config, and the test framework. Gate: CI green, health endpoint reachable, migrations run forward and back.

- [x] 8.1 Repo scaffold and workspace structure
  - npm workspaces root; `backend/` (Express + TS), `frontend/` (React + Vite + TS); `.gitignore` excluding env files, `node_modules`, `dist`
  - _Requirements: R14.4_

- [x] 8.2 Supabase local config and migration directory
  - `supabase/config.toml` with `public` + `app` schemas and session lifetime settings; empty `migrations/`; no-op `seed.sql`
  - _Requirements: R1.23, R3.10_

- [x] 8.3 Backend skeleton: env validation, `/health`, error handler, security headers
  - Fail-closed env validation naming missing vars without values; uniform error shape; HSTS + `nosniff` + `DENY` + `no-referrer`; middleware order per design 2.4
  - _Requirements: R14.7, R14.8, R14.13, R14.14_

- [x] 8.4 Frontend shell with role-based routing placeholders
  - Public routes (login, reset, register-clinic, invitation) + role-guarded groups; role from session not client state; bundle receives only Supabase URL + anon key
  - _Requirements: R14.5_

- [x] 8.5 `.env.example` templates (names only) for backend and frontend
  - _Requirements: R14.3, R14.5, R14.10_

- [x] 8.6 Test framework with a green baseline suite
  - Vitest in both workspaces; backend supertest coverage of `/health`, headers, and env fail-closed; frontend routing tests
  - _Requirements: R14.7, R14.13, R14.14_

- [x] 8.7 CI pipeline: install, typecheck, lint, test, build, secret scan, dependency audit
  - GitHub Actions; gitleaks fails on a credential pattern in any tracked file; `npm audit --audit-level=high --omit=dev` fails on high/critical production findings
  - _Requirements: R14.4, R14.15_

- [x] 8.8 Link the repo to the Supabase project and document the workflow
  - Linked to `ClinicSend-PH` (ref `pflumqftilxfjlozjpry`, Seoul); `supabase/.temp/` confirmed gitignored, holds only version metadata + ref, no secrets
  - _Requirements: R14.10_

- [ ] 8.9 Establish separate staging and production Supabase projects
  - A second project so environments do not share a database; distinct env var sets
  - **[Depends on your environment decision — one project exists today]**
  - _Requirements: R14.10_

- [ ] 8.10 Verify the Phase 8 gate end to end
  - CI green on a pushed branch; `/health` reachable on a deployed backend; a trivial forward + rollback migration proves the pipeline both directions
  - Migration pipeline proven locally (`supabase/migrations/20260910153535_pipeline_probe.sql` + `.down.sql`): forward apply in one transaction with registry record, re-apply no-op (R1.19), rollback drops the probe schema and registry entry, and mid-migration failure aborts the whole transaction leaving nothing behind (R1.20). Verified against a local Postgres container since the full Supabase stack images could not be pulled on this network.
  - Still open (external): CI green on a pushed branch (needs push/PR to `main`); `/health` reachable on a deployed backend (needs a deploy — Phase 21).
  - _Requirements: R1.19, R1.20, R1.23; P9_

---

## Phase 9 — Tenancy & RLS

The baseline schema, `clinic_id` everywhere, RLS enabled, and an isolation harness whose credibility is proven by a negative control. Gate: harness passes, and fails when a policy is deliberately dropped.

- [ ] 9.1 Migration: `app` schema and JWT claim helper functions
  - `app.jwt_clinic_id()`, `app.jwt_app_role()`, `app.is_super_admin()`; `NULL`-safe so anonymous, Super Admin, and malformed tokens all deny by default on tenant tables
  - _Requirements: R2.11, R2.13_

- [ ] 9.2 Migration: platform-level tables (`platform_admins`) and enum check constraints
  - `platform_admins` (`id` = Auth uid, no generated default); status/role/appointment/direction/message-status/action/target check constraints as CHECKs not ENUMs
  - _Requirements: R1.2, R1.13, R1.14, R1.15, R1.16, R1.24_

- [ ] 9.3 Migration: `clinics` table with defaults and constraints
  - Columns, `status` default `PENDING_APPROVAL`, `default_reminder_hours_before` default 24 (1–168), generated `id`
  - _Requirements: R1.3, R1.21, R1.22_

- [ ] 9.4 Migration: `clinic_users`, `patients`, `templates` with tenant keys and unique constraints
  - `clinic_id` NOT NULL + FK `ON DELETE RESTRICT`; `clinic_users.id` = Auth uid; case-insensitive unique email on `clinic_users` and `platform_admins`; unique `(clinic_id, mobile_number)` and `(clinic_id, name)`
  - _Requirements: R1.4, R1.5, R1.7, R1.10, R1.11, R1.18_

- [ ] 9.5 Migration: `appointments` and `messages` with nullable inbound fields
  - `appointment_date` as `date`, `appointment_time` as `time`; `status` default `Scheduled`; nullable `appointment_id`/`patient_id` on `messages`; `cost` numeric(6,2) 0–9999.99
  - _Requirements: R1.6, R1.8, R1.11, R1.22_

- [ ] 9.6 Migration: `audit_logs` (NOT NULL `clinic_id`, no FK on `actor_user_id`) and all `clinic_id` indexes
  - Append-only shape; `clinic_id` index on every tenant-scoped table
  - _Requirements: R1.9, R1.12, R1.17, R1.25_

- [ ] 9.7 Migration: composite foreign keys for tenant-safe references
  - Unique `(clinic_id, id)` parents; composite FKs on `appointments.patient_id`/`doctor_user_id`/`created_by` and `messages.appointment_id`/`patient_id`/`review_resolved_by_user_id` so a cross-tenant reference has no parent row
  - _Requirements: R1.10, R12.12; P1_

- [ ] 9.8 Migration: enable and FORCE RLS; tenant read/write policies per the matrix
  - `ENABLE` + `FORCE ROW LEVEL SECURITY`; per-table `USING`/`WITH CHECK` policies encoding both the tenant predicate and the role matrix (design 5.3–5.4); no `super_admin` clause on `patients`/`appointments`/`templates`/`messages`
  - _Requirements: R2.1, R2.2, R2.3, R2.4, R2.5, R2.6, R2.7, R2.8, R2.9, R2.14; R9.1, R9.3, R9.6, R10.3, R10.4, R11.1, R12.1–R12.5; P1, P2, P4_

- [ ] 9.9 Tenant-isolation test harness + negative control
  - Authenticate as each role in clinic A, assert zero reads and denied writes against clinic B, including anon-key sessions and `clinic_id`-reassignment attempts; a mode that drops one policy and asserts the harness reports a leak
  - _Requirements: R2.4, R2.5, R2.6, R2.13, R2.14; P1, P2_

- [ ] 9.10 Schema-shape assertion tests
  - Assert every table, column, nullability, default, check constraint, unique constraint, FK, and index from R1 exists as specified
  - _Requirements: R1.1–R1.18, R1.21, R1.22, R1.24, R1.25_

---

## Phase 10 — Staff Authentication & Roles

Staff login with a server-verified role + `clinic_id` claim, route guards, password reset, and the clinic status gate. Gate: role and clinic come from the database, never the client.

- [ ] 10.1 Custom Access Token Hook: mint `app_role` and `clinic_id` claims
  - Postgres hook reading `clinic_users`/`platform_admins`; `app_role` (not `role`); `clinic_id` absent for Super Admin; a user in neither table gets neither claim
  - _Requirements: R2.11, R3.3, R3.14_

- [ ] 10.2 Configure Supabase session lifetime
  - Timebox 12h, inactivity 60m, access-token expiry 30m; refresh restarts inactivity and leaves the 12h cap intact
  - _Requirements: R3.10, R3.15_

- [ ] 10.3 `rate_limit_counters` table and login lockout
  - DB-backed counter surviving restarts; 5 failed credential checks per 15 min → 15-min block; evaluated before credential verification and before status; only mismatches count; reset on success/reset
  - **[BLOCKED: Gate 3]**
  - _Requirements: R3.13, R3.16_

- [ ] 10.4 `authenticate` middleware: verify JWT, extract claims
  - Signature + expiry check; extract `app_role`, `clinic_id`, `sub`; reject expired/terminated sessions as unauthenticated without returning role/clinic
  - _Requirements: R2.11, R3.10_

- [ ] 10.5 Login flow with uniform errors and status gating
  - Uniform invalid-credentials wording; `is_active` false → contact-admin message; Super Admin path returns role only, no `clinic_id`; per-status rejection messages; status-caused rejections do not increment the counter
  - **[Partially BLOCKED: Gate 3 for counter]**
  - _Requirements: R3.1–R3.5, R3.14, R6.1, R6.2, R6.3_

- [ ] 10.6 Gate cache + `gateAccountAndClinic` middleware
  - Single `is_active` + clinic `status` lookup, 5s TTL, 2s timeout failing closed to 403; blocks a still-`ACTIVE`-issued session within the TTL and terminates it; no gate for Super Admin
  - **[Gate 5 sets the TTL constant]**
  - _Requirements: R6.4, R6.6, R6.7, R6.8, R6.9; P3_

- [ ] 10.7 `authorize(role, action)` middleware: the permission matrix
  - Express-layer mirror of the RLS matrix for fast, well-worded 403s; table-driven so it can be tested against the model
  - _Requirements: R9, R10, R11, R12; P4_

- [ ] 10.8 Password reset flow
  - 60-min single-use link; 12–72 char new password; identical response for unknown addresses; completion invalidates all reset links and terminates sessions
  - **[BLOCKED: Gate 2 for delivery]**
  - _Requirements: R3.7, R3.8, R3.9_

- [ ] 10.9 Logout and session termination utility
  - Logout terminates the session; a shared utility revokes `auth.sessions` rows and invalidates the gate cache (used by suspension, deactivation, reset)
  - _Requirements: R3.9, R3.11, R5.4, R6.7, R8.6_

- [ ] 10.10 Frontend: wire real session role into routing
  - Resolve `app_role` from the authenticated session; route by role; client validation is feedback-only, server authoritative
  - _Requirements: R3.3, R3.14_

- [ ] 10.11 Auth integration tests
  - Lockout ordering, uniform errors, session expiry/refresh, deactivation-blocks-auth across roles and clinic statuses
  - **[Gate 3 for lockout tests]**
  - _Requirements: R3.4, R3.5, R3.10, R3.13, R3.16; P8_

---

## Phase 11 — Clinic Registration & Approval Lifecycle

Self-registration → `PENDING_APPROVAL`, Super Admin approve/reject/suspend/reactivate, all audited. Gate: an unapproved clinic cannot log in; every decision is audited.

- [ ] 11.1 `notification_outbox` table and delivery worker
  - `status`/`attempt_count`/`next_attempt_at`/`last_error`; `FOR UPDATE SKIP LOCKED` claim; ≤3 attempts within 15 min; final failure surfaces to the Super Admin; state survives restart
  - **[BLOCKED: Gate 2, Gate 3]**
  - _Requirements: R5.6, R5.7, R5.13_

- [ ] 11.2 `audit_logs` append-only trigger and audit writer
  - `BEFORE UPDATE OR DELETE` trigger raising unconditionally (including service role); writer used inside each privileged action's transaction; excludes secrets; `actor_user_id` maps to the right table; `clinic_id` = affected clinic
  - _Requirements: R13.5, R13.6, R13.7, R13.8, R13.9, R13.10; P6_

- [ ] 11.3 `app.register_clinic` RPC (single transaction)
  - Inserts `clinics` (PENDING_APPROVAL) + admin `clinic_users` + `clinic_registered` audit in one transaction; duplicate clinic name/email allowed; `default_reminder_hours_before` = 24
  - _Requirements: R4.2, R4.3, R4.4, R13.4; P7_

- [ ] 11.4 Registration service: validation, saga, compensation, rate limit
  - Field validation before Auth user creation; email availability across `clinic_users` + `platform_admins`; Auth-user compensation on transaction failure (incl. compensation-failure branch); 3-per-60min per source address
  - **[Partially BLOCKED: Gate 3 for rate limit]**
  - _Requirements: R4.1, R4.5, R4.6, R4.7, R4.8, R4.9, R4.12, R4.13; P7_

- [ ] 11.5 Registration notifications and confirmation
  - Confirmation stating approval is pending; Super Admin notice enqueued; a failed notice does not roll back the registration
  - **[BLOCKED: Gate 2]**
  - _Requirements: R4.10, R4.11, R4.14_

- [ ] 11.6 `app.set_clinic_status` RPC (single transaction, row lock)
  - `FOR UPDATE` lock; missing clinic / invalid transition / over-length reason → error; no-op when target = current; valid transition updates status (+ reason on reject) and writes the matching audit row
  - _Requirements: R5.2, R5.3, R5.8, R5.10, R5.11, R5.12, R13.1; P5, P6_

- [ ] 11.7 Approval service, session revocation on suspend, clinic list
  - Super Admin-only; suspension revokes sessions within 5s and invalidates cache; retries on notification failure; paginated filterable list sorted `created_at` desc, PHT-rendered, page size 10–100 default 25
  - **[BLOCKED: Gate 2 for notifications]**
  - _Requirements: R5.1, R5.4, R5.5, R5.9, R5.13, R9.2_

- [ ] 11.8 Clinic status gate: block non-ACTIVE clinics platform-wide
  - Authenticated requests for a non-ACTIVE clinic → 403, zero row changes, no clinic data; login rejections per status; reactivation restores access
  - _Requirements: R6.1, R6.2, R6.3, R6.4, R6.5; P3_

- [ ] 11.9 Registration + approval integration tests
  - Atomicity under injected failures; unapproved clinic cannot log in; audit-row-per-successful-action count; concurrent status requests
  - **[Gate 2/3 for delivery + rate-limit assertions]**
  - _Requirements: R4.9, R5.12, R6.1; P5, P6, P7_

---

## Phase 12 — Clinic Profile & Staff Provisioning

Clinic profile, default lead time, sender name, and staff invite/deactivate/reactivate scoped to the inviting clinic. Gate: new staff are scoped to the inviting clinic only.

- [ ] 12.1 Column-guard triggers
  - `guard_clinics_columns` (SA: status/reason only; CA: 5 profile fields only), `guard_clinic_users_immutable` (role/clinic_id/id), `guard_clinic_users_scope` (is_active only, not own row, SA cannot set true), `guard_last_active_admin`, `set_updated_at`, `normalize_mobile_number`
  - _Requirements: R7.8, R8.5, R8.11, R8.14, R8.16, R9.5, R9.7, R10.1_

- [ ] 12.2 Clinic profile read/update service
  - CA reads/updates `name`, `contact_email`, `contact_phone`, `default_reminder_hours_before`, `sender_name`; per-field validation; partial update applies submitted, leaves omitted; all-or-nothing on failure; PHT rendering of `created_at`
  - **[Gate 4 affects timestamp assertions]**
  - _Requirements: R7.1–R7.7, R7.9, R7.10, R7.11, R10.1_

- [ ] 12.3 Contact-email-change notification
  - On accepted email change, notify both former and new addresses
  - **[BLOCKED: Gate 2]**
  - _Requirements: R7.12_

- [ ] 12.4 `staff_invitations` table and token lifecycle
  - 72h expiry, single use, prior-link invalidation on resend, hashed tokens; 5-resend-per-60min cap
  - **[BLOCKED: Gate 3]**
  - _Requirements: R8.3, R8.4, R8.15_

- [ ] 12.5 `app.create_staff_user` RPC + provisioning service
  - Single transaction: `clinic_users` (is_active true) + invitation + `staff_account_created` audit, after Auth-user saga; role limited to doctor/receptionist; admin/role-escalation rejected before Auth call; email availability check; own-clinic only
  - **[Partially BLOCKED: Gate 2 invite delivery, Gate 3 invitation table]**
  - _Requirements: R8.1, R8.2, R8.9, R8.10, R8.14, R10.11, R13.2_

- [ ] 12.6 Invitation acceptance and resend endpoints
  - Accept sets the password via Auth admin API and consumes the invitation; expired/used link → request-new message; resend invalidates prior links and enforces the cap
  - **[BLOCKED: Gate 2, Gate 3]**
  - _Requirements: R8.4, R8.15_

- [ ] 12.7 Staff activation change service (deactivate / reactivate)
  - `app.set_staff_active` RPC + audit; deactivation revokes sessions within 60s; reactivation reissues an invite if credentials never set; last-active-admin and self-deactivation guards; Super Admin may set false only; role write forbidden
  - **[Gate 2 for reissue delivery]**
  - _Requirements: R8.6, R8.7, R8.8, R8.11, R8.13, R8.16, R9.5, R13.3_

- [ ] 12.8 Frontend: clinic profile and staff management views (Clinic Admin)
  - Profile form and staff list/create/deactivate; client validation mirrors server rules; accessible forms (labelled inputs, visible focus, field-tied errors)
  - _Requirements: R7.1, R8.1, R8.5, R10.1, R10.2_

- [ ] 12.9 Provisioning + profile integration tests
  - Staff scoped to inviting clinic; invitation expiry/resend; deactivation blocks auth and preserves history; column guards reject out-of-scope updates
  - **[Gate 2/3 for invitation + delivery assertions]**
  - _Requirements: R8.6, R8.7, R8.15, R10.1; P8, P12_

---

## Cross-cutting — carried through every phase above

These are not a separate phase; they are satisfied by tasks already listed and re-verified continuously.

- [ ] X.1 Service role key containment audit
  - Confirm the service role key is used only at the enumerated call sites (design 12.2) and never reaches the browser bundle; bundle-inspection test
  - _Requirements: R2.10, R14.5_

- [ ] X.2 Appointment status guard trigger (schema-owned, though editing is Phase 13)
  - `guard_appointment_status`: Doctor sets only Completed/No-show from a non-terminal status changing only status+updated_at; Receptionist cannot set Reminder Sent; No-show only by doctor/receptionist, never automated
  - _Requirements: R11.2, R11.3, R11.10, R11.11, R11.12, R12.13; P11_

- [ ] X.3 Super Admin permissions surface
  - `GET /clinics`, `PATCH /clinics/:id/status`, `GET /staff` (limited columns), `GET /audit-logs` (limited columns); no write path to operational tables
  - _Requirements: R9.1, R9.2, R9.3, R9.7, R9.10_

- [ ] X.4 Super Admin per-clinic counts via `SECURITY DEFINER` function
  - `app.platform_clinic_counts()` returning only integer counts + `clinics.id`, self-checking the caller claim; zero for empty clinics; no row/column from restricted tables even via joins
  - **[BLOCKED: Gate 6]**
  - _Requirements: R2.8, R9.4, R9.9_

- [ ] X.5 `platform_admins` seed-only creation
  - No insert policy and no authenticated interface creates a `platform_admins` row; only the seed routine via service-role credentials
  - _Requirements: R9.8_

- [ ] X.6 Timezone strategy verification
  - `timestamptz` for instants, `date`/`time` for appointments, explicit `at time zone 'Asia/Manila'` rendering; property test under several host timezones
  - **[Gate 4 affects wording of assertions]**
  - _Requirements: R1.22, R7.9, R13.5, R14.11; P10_

- [ ] X.7 Security baseline verification suite
  - HTTPS redirect posture, CORS exact-origin no-wildcard, header assertions, payload schema validation before DB access, parameterized queries only, no secrets in responses/logs, startup secret check
  - _Requirements: R14.1, R14.2, R14.6, R14.7, R14.8, R14.9, R14.12, R14.13, R14.14_

- [ ] X.8 Development seed routine
  - Environment-gated (local/staging only); per-account password env vars validated 12–72; Demo Clinic + Demo Clinic Two (ACTIVE, 3 roles each) + Pending Demo Clinic (admin); idempotent; full rollback incl. Auth users on any failure
  - _Requirements: R15.1–R15.8; P9_

- [ ] X.9 Migration idempotence verification
  - Apply the full migration set twice against a fresh database; diff schema dumps and the version registry; forward + rollback both proven
  - _Requirements: R1.19, R1.20, R1.23; P9_

---

## Requirement-to-task coverage

| Requirement | Tasks |
|---|---|
| R1 Baseline schema | 8.2, 9.2–9.7, 9.10, X.9 |
| R2 Tenant isolation | 9.1, 9.8, 9.9, 10.1, 10.4, X.1 |
| R3 Staff authentication | 10.1–10.5, 10.8, 10.9, 10.11 |
| R4 Registration | 11.3, 11.4, 11.5, 11.9 |
| R5 Approval lifecycle | 11.6, 11.7, 11.9 |
| R6 Status gating | 10.6, 11.8 |
| R7 Clinic profile | 12.1, 12.2, 12.3, X.6 |
| R8 Staff provisioning | 10.3, 12.4–12.7, 12.9 |
| R9 Super Admin permissions | 9.8, 10.7, X.3, X.4, X.5 |
| R10 Clinic Admin permissions | 9.8, 10.7, 12.2, 12.8 |
| R11 Doctor permissions | 10.7, X.2 |
| R12 Receptionist permissions | 9.8, 10.7, X.2 |
| R13 Audit logging | 11.2, 11.6, X (audit writer) |
| R14 Security baseline | 8.3–8.7, X.1, X.7 |
| R15 Seed data | X.8 |
| P1–P12 | 9.7–9.9, 10.6, 10.11, 11.2–11.9, 12.9, X.2, X.6, X.9 |
