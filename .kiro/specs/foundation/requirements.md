# Requirements Document

## Introduction

This specification covers **Foundation** of CliniSend PH, a multi-tenant SMS appointment reminder platform for Philippine clinics. In the project README Section 22 — the declared plan of record — Foundation spans **phases 8 through 12**: Foundation Implementation (8), Tenancy & RLS (9), Staff Authentication & Roles (10), Clinic Registration & Approval Lifecycle (11), and Clinic Profile & Staff Provisioning (12). All phase numbers in this document refer to README Section 22. Foundation delivers the base on which every later phase builds: the Supabase Postgres schema for all baseline tables, Row-Level Security policies that enforce tenant isolation at the database layer, staff authentication for the four staff roles via Supabase Auth, the role-based permission model, and the clinic self-registration and Super Admin approval lifecycle.

The full baseline schema (including `patients`, `appointments`, `templates`, and `messages`) is created in this phase so later phases add behavior rather than restructure storage. The user-facing features that operate on those tables — patient and appointment management, message templates, Semaphore SMS integration, the reminder scheduler, the inbound SMS webhook, the patient OTP portal, and reporting views — are explicitly **out of scope** for this specification. The permission model for those features is defined here because Foundation owns the authorization layer that guards them.

Fixed technology decisions for this phase: React (Vite) frontend, Node.js + Express backend, Supabase (Postgres + Row-Level Security + Supabase Auth), deployment on Vercel (frontend) and Railway or Render (backend). All date and time logic is expressed in Philippine Standard Time.

**Out of scope for this specification** (README Section 22 phase in parentheses): patient and appointment management interfaces (Phase 13), template management interface and Semaphore outbound SMS and the `pg_cron` reminder scheduler and delivery log (Phases 14–15), inbound SMS webhook and keyword parsing and ambiguity flagging (Phase 16), patient OTP portal (Phase 17), reporting views (Phase 18), hardening test suites (Phases 19–20), staging deployment (Phase 21), and all items listed as excluded from the MVP in the project README Section 6.2 (subscription billing, multiple SMS provider fallback, native mobile application, electronic medical records, multi-branch per clinic, calendar synchronization, email fallback channel, advanced analytics, white-labeling, and formal RA 10173 compliance documentation).

## Glossary

### Domain Terms

- **Tenant**: A single registered clinic and all data belonging to that clinic. CliniSend PH is a shared multi-tenant platform in which every tenant's data is isolated from every other tenant's data.
- **clinic_id**: The column present on every tenant-scoped table that identifies which clinic owns the row. Tenant isolation is keyed entirely on `clinic_id`.
- **Tenant-scoped table**: A table that carries a `clinic_id` column and whose rows belong to exactly one clinic: `clinic_users`, `patients`, `appointments`, `templates`, `messages`, and `audit_logs`. The `clinic_id` column is NOT NULL on every one of these tables, including `audit_logs`, so every row of every tenant-scoped table belongs to exactly one clinic.
- **RLS (Row-Level Security)**: A PostgreSQL feature that restricts which rows a database role may read or write, evaluated by the database engine on every query regardless of the query's origin. RLS is the enforcement mechanism for tenant isolation in CliniSend PH.
- **RLS policy**: A single named database rule attached to one table that defines the row-visibility or row-write condition for a given operation.
- **Philippine Standard Time (PHT)**: The UTC+8 timezone used for all clinic-facing date and time values in CliniSend PH.
- **Privileged action**: An action that changes clinic lifecycle status or staff account existence or status. Privileged actions are: clinic approval, clinic rejection, clinic suspension, clinic reactivation, staff account creation, staff account deactivation, and staff account reactivation.
- **Ambiguous inbound message**: An inbound `messages` row whose `requires_review` value is true because the sending phone number matched more than one pending appointment. The `requires_review` flag is set in Phase 16 and is resolved by a Receptionist, who sets `review_resolved_at` and `review_resolved_by_user_id`. Foundation creates the columns and the permission rules; the matching logic is delivered in Phase 16.
- **Migration version registry**: The table in the Database_Layer that records the version identifier and application time of each successfully applied migration, and against which the Migration_System determines which migrations are pending.

### Clinic Statuses

- **PENDING_APPROVAL**: The status assigned to a clinic immediately after clinic self-registration. A clinic in this status has no platform access.
- **ACTIVE**: The status assigned to a clinic after Super Admin approval. A clinic in this status has platform access for the clinic's staff accounts.
- **REJECTED**: The status assigned to a clinic whose registration the Super Admin declined. A clinic in this status has no platform access.
- **SUSPENDED**: The status assigned to a previously ACTIVE clinic that the Super Admin has suspended. A clinic in this status has no platform access, and the clinic's data is retained.

### Roles

- **Super Admin**: The platform owner. Super Admin accounts are seeded manually and are recorded in the `platform_admins` table. A Super Admin is not associated with any `clinic_id`.
- **Clinic Admin**: The owner or manager of one clinic. A Clinic Admin is a `clinic_users` row with role `admin`.
- **Doctor**: Clinical staff of one clinic. A Doctor is a `clinic_users` row with role `doctor`.
- **Receptionist**: Front-desk staff of one clinic. A Receptionist is a `clinic_users` row with role `receptionist`.
- **Staff account**: Any account with the role Super Admin, Clinic Admin, Doctor, or Receptionist. Staff accounts authenticate with email and password. Staff passwords are 12 to 72 characters.
- **Patient**: A person who receives appointment reminders. A Patient is a `patients` row and is **not** a staff account, holds no password, and is not part of the staff authentication system. A Patient's mobile number is stored in the 11-digit `09` form, and each mobile number is unique within one clinic. Patient authentication is delivered in Phase 17 and is outside this specification.

### Appointment Statuses

The `appointments.status` column accepts exactly these seven values, defined here because the Foundation schema creates the constraint. The transitions between these values are implemented in later phases.

- **Scheduled**: The appointment is recorded and no reminder has been sent.
- **Reminder Sent**: A reminder message has been sent to the patient for this appointment.
- **Confirmed**: The patient has confirmed attendance.
- **Cancelled**: The appointment has been cancelled.
- **Reschedule Requested**: The patient has asked to move the appointment, and clinic staff action is required.
- **Completed**: The patient attended the appointment.
- **No-show**: The patient did not attend the appointment.

`Completed`, `No-show`, and `Cancelled` are terminal statuses: a Doctor cannot change the `status` of a row that already holds one of these three values.

### System Components

- **Database_Layer**: The Supabase-hosted PostgreSQL database, including the schema, constraints, and RLS policies.
- **Migration_System**: The versioned SQL migration mechanism that creates and alters the Database_Layer schema and RLS policies, and that maintains the migration version registry.
- **Auth_Service**: Supabase Auth together with the backend logic that establishes an authenticated staff session and resolves the session's role and `clinic_id`.
- **Authorization_Layer**: The backend Express middleware and route guards that permit or reject a request based on the authenticated staff account's role, `clinic_id`, and clinic status.
- **Registration_Service**: The backend component that accepts clinic self-registration submissions and creates the clinic record and the initial Clinic Admin account.
- **Approval_Service**: The backend component that applies Super Admin decisions to a clinic's status.
- **Staff_Provisioning_Service**: The backend component that creates, deactivates, and reactivates Clinic Admin, Doctor, and Receptionist accounts.
- **Audit_Logger**: The backend component that writes one `audit_logs` row for each privileged action.
- **Platform**: The complete CliniSend PH system, comprising the React frontend, the Express backend, and the Database_Layer.

## Requirements

### Requirement 1: Baseline Database Schema

**User Story:** As the platform owner, I want the complete baseline schema created in Foundation, so that later phases add behavior without restructuring storage.

#### Acceptance Criteria

1. THE Migration_System SHALL create the tables `platform_admins`, `clinics`, `clinic_users`, `patients`, `appointments`, `templates`, `messages`, and `audit_logs` in the Database_Layer.
2. THE Migration_System SHALL create the `platform_admins` table with the columns `id`, `email`, and `created_at`, where `id` equals the Supabase Auth user identifier of the seeded Super Admin account, `email` is NOT NULL with a maximum of 255 characters, and `created_at` is NOT NULL.
3. THE Migration_System SHALL create the `clinics` table with the columns `id`, `name`, `contact_email`, `contact_phone`, `status`, `rejection_reason`, `default_reminder_hours_before`, `sender_name`, and `created_at`, where `name` is NOT NULL with 1 through 120 characters, `contact_email` is NOT NULL with a maximum of 255 characters, `contact_phone` is NOT NULL with a maximum of 20 characters, `status` is NOT NULL with a default of `PENDING_APPROVAL`, `rejection_reason` is nullable with a maximum of 500 characters, `default_reminder_hours_before` is NOT NULL with a default of 24 and constrained to integers from 1 through 168 inclusive, `sender_name` is nullable with a maximum of 11 characters, and `created_at` is NOT NULL.
4. THE Migration_System SHALL create the `clinic_users` table with the columns `id`, `clinic_id`, `role`, `name`, `email`, `created_at`, and `is_active`, where `id` equals the Supabase Auth user identifier of that staff account, `role` is NOT NULL, `name` is NOT NULL with 1 through 120 characters, `email` is NOT NULL with a maximum of 255 characters, `is_active` is NOT NULL with a default of true, and `created_at` is NOT NULL.
5. THE Migration_System SHALL create the `patients` table with the columns `id`, `clinic_id`, `name`, `mobile_number`, `notes`, and `created_at`, where `name` is NOT NULL with 1 through 120 characters, `mobile_number` is NOT NULL and constrained to 11 digits beginning with `09`, `notes` is nullable with a maximum of 1000 characters, `created_at` is NOT NULL, and a unique constraint applies to the pair (`clinic_id`, `mobile_number`).
6. THE Migration_System SHALL create the `appointments` table with the columns `id`, `clinic_id`, `patient_id`, `doctor_user_id`, `appointment_date`, `appointment_time`, `status`, `created_by`, `created_at`, and `updated_at`, where `patient_id`, `appointment_date`, `appointment_time`, `created_at`, and `updated_at` are NOT NULL, `doctor_user_id` and `created_by` are nullable, `appointment_date` holds a calendar date and `appointment_time` holds a time of day both interpreted in Philippine Standard Time, and `status` is NOT NULL with a default of `Scheduled`.
7. THE Migration_System SHALL create the `templates` table with the columns `id`, `clinic_id`, `name`, `body`, and `created_at`, where `name` is NOT NULL with 1 through 60 characters, `body` is NOT NULL with 1 through 500 characters, `created_at` is NOT NULL, and a unique constraint applies to the pair (`clinic_id`, `name`).
8. THE Migration_System SHALL create the `messages` table with the columns `id`, `clinic_id`, `appointment_id`, `patient_id`, `direction`, `body`, `status`, `semaphore_message_id`, `cost`, `requires_review`, `review_resolved_at`, `review_resolved_by_user_id`, and `created_at`, where `direction`, `body`, `status`, `requires_review`, and `created_at` are NOT NULL, `requires_review` defaults to false, `body` has a maximum of 1000 characters, `appointment_id` and `patient_id` are nullable so that an unmatched inbound message persists, `semaphore_message_id` is nullable with a maximum of 64 characters, `cost` is nullable and constrained to values from 0.00 through 9999.99, and `review_resolved_at` and `review_resolved_by_user_id` are nullable.
9. THE Migration_System SHALL create the `audit_logs` table with the columns `id`, `clinic_id`, `actor_user_id`, `action`, `target_table`, `target_id`, and `created_at`, where `action` is NOT NULL with a maximum of 64 characters, `target_table` is NOT NULL with a maximum of 64 characters, `actor_user_id` is NOT NULL, `target_id` is nullable, and `created_at` is NOT NULL.
10. THE Migration_System SHALL define a `clinic_id` column with a foreign key reference to `clinics.id` and ON DELETE RESTRICT behavior on each of the tables `clinic_users`, `patients`, `appointments`, `templates`, `messages`, and `audit_logs`, and SHALL define foreign key references with ON DELETE RESTRICT behavior from `appointments.patient_id` to `patients.id`, from `appointments.doctor_user_id` and `appointments.created_by` and `messages.review_resolved_by_user_id` to `clinic_users.id`, from `messages.appointment_id` to `appointments.id`, and from `messages.patient_id` to `patients.id`.
11. THE Migration_System SHALL define the `clinic_id` column as NOT NULL on the tables `clinic_users`, `patients`, `appointments`, `templates`, and `messages`.
12. THE Migration_System SHALL define the `audit_logs.clinic_id` column as NOT NULL so that every audit log row is associated with exactly one clinic.
13. THE Migration_System SHALL constrain `clinics.status` to the values `PENDING_APPROVAL`, `ACTIVE`, `REJECTED`, and `SUSPENDED`.
14. THE Migration_System SHALL constrain `clinic_users.role` to the values `admin`, `doctor`, and `receptionist`.
15. THE Migration_System SHALL constrain `appointments.status` to the values `Scheduled`, `Reminder Sent`, `Confirmed`, `Cancelled`, `Reschedule Requested`, `Completed`, and `No-show`.
16. THE Migration_System SHALL constrain `messages.direction` to the values `outbound` and `inbound`, and `messages.status` to the values `sent`, `delivered`, `failed`, and `received`.
17. THE Migration_System SHALL create an index on the `clinic_id` column of each tenant-scoped table.
18. THE Migration_System SHALL define a case-insensitive unique constraint on `clinic_users.email` and a case-insensitive unique constraint on `platform_admins.email`.
19. WHEN a migration whose version is already recorded in the migration version registry is applied, THE Migration_System SHALL apply zero schema changes, leave the registry entry unchanged, and complete with a success indication.
20. IF any statement of a migration fails during application, THEN THE Migration_System SHALL roll back every statement of that migration within a single transaction, add no entry for that migration to the migration version registry, and return an error indication naming the failed migration version.
21. THE Migration_System SHALL define the `id` column of each of the tables `platform_admins`, `clinics`, `clinic_users`, `patients`, `appointments`, `templates`, `messages`, and `audit_logs` as the primary key, and SHALL generate a value for `id` on insert for `clinics`, `patients`, `appointments`, `templates`, `messages`, and `audit_logs`.
22. THE Migration_System SHALL define every `created_at`, `updated_at`, and `review_resolved_at` column as a timestamp carrying an explicit time zone offset, and SHALL default `created_at` to the instant of insert.
23. THE Migration_System SHALL maintain a migration version registry in the Database_Layer that records the version identifier and application time of each successfully applied migration, and SHALL apply pending migrations in ascending version order.
24. THE Migration_System SHALL constrain `audit_logs.action` to the values `clinic_registered`, `clinic_approved`, `clinic_rejected`, `clinic_suspended`, `clinic_reactivated`, `staff_account_created`, `staff_account_deactivated`, and `staff_account_reactivated`, and SHALL constrain `audit_logs.target_table` to the values `clinics` and `clinic_users`.
25. THE Migration_System SHALL define `audit_logs.actor_user_id` with no foreign key constraint, so that the column holds either a `platform_admins` identifier or a `clinic_users` identifier.

### Requirement 2: Tenant Isolation Enforced at the Database Layer

**User Story:** As the platform owner, I want tenant isolation enforced by the database itself, so that a defect in the backend code cannot expose one clinic's data to another clinic.

#### Acceptance Criteria

1. THE Database_Layer SHALL have Row-Level Security enabled on each of the tables `clinic_users`, `patients`, `appointments`, `templates`, `messages`, and `audit_logs`.
2. THE Database_Layer SHALL define, on each tenant-scoped table, an RLS policy that restricts read access to rows whose `clinic_id` equals the `clinic_id` claim carried by the requesting session's Supabase Auth token.
3. THE Database_Layer SHALL define, on each tenant-scoped table, an RLS policy that restricts insert, update, and delete access to rows whose existing `clinic_id` and whose submitted `clinic_id` both equal the `clinic_id` claim carried by the requesting session's Supabase Auth token.
4. WHEN a query is executed under the credentials of a staff account belonging to one clinic, THE Database_Layer SHALL return only rows whose `clinic_id` equals that staff account's `clinic_id`.
5. IF an insert is executed under the credentials of a staff account and the submitted `clinic_id` is absent or differs from that staff account's `clinic_id`, THEN THE Database_Layer SHALL reject the insert with an error indicating a row-level security violation and persist zero rows.
6. IF an update or a delete is executed under the credentials of a staff account and the operation targets a row whose `clinic_id` differs from that staff account's `clinic_id`, THEN THE Database_Layer SHALL apply zero row changes and report zero affected rows.
7. WHEN a query for `clinics` rows is executed under the credentials of a Super Admin, THE Database_Layer SHALL return rows for all clinics.
8. THE Database_Layer SHALL define a Super Admin policy set that grants read access to all rows of `clinics`, `clinic_users`, and `audit_logs`, grants read access to per-clinic counts of `clinic_users`, `patients`, `appointments`, and `messages` rows, grants write access to the `clinics.status` column, the `clinics.rejection_reason` column, and the `clinic_users.is_active` column, and grants write access to no other column of any table.
9. IF a read, insert, update, or delete against `patients`, `appointments`, `templates`, or `messages` is executed under the credentials of a Super Admin, THEN THE Database_Layer SHALL return zero rows, persist zero row changes, and reject the operation.
10. THE Platform SHALL make the Supabase service role key, which bypasses RLS, readable only by server-side backend processes and by the Migration_System, and SHALL make the service role key readable by no browser-executed code.
11. THE Authorization_Layer SHALL derive the `clinic_id` used for every database query from the authenticated session's `clinic_id` claim, and SHALL derive it from no request path parameter, query parameter, header, or body field.
12. IF a request supplies a `clinic_id` value that differs from the authenticated session's `clinic_id`, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403 and persist zero row changes.
13. IF an operation against a tenant-scoped table is executed under a session that carries no `clinic_id` claim, including a session established with the Supabase anonymous key and any non-staff session, THEN THE Database_Layer SHALL return zero rows and reject every insert, update, and delete.
14. IF an update executed under the credentials of a staff account sets `clinic_id` to a value other than that staff account's `clinic_id`, THEN THE Database_Layer SHALL reject the update and persist zero row changes.
15. WHERE a scheduled background job executes statements against a tenant-scoped table without an authenticated staff session, THE Platform SHALL scope each statement to one explicit `clinic_id` value and SHALL write no row whose `clinic_id` differs from that value.

### Requirement 3: Staff Authentication

**User Story:** As a staff member, I want to log in with my email and password, so that I can reach the views my role allows.

#### Acceptance Criteria

1. THE Auth_Service SHALL authenticate Super Admin, Clinic Admin, Doctor, and Receptionist accounts using an email address of at most 254 characters matched case-insensitively and a password of 12 to 72 characters.
2. THE Auth_Service SHALL store staff passwords only as hashes produced by Supabase Auth.
3. WHEN a staff member submits an email and password matching a `clinic_users` row whose `is_active` is true, whose clinic `status` is `ACTIVE`, and whose email matches no `platform_admins` row, THE Auth_Service SHALL establish an authenticated session and return the role value held in `clinic_users.role` together with that row's `clinic_id`.
4. IF a staff member submits an email and password that match no staff account, THEN THE Auth_Service SHALL reject the login attempt, establish no session, and return one invalid-credentials message whose wording is identical for a non-existent email address and for an incorrect password.
5. IF a staff member submits credentials for a `clinic_users` account whose `is_active` value is false, THEN THE Auth_Service SHALL reject the login attempt, establish no session, and return a message directing the staff member to contact the Clinic Admin.
6. THE Platform SHALL provide no self-registration path for Super Admin, Doctor, or Receptionist accounts.
7. THE Auth_Service SHALL provide a password reset flow that delivers to the staff account's registered email address a single-use reset link that expires 60 minutes after issue, SHALL require the new password to be 12 to 72 characters, and SHALL reject an expired or already-used reset link with a message directing the staff member to request a new reset link.
8. WHEN a staff member requests a password reset for an email address that matches no staff account, THE Auth_Service SHALL return the same confirmation response as for a matching address.
9. WHEN a staff member completes a password reset, THE Auth_Service SHALL invalidate that reset link and every other outstanding reset link for that account, and SHALL terminate that account's existing sessions.
10. THE Auth_Service SHALL expire an authenticated staff session 12 hours after session establishment and after 60 continuous minutes without an authenticated request, and THE Authorization_Layer SHALL reject any request presenting an expired or terminated session as unauthenticated without returning role or `clinic_id` values.
11. WHEN a staff member submits a logout request, THE Auth_Service SHALL terminate that staff member's session.
12. THE Auth_Service SHALL authenticate no Patient records, and THE Platform SHALL store no password or password hash on the `patients` table.
13. IF five failed credential verifications for one email address occur within any 15-minute window, THEN THE Auth_Service SHALL reject every login attempt for that email address for the following 15 minutes and return a message stating that login attempts are temporarily blocked without indicating whether the email address matches an account.
14. WHEN a staff member submits an email and password matching a `platform_admins` row, THE Auth_Service SHALL establish an authenticated session, return the role Super Admin, and set no `clinic_id` on the session.
15. WHEN an authenticated session's token is refreshed, THE Auth_Service SHALL restart the 60-minute inactivity period and SHALL leave the 12-hour session-age limit unchanged.
16. THE Auth_Service SHALL evaluate the lockout defined in criterion 13 before verifying credentials and before evaluating clinic `status`, SHALL count only credential mismatches as failed attempts, SHALL exclude rejections caused by clinic `status` or by `is_active` being false from the failed-attempt count, and SHALL reset the failed-attempt count for an email address on a successful login or a completed password reset.

### Requirement 4: Clinic Self-Registration

**User Story:** As a clinic owner, I want to register my clinic myself, so that I can request access without contacting the platform owner directly.

#### Acceptance Criteria

1. THE Registration_Service SHALL accept a clinic registration submission containing a clinic name of 2 to 100 characters, a contact email of at most 254 characters, a contact phone, an administrator name of 2 to 100 characters, an administrator email of at most 254 characters, and an administrator password of 12 to 72 characters.
2. WHEN a clinic registration submission passes validation, THE Registration_Service SHALL create one `clinics` row with `status` set to `PENDING_APPROVAL` and `contact_phone` stored in the 11-digit `09` form, including when the submitted clinic name or contact email matches that of an existing `clinics` row.
3. WHEN a clinic registration submission passes validation, THE Registration_Service SHALL create one `clinic_users` row with `role` set to `admin`, `is_active` set to true, and `clinic_id` set to the newly created clinic's `id`.
4. WHEN a clinic registration submission passes validation, THE Registration_Service SHALL set `default_reminder_hours_before` to 24 on the new `clinics` row.
5. IF a clinic registration submission omits, supplies an empty or whitespace-only value for, or supplies a value outside the stated length bounds for clinic name, contact email, contact phone, administrator name, or administrator email, or supplies a contact email or administrator email that does not contain a single `@` separating a non-empty local part from a domain part containing at least one dot, THEN THE Registration_Service SHALL reject the submission, persist no rows, and return a message naming each invalid field.
6. IF a clinic registration submission contains an administrator email that already exists on a `clinic_users` row or a `platform_admins` row, THEN THE Registration_Service SHALL reject the submission and return a message stating that the email address is unavailable.
7. IF a clinic registration submission contains a contact phone that, after removal of spaces and hyphens, matches neither 11 digits beginning with `09` nor `+639` followed by 9 digits, THEN THE Registration_Service SHALL reject the submission, persist no rows, and return a message naming the phone field.
8. IF a clinic registration submission contains an administrator password shorter than 12 characters or longer than 72 characters, THEN THE Registration_Service SHALL reject the submission, create no Supabase Auth user, and return a message stating the permitted length range.
9. IF the creation of the Supabase Auth user, the `clinics` row, or the initial `clinic_users` row fails, THEN THE Registration_Service SHALL roll back the registration so that no Supabase Auth user, no `clinics` row, and no `clinic_users` row originating from that submission persists.
10. WHEN a clinic registration completes, THE Registration_Service SHALL display a confirmation stating that the registration awaits platform owner approval.
11. WHEN a clinic registration completes, THE Registration_Service SHALL send a notification to the Super Admin containing the clinic name, contact email, and contact phone.
12. IF more than 3 clinic registration submissions originate from one source network address within 60 minutes, THEN THE Registration_Service SHALL reject further submissions from that address for 60 minutes, persist no rows, and return a message stating that the submission limit was exceeded.
13. IF a clinic registration submission contains an administrator email that matches a `clinic_users` row whose clinic `status` is `REJECTED`, THEN THE Registration_Service SHALL reject the submission and return a message stating that the email address is unavailable and directing the submitter to contact the platform owner.
14. IF the Super Admin notification for a completed registration fails to send, THEN THE Registration_Service SHALL retain the created Supabase Auth user, `clinics` row, and `clinic_users` row and SHALL still display the registration confirmation.

### Requirement 5: Super Admin Clinic Approval Lifecycle

**User Story:** As the Super Admin, I want to approve, reject, suspend, and reactivate clinics, so that only legitimate clinics can use the platform.

#### Acceptance Criteria

1. THE Approval_Service SHALL present to the Super Admin a list of clinics filterable by any subset of the four `status` values, sorted by `created_at` descending, paginated at a default of 25 clinics per page with a caller-selectable page size of 10 to 100 clinics, showing clinic name, contact email, contact phone, `status`, and `created_at` in Philippine Standard Time for each clinic.
2. WHEN the Super Admin approves a clinic whose `status` is `PENDING_APPROVAL`, THE Approval_Service SHALL set that clinic's `status` to `ACTIVE`.
3. WHERE the Super Admin supplies a rejection reason of at most 500 characters, WHEN the Super Admin rejects a clinic whose `status` is `PENDING_APPROVAL`, THE Approval_Service SHALL set that clinic's `status` to `REJECTED` and store the supplied rejection reason in that clinic's `rejection_reason` column.
4. WHEN the Super Admin suspends a clinic whose `status` is `ACTIVE`, THE Approval_Service SHALL set that clinic's `status` to `SUSPENDED` and terminate the active sessions of that clinic's staff accounts within 5 seconds of the status change.
5. WHEN the Super Admin reactivates a clinic whose `status` is `SUSPENDED`, THE Approval_Service SHALL set that clinic's `status` to `ACTIVE`.
6. WHEN a clinic's `status` changes to `ACTIVE`, THE Approval_Service SHALL send a notification to that clinic's contact email stating that the clinic account is available for login.
7. WHEN a clinic's `status` changes to `REJECTED` or `SUSPENDED`, THE Approval_Service SHALL send one notification to that clinic's contact email stating the new `status` and, where a `rejection_reason` was stored, including that reason.
8. IF the Super Admin submits a status change request that names a clinic identifier matching no `clinics` row, requests a transition that is not one of the transitions defined in criteria 2 through 5, or supplies a rejection reason longer than 500 characters, THEN THE Approval_Service SHALL reject the request, leave every clinic's `status` unchanged, write no `audit_logs` row, send no notification, and return a message naming the failure cause and, for an invalid transition, the clinic's current `status` and the target statuses permitted from that status.
9. IF a status change request is submitted by an authenticated account that is not a Super Admin, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403 and leave the clinic's `status` unchanged.
10. WHEN a clinic's `status` changes to `SUSPENDED` or `REJECTED`, THE Approval_Service SHALL retain all rows belonging to that clinic.
11. IF the Super Admin submits a status change request whose target status equals the clinic's current `status`, THEN THE Approval_Service SHALL leave that clinic's `status` unchanged, write no `audit_logs` row, send no notification, and return a response naming the clinic's current `status`.
12. WHEN two or more status change requests target the same clinic within the same 5-second window, THE Approval_Service SHALL apply exactly one of those requests, evaluate each remaining request against the resulting `status`, and leave exactly one `audit_logs` row for that status change.
13. IF a notification required by criterion 6 or criterion 7 fails to send, THEN THE Approval_Service SHALL retain the new `status` and its `audit_logs` row, retry delivery up to 3 times within 15 minutes, and after the final failed attempt present a delivery-failure indication for that clinic to the Super Admin.

### Requirement 6: Clinic Status Gating of Platform Access

**User Story:** As the platform owner, I want staff of a non-active clinic locked out, so that unapproved and suspended clinics cannot use the platform.

#### Acceptance Criteria

1. WHILE a clinic's `status` is `PENDING_APPROVAL`, IF a submitted email and password match a `clinic_users` row of that clinic whose `is_active` value is true, THEN THE Auth_Service SHALL reject the login attempt, establish no session, return a message stating that the clinic awaits approval, and leave the failed-login count for that email address unchanged.
2. WHILE a clinic's `status` is `REJECTED`, IF a submitted email and password match a `clinic_users` row of that clinic whose `is_active` value is true, THEN THE Auth_Service SHALL reject the login attempt, establish no session, return a message stating that the clinic registration was declined, and leave the failed-login count for that email address unchanged.
3. WHILE a clinic's `status` is `SUSPENDED`, IF a submitted email and password match a `clinic_users` row of that clinic whose `is_active` value is true, THEN THE Auth_Service SHALL reject the login attempt, establish no session, return a message stating that the clinic account is suspended, and leave the failed-login count for that email address unchanged.
4. WHILE a clinic's `status` is a value other than `ACTIVE`, THE Authorization_Layer SHALL reject every authenticated request carrying that clinic's `clinic_id` with HTTP status 403, SHALL apply zero row changes, and SHALL return no clinic-scoped record data in the response body.
5. WHEN a clinic's `status` changes to `ACTIVE`, THE Auth_Service SHALL accept login attempts from that clinic's active staff accounts.
6. THE Authorization_Layer SHALL evaluate the clinic `status` on every authenticated request using either a Database_Layer read or a cached `status` value no older than 30 seconds, so that a change away from `ACTIVE` blocks that clinic's subsequent requests within 30 seconds of the change.
7. WHILE a clinic's `status` is a value other than `ACTIVE`, THE Authorization_Layer SHALL reject a request bearing a session that was established while that clinic's `status` was `ACTIVE` with HTTP status 403 and SHALL terminate that session, without waiting for the session age or inactivity expiry defined in Requirement 3.
8. THE Authorization_Layer SHALL apply no clinic `status` gate to a request from an authenticated Super Admin account, and SHALL permit that account's permitted operations on `clinics`, `clinic_users`, and `audit_logs` for clinics in any `status`.
9. IF the clinic `status` for an authenticated request cannot be resolved from the Database_Layer within 2 seconds, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403, apply zero row changes, and return an error message indicating that authorization could not be completed.

### Requirement 7: Clinic Profile Management

**User Story:** As a Clinic Admin, I want to maintain my clinic's profile and reminder defaults, so that reminders carry the correct sender and lead time when later phases send them.

#### Acceptance Criteria

1. THE Platform SHALL allow a Clinic Admin to read and update the `name`, `contact_email`, `contact_phone`, `default_reminder_hours_before`, and `sender_name` fields of the Clinic Admin's own clinic, SHALL constrain `name` to 2 through 100 characters after leading and trailing whitespace is removed, and SHALL constrain `contact_email` to a single address of at most 254 characters containing exactly one `@` with a non-empty part on each side.
2. THE Platform SHALL constrain `default_reminder_hours_before` to integer values from 1 through 168 inclusive.
3. THE Platform SHALL set `default_reminder_hours_before` to 24 when a clinic record is created.
4. THE Platform SHALL constrain `sender_name` to 1 through 11 characters drawn only from the letters `A` through `Z`, the letters `a` through `z`, and the digits `0` through `9`, with at least one letter, so that the value fits the SMS sender identifier limit.
5. IF a Clinic Admin submits a `default_reminder_hours_before` value that is not a whole number or that falls outside the range of 1 through 168 inclusive, THEN THE Platform SHALL reject the update, leave the stored value unchanged, and return a message stating that the value must be a whole number of hours from 1 through 168.
6. IF a Clinic Admin submits a `sender_name` value that is empty, longer than 11 characters, or contains a character other than a letter or a digit, THEN THE Platform SHALL reject the update, leave the stored value unchanged, and return a message stating the permitted length and permitted character set.
7. IF a Clinic Admin submits a `contact_phone` value that does not match the Philippine mobile number format of 11 digits beginning with `09` or the equivalent `+639` form, THEN THE Platform SHALL reject the update and return a message naming the phone field.
8. IF an account whose role is Doctor or Receptionist submits a clinic profile update, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403.
9. THE Platform SHALL store the clinic profile's `created_at` value with an explicit UTC+8 offset and SHALL render it to a Clinic Admin as its Philippine Standard Time representation regardless of the host's configured timezone.
10. WHEN a Clinic Admin submits a clinic profile update containing a subset of the updatable fields, THE Platform SHALL apply the submitted field values and leave every omitted field unchanged.
11. IF any field value in a clinic profile update fails its constraint, THEN THE Platform SHALL reject the entire update, persist no field from that submission, and return a message naming each rejected field.
12. WHEN a Clinic Admin update that changes `contact_email` is accepted, THE Platform SHALL send a notification to both the former and the new contact email address stating that the clinic contact email address changed.

### Requirement 8: Staff Account Provisioning

**User Story:** As a Clinic Admin, I want to create and deactivate Doctor and Receptionist accounts for my clinic, so that my staff can use the platform without me handling every record.

#### Acceptance Criteria

1. THE Staff_Provisioning_Service SHALL allow a Clinic Admin to create a `clinic_users` row with `role` set to `doctor` or `receptionist`, `clinic_id` set to the Clinic Admin's own `clinic_id`, `name` set to a value of 1 through 100 characters, and `email` set to a syntactically valid email address of at most 254 characters.
2. WHEN a Clinic Admin creates a staff account, THE Staff_Provisioning_Service SHALL set `is_active` to true and SHALL issue, within 60 seconds of the creation, an invitation containing a single-use credential-setting link to the new account's email address.
3. THE Staff_Provisioning_Service SHALL expire an invitation link 72 hours after issue.
4. IF a staff member opens an invitation link that has expired or has already been used, THEN THE Staff_Provisioning_Service SHALL reject the request and display a message directing the staff member to request a new invitation from the Clinic Admin.
5. THE Staff_Provisioning_Service SHALL restrict a Clinic Admin's updates to `clinic_users` rows belonging to the Clinic Admin's own clinic to the `is_active` column, accepting only the values true and false.
6. WHEN a staff account's `is_active` value is set to false, THE Staff_Provisioning_Service SHALL terminate that account's active sessions within 60 seconds and SHALL reject every subsequent authenticated request carrying that account's session with HTTP status 403.
7. WHEN a `clinic_users` row whose `role` is `doctor` has `is_active` set to false, THE Staff_Provisioning_Service SHALL retain that `clinic_users` row, retain all `audit_logs` rows referencing it, and leave the `doctor_user_id` value unchanged on every `appointments` row that references it.
8. WHEN a Clinic Admin sets `is_active` to true on a deactivated `clinic_users` row belonging to the Clinic Admin's own clinic, THE Staff_Provisioning_Service SHALL restore that account's ability to authenticate, and, IF that account has never completed credential setting, SHALL issue a new single-use credential-setting link with a 72-hour expiry to that account's email address.
9. IF a Clinic Admin submits a staff account creation whose email already exists on a `clinic_users` row or a `platform_admins` row, THEN THE Staff_Provisioning_Service SHALL reject the request and return a message stating that the email address is unavailable.
10. IF a Clinic Admin submits a staff account creation or deactivation targeting a `clinic_id` other than the Clinic Admin's own, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403.
11. IF a Clinic Admin submits a request to set `is_active` to false on the Clinic Admin's own account, THEN THE Staff_Provisioning_Service SHALL reject the request and return a message stating that a Clinic Admin cannot deactivate the Clinic Admin's own account.
12. IF an account whose role is Doctor or Receptionist submits a staff account creation, deactivation, or reactivation request, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403.
13. WHEN the Super Admin sets `is_active` to false on any `clinic_users` row, THE Staff_Provisioning_Service SHALL apply the change and terminate that account's active sessions within 60 seconds.
14. IF a request sets `role` to `admin` on a staff account creation, or changes the `role` value of an existing `clinic_users` row, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403, create no `clinic_users` row, alter no existing `clinic_users` row, and send no invitation.
15. WHEN a Clinic Admin requests an invitation resend for a `clinic_users` row in the Clinic Admin's own clinic that has not completed credential setting, THE Staff_Provisioning_Service SHALL issue a new single-use credential-setting link with a 72-hour expiry, invalidate all previously issued links for that account, and reject more than 5 resend requests for the same account within any 60-minute period.
16. IF a deactivation request targets the only `clinic_users` row whose `role` is `admin` and whose `is_active` is true for a clinic whose `status` is `ACTIVE`, THEN THE Staff_Provisioning_Service SHALL reject the request, leave `is_active` unchanged, and return a message stating that a clinic must retain at least one active Clinic Admin.

### Requirement 9: Super Admin Permissions

**User Story:** As the Super Admin, I want platform-wide oversight without access to clinic operational records, so that I can run the platform while staying out of patient data.

#### Acceptance Criteria

1. THE Authorization_Layer SHALL permit a Super Admin to read `clinics` rows for all clinics.
2. THE Authorization_Layer SHALL permit a Super Admin to change the `status` of any clinic according to the transitions defined in Requirement 5.
3. THE Authorization_Layer SHALL permit a Super Admin to read `audit_logs` rows for all clinics, limited to the columns `id`, `clinic_id`, `actor_user_id`, `action`, `target_table`, `target_id`, and `created_at`.
4. THE Authorization_Layer SHALL permit a Super Admin to read, per clinic, the count of `clinic_users` rows, `patients` rows, `appointments` rows, and `messages` rows as non-negative integers, returning 0 where a clinic has no matching rows, and SHALL exclude from the response every row identifier and every column value from `patients`, `appointments`, `templates`, and `messages`.
5. THE Authorization_Layer SHALL permit a Super Admin to set `clinic_users.is_active` to false on any `clinic_users` row, and SHALL reject with HTTP status 403 a Super Admin request to set `clinic_users.is_active` to true.
6. IF a Super Admin submits a read, create, update, or delete request against `patients`, `appointments`, `templates`, or `messages`, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403 and apply zero row changes.
7. IF a Super Admin submits an update to a `clinics` column other than `status` or `rejection_reason`, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403 and leave every `clinics` column value unchanged.
8. THE Platform SHALL create `platform_admins` rows only through the seed routine executed with direct database or service-role credentials, and SHALL expose no authenticated or unauthenticated Platform interface that creates a `platform_admins` row.
9. IF a request submitted by a Super Admin resolves to a response containing any column value from `patients`, `appointments`, `templates`, or `messages`, including values reached through a join, a view, a nested resource, or an expanded relation, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403.
10. THE Authorization_Layer SHALL permit a Super Admin to read `clinic_users` rows for all clinics, limited to the columns `id`, `clinic_id`, `role`, `name`, `email`, `is_active`, and `created_at`.

### Requirement 10: Clinic Admin Permissions

**User Story:** As a Clinic Admin, I want full authority over my own clinic and none over any other clinic, so that my clinic is self-sufficient and other clinics stay private.

#### Acceptance Criteria

1. THE Authorization_Layer SHALL permit a Clinic Admin to read the Clinic Admin's own clinic record and to update only the `name`, `contact_email`, `contact_phone`, `default_reminder_hours_before`, and `sender_name` fields of that record.
2. THE Authorization_Layer SHALL permit a Clinic Admin to create, deactivate, and reactivate Doctor and Receptionist accounts within the Clinic Admin's own clinic.
3. THE Authorization_Layer SHALL permit a Clinic Admin to create, read, update, and delete `templates` rows whose `clinic_id` equals the Clinic Admin's `clinic_id`.
4. THE Authorization_Layer SHALL permit a Clinic Admin read access, and no create, update, or delete access, to `patients`, `appointments`, `messages`, and `clinic_users` rows whose `clinic_id` equals the Clinic Admin's `clinic_id`.
5. THE Authorization_Layer SHALL permit a Clinic Admin to read, for the Clinic Admin's own `clinic_id` only, aggregate counts of `appointments` rows grouped by `status`, aggregate counts of `messages` rows grouped by `status`, and the sum of `messages.cost`.
6. THE Authorization_Layer SHALL permit a Clinic Admin to read `audit_logs` rows whose `clinic_id` equals the Clinic Admin's `clinic_id`.
7. IF a Clinic Admin submits a request that targets a `clinic_id` other than the Clinic Admin's own, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403.
8. IF a Clinic Admin submits a request to change any clinic's `status`, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403.
9. IF a Clinic Admin submits a create, update, or delete request against `patients` or `appointments`, including an update of `appointments.status` to `Completed` or `No-show`, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403 and leave the targeted row unchanged.
10. IF a Clinic Admin submits a create, update, or delete request against `messages`, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403.
11. IF a Clinic Admin submits a staff account creation whose `role` is a value other than `doctor` or `receptionist`, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403 and create no `clinic_users` row.

### Requirement 11: Doctor Permissions

**User Story:** As a Doctor, I want read access to my clinic's schedule plus the ability to record visit outcomes, so that I can see who is coming in without maintaining records.

#### Acceptance Criteria

1. THE Authorization_Layer SHALL permit a Doctor to read `appointments` and `patients` rows whose `clinic_id` equals the Doctor's `clinic_id`.
2. THE Authorization_Layer SHALL permit a Doctor to update `appointments.status` to `Completed` or `No-show` on rows whose `clinic_id` equals the Doctor's `clinic_id`, irrespective of whether `doctor_user_id` equals the Doctor's own account identifier, and only where the row's current `status` is `Scheduled`, `Reminder Sent`, `Confirmed`, or `Reschedule Requested`.
3. IF a Doctor submits an update to `appointments.status` with a value other than `Completed` or `No-show`, THEN THE Platform SHALL reject the update with HTTP status 422, leave the row unchanged, and return a message naming the status values a Doctor is permitted to set.
4. IF a Doctor submits an update to an `appointments` column other than `status`, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403 and leave the row unchanged.
5. IF a Doctor submits a create or delete request against `appointments` or `patients`, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403.
6. IF a Doctor submits an update request against `patients`, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403.
7. IF a Doctor submits a staff account request, a clinic profile update, or a `templates` write request, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403.
8. IF a Doctor submits a request to send a message, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403.
9. IF a Doctor submits a request that targets a `clinic_id` other than the Doctor's own, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403.
10. IF a Doctor submits an update to `appointments.status` on a row whose current `status` is `Completed`, `No-show`, or `Cancelled`, THEN THE Platform SHALL reject the request with HTTP status 422, leave the row unchanged, and return a message naming the row's current status.
11. WHEN a Doctor's update to `appointments.status` is accepted, THE Platform SHALL set that row's `updated_at` to the time of the change and leave `appointment_date`, `appointment_time`, `patient_id`, and `doctor_user_id` unchanged.
12. THE Platform SHALL set `appointments.status` to `No-show` only in response to a request submitted by an authenticated Doctor or Receptionist, and SHALL never set that value from an automated or scheduled process.

### Requirement 12: Receptionist Permissions

**User Story:** As a Receptionist, I want full control of my clinic's patients, appointments, and messages, so that I can run the front desk without a Clinic Admin's involvement.

#### Acceptance Criteria

1. THE Authorization_Layer SHALL permit a Receptionist to create, read, and update `patients` rows whose `clinic_id` equals the Receptionist's `clinic_id`, and SHALL permit a Receptionist to delete such a row only when no `appointments` row, `messages` row, or `audit_logs` row references that patient.
2. THE Authorization_Layer SHALL permit a Receptionist to create, read, and update `appointments` rows whose `clinic_id` equals the Receptionist's `clinic_id`, including setting `status` to any of `Scheduled`, `Confirmed`, `Cancelled`, `Reschedule Requested`, `Completed`, or `No-show`, and SHALL permit a Receptionist to delete such a row only when no `messages` row and no `audit_logs` row references that appointment.
3. THE Authorization_Layer SHALL permit a Receptionist to create outbound `messages` rows whose `clinic_id` equals the Receptionist's `clinic_id`.
4. THE Authorization_Layer SHALL permit a Receptionist to read `messages` rows of both directions whose `clinic_id` equals the Receptionist's `clinic_id`.
5. THE Authorization_Layer SHALL permit a Receptionist to set `review_resolved_at` and `review_resolved_by_user_id` on inbound `messages` rows whose `clinic_id` equals the Receptionist's `clinic_id` and whose `requires_review` value is true.
6. THE Authorization_Layer SHALL permit a Receptionist to read `templates` rows whose `clinic_id` equals the Receptionist's `clinic_id` and to read the `name`, `sender_name`, and `default_reminder_hours_before` fields of the Receptionist's own clinic profile.
7. IF a Receptionist submits a staff account creation, deactivation, or reactivation request, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403.
8. IF a Receptionist submits a clinic profile update, a clinic `status` change, or a request to read `audit_logs` rows, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403.
9. IF a Receptionist submits a create, update, or delete request against `templates`, an update to a `messages` column other than `review_resolved_at` or `review_resolved_by_user_id`, or a delete against a `messages` row, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403.
10. IF a Receptionist submits a request that targets a `clinic_id` other than the Receptionist's own, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403.
11. IF a Receptionist submits a delete against a `patients` or `appointments` row that is referenced by an existing `messages` row or `audit_logs` row, THEN THE Authorization_Layer SHALL reject the request, retain the target row and every referencing row, and return a message indicating that the record has linked message or audit history.
12. IF a Receptionist submits an `appointments` or `messages` create or update in which `patient_id`, `appointment_id`, or `doctor_user_id` references a row whose `clinic_id` differs from the Receptionist's `clinic_id`, THEN THE Authorization_Layer SHALL reject the request with HTTP status 403 and persist no row change.
13. IF a Receptionist submits an `appointments` create or update that sets `status` to `Reminder Sent`, THEN THE Authorization_Layer SHALL reject the request and leave the appointment's `status` unchanged.

### Requirement 13: Audit Logging of Privileged Actions

**User Story:** As the platform owner, I want privileged actions recorded, so that clinic lifecycle and staff account changes are traceable to an actor and a time.

#### Acceptance Criteria

1. WHEN the Super Admin approves, rejects, suspends, or reactivates a clinic, THE Audit_Logger SHALL write one `audit_logs` row containing the acting Super Admin's identifier in `actor_user_id`, the action name `clinic_approved`, `clinic_rejected`, `clinic_suspended`, or `clinic_reactivated` matching the applied transition in `action`, the value `clinics` in `target_table`, the affected clinic identifier in `target_id`, and the event time in `created_at`.
2. WHEN a staff account is created, THE Audit_Logger SHALL write one `audit_logs` row containing the acting account identifier, the action name `staff_account_created`, the value `clinic_users` in `target_table`, and the new account identifier in `target_id`.
3. WHEN a staff account's `is_active` value changes, THE Audit_Logger SHALL write one `audit_logs` row containing the acting account identifier, the action name `staff_account_deactivated` or `staff_account_reactivated`, the value `clinic_users` in `target_table`, and the affected account identifier in `target_id`.
4. WHEN a clinic registration is submitted, THE Audit_Logger SHALL write one `audit_logs` row with the action name `clinic_registered`, the value `clinics` in `target_table`, the new clinic identifier in both `clinic_id` and `target_id`, and the identifier of the initial Clinic Admin `clinic_users` row created by that registration in `actor_user_id`.
5. THE Audit_Logger SHALL record `created_at` as a timestamp carrying an explicit UTC+8 offset.
6. THE Audit_Logger SHALL set `clinic_id` to the affected clinic's identifier for every action in the action vocabulary.
7. THE Database_Layer SHALL define no update policy and no delete policy on `audit_logs` for Super Admin, Clinic Admin, Doctor, or Receptionist credentials, THE Platform SHALL expose no interface that issues an update or a delete against `audit_logs`, and THE Platform SHALL issue no update or delete statement against `audit_logs` through the Supabase service role key outside the Migration_System.
8. IF the write of an `audit_logs` row for a privileged action fails, THEN THE Platform SHALL roll back that privileged action so that neither the action's changes nor the log entry persists, and SHALL return an error response indicating that the action was not applied.
9. THE Platform SHALL exclude passwords, password hashes, and reset tokens from `audit_logs` rows.
10. THE Audit_Logger SHALL set `actor_user_id` to the acting account's `platform_admins` identifier when the acting account is a Super Admin and to the acting account's `clinic_users` identifier when the acting account is a Clinic Admin.

### Requirement 14: Security Baseline

**User Story:** As the platform owner, I want baseline security practices in place from Foundation, so that later phases build on a safe foundation instead of retrofitting one.

#### Acceptance Criteria

1. THE Platform SHALL serve all frontend and backend traffic over HTTPS.
2. WHEN a request arrives over HTTP, THE Platform SHALL redirect the request to the equivalent HTTPS URL.
3. THE Platform SHALL read the Supabase service role key and every other secret from environment variables at runtime.
4. THE Platform SHALL exclude secrets from source control by listing environment files in `.gitignore` and by running an automated secret scan in the continuous integration pipeline that fails the pipeline when a credential pattern is detected in any tracked file.
5. THE Platform SHALL exclude the Supabase service role key from the client-side bundle, and SHALL include in the client-side bundle only the Supabase project URL and the Supabase anonymous key, whose use without an authenticated staff session returns zero rows from every tenant-scoped table.
6. THE Platform SHALL store staff passwords only as Supabase Auth hashes, and SHALL exclude password values and password hashes from API responses and from application logs.
7. THE Platform SHALL validate every request payload against a declared schema before the payload reaches database access code, and SHALL reject a payload that fails validation with HTTP status 400, a message naming each failing field, and zero database writes.
8. WHEN a backend error occurs, THE Platform SHALL return a message that excludes stack traces, SQL statements, and database identifiers.
9. THE Platform SHALL execute all database access through parameterized queries or the Supabase client rather than through string-concatenated SQL.
10. THE Platform SHALL maintain separate Supabase projects and separate environment variable sets for staging and for production.
11. THE Platform SHALL interpret and store all date and time values with an explicit Philippine Standard Time offset rather than relying on the host's default timezone.
12. THE Platform SHALL restrict backend cross-origin access to the exact frontend origins listed in the deployment's allowed-origin configuration, and SHALL permit no wildcard origin.
13. WHEN the Platform returns an HTTPS response, THE Platform SHALL include the response headers `Strict-Transport-Security` with a max-age of at least 15,552,000 seconds, `X-Content-Type-Options` set to `nosniff`, `X-Frame-Options` set to `DENY`, and `Referrer-Policy` set to `no-referrer`.
14. IF a required secret environment variable is absent or empty when a Platform process starts, THEN THE Platform SHALL terminate startup and report a message that names each absent variable and contains no secret value.
15. WHEN the continuous integration pipeline runs, THE Platform SHALL execute a dependency vulnerability scan that fails the pipeline on any dependency finding of high or critical severity.

### Requirement 15: Development Seed Data

**User Story:** As the solo developer, I want one seeded account per staff role, so that I can test role-based behavior without manual setup each time.

#### Acceptance Criteria

1. WHEN the seed routine runs against a database containing none of the seed records, THE Platform SHALL create exactly one `platform_admins` row, one `clinics` row named `Demo Clinic` with `status` set to `ACTIVE`, and three `clinic_users` rows with `role` values `admin`, `doctor`, and `receptionist`, each with `is_active` set to true and `clinic_id` set to the `Demo Clinic` row's `id`, and SHALL set each seeded account's password from the value of that account's designated runtime environment variable.
2. WHEN the seed routine runs against a database containing none of the seed records, THE Platform SHALL create one `clinics` row named `Pending Demo Clinic` with `status` set to `PENDING_APPROVAL` and one `clinic_users` row with `role` set to `admin`, `is_active` set to true, and `clinic_id` set to that clinic's `id`.
3. WHEN the seed routine runs against a database in which a `clinics` row named `Demo Clinic`, `Demo Clinic Two`, or `Pending Demo Clinic` exists, or in which any seeded account email address exists, THE Platform SHALL create zero rows, leave every existing row unchanged, and report success.
4. THE Platform SHALL determine the current environment solely from a runtime environment variable and SHALL execute the seed routine only when that variable's value denotes the local environment or the staging environment.
5. IF the seed routine is invoked while the environment variable denotes production or holds no value, THEN THE Platform SHALL reject the invocation, create or modify zero rows, and return a message naming the detected environment.
6. IF the seed routine is invoked while any designated seeded-account password environment variable is absent, holds a value shorter than 12 characters, or holds a value longer than 72 characters, THEN THE Platform SHALL reject the invocation, create or modify zero rows, and return a message naming each absent or out-of-range variable.
7. WHEN the seed routine runs against a database containing none of the seed records, THE Platform SHALL create one `clinics` row named `Demo Clinic Two` with `status` set to `ACTIVE` and three `clinic_users` rows with `role` values `admin`, `doctor`, and `receptionist` whose `clinic_id` equals that clinic's `id`.
8. IF any step of the seed routine fails, THEN THE Platform SHALL roll back every row that invocation created so that the database retains no partial seed data, and SHALL return a message indicating that seeding did not complete.

## Correctness Properties

These properties state invariants that hold across all inputs. Property 1 is the primary property for this phase.

### Property 1: Tenant Isolation (primary)

For all clinics A and B where A is not B, and for all queries executed under the credentials of a staff account belonging to clinic A, the result set contains zero rows whose `clinic_id` equals clinic B's identifier. For all sessions carrying no `clinic_id` claim, including sessions established with the Supabase anonymous key, every read against a tenant-scoped table returns zero rows and every write is rejected. For all updates executed under clinic A's credentials, no row's `clinic_id` is reassigned to clinic B's identifier.

- Type: Invariant
- Covers: Requirement 2, criteria 1 through 6 and 13 and 14; Requirements 10.7, 11.9, 12.10
- Testing approach: Property-based test generating pairs of clinics with randomized row sets across all tenant-scoped tables, then executing generated read and write operations under each clinic's credentials, under an anonymous-key session, and with generated `clinic_id` reassignment attempts, asserting zero foreign-tenant rows appear and zero foreign-tenant rows change.

### Property 2: Write Scoping

For all inserts and updates executed under the credentials of a staff account belonging to clinic A, every row created or modified has `clinic_id` equal to clinic A's identifier.

- Type: Invariant
- Covers: Requirement 2, criteria 3, 5, 6, 11, 14
- Testing approach: Property-based test submitting generated payloads containing arbitrary `clinic_id` values and asserting the persisted `clinic_id` always equals the session's `clinic_id` or the write is rejected.

### Property 3: Clinic Status Gates Access

For all clinics whose `status` is a value other than `ACTIVE`, every authenticated request carrying that clinic's `clinic_id` is rejected.

- Type: Invariant
- Covers: Requirement 6, all criteria
- Testing approach: Property-based test generating clinics across all four status values and all clinic-scoped roles, asserting access is granted only for the `ACTIVE` status.

### Property 4: Role Permission Matrix Completeness

For every combination of the four staff roles and the defined operations on tenant-scoped tables, exactly one of "permitted" or "rejected" is returned, and the returned outcome matches the matrix defined in Requirements 9 through 12. The matrix includes the Super Admin read denial against `patients`, `appointments`, `templates`, and `messages` — including values reached through joins, views, nested resources, and expanded relations — and the Clinic Admin write denial against `patients`, `appointments`, and `messages`.

- Type: Model-based
- Covers: Requirements 9, 10, 11, 12
- Testing approach: Property-based test enumerating the role and operation cross-product, including read paths that traverse relations, against a table-driven expected-permission model.

### Property 5: Clinic Status Transition Validity

For all sequences of status change requests applied to a clinic, the clinic's `status` follows only the transitions `PENDING_APPROVAL` to `ACTIVE`, `PENDING_APPROVAL` to `REJECTED`, `ACTIVE` to `SUSPENDED`, and `SUSPENDED` to `ACTIVE`.

- Type: Invariant
- Covers: Requirement 5, criteria 2 through 5, 8, 11, and 12
- Testing approach: Property-based test applying randomized status change sequences, including no-op and concurrent requests, and asserting every persisted transition appears in the permitted set.

### Property 6: Audit Log Completeness

For all sequences of privileged actions, the count of `audit_logs` rows created equals the count of privileged actions that succeeded.

- Type: Invariant
- Covers: Requirement 13, criteria 1 through 4 and 8
- Testing approach: Property-based test executing randomized sequences of approvals, rejections, suspensions, and staff account changes, then comparing successful action counts against `audit_logs` row counts.

### Property 7: Registration Atomicity

For all clinic registration submissions, either one `clinics` row and one Clinic Admin `clinic_users` row both exist, or neither exists.

- Type: Invariant
- Covers: Requirement 4, criteria 2, 3, 9
- Testing approach: Property-based test with injected failures at each step of the registration transaction, asserting no partial state persists.

### Property 8: Deactivation Blocks Authentication

For all `clinic_users` rows whose `is_active` value is false, every login attempt with that account's credentials is rejected.

- Type: Invariant
- Covers: Requirement 3, criterion 5; Requirement 8, criteria 5 and 6
- Testing approach: Property-based test generating accounts across roles and activity states, asserting authentication succeeds only when `is_active` is true and the clinic status is `ACTIVE`.

### Property 9: Migration Idempotence

For all migrations, applying the migration twice produces the same schema state and the same migration version registry state as applying the migration once.

- Type: Idempotence
- Covers: Requirement 1, criteria 19, 20, and 23; Requirement 15, criterion 3
- Testing approach: Apply the full migration set twice against a fresh database, then compare the resulting schema dumps and the migration version registry contents.

### Property 10: Timezone Consistency

For all timestamps written by the Platform, the stored value carries an explicit UTC+8 offset, and the value rendered to a clinic user equals the Philippine Standard Time representation of the stored instant regardless of the host's configured timezone.

- Type: Round-trip
- Covers: Requirement 1, criterion 22; Requirement 7, criterion 9; Requirement 13, criterion 5; Requirement 14, criterion 11
- Testing approach: Property-based test writing and reading generated timestamps under several host timezone settings and asserting the rendered Philippine Standard Time value is unchanged.

### Property 11: Terminal Appointment Status Immutability

For all `appointments` rows whose `status` is `Completed`, `No-show`, or `Cancelled`, no Doctor-submitted status update changes any column of that row.

- Type: Invariant
- Covers: Requirement 11, criteria 2, 3, 10, and 11
- Testing approach: Property-based test generating appointments across all seven status values and submitting generated Doctor status updates, asserting rows in a terminal status are byte-identical after the request and that accepted updates change only `status` and `updated_at`.

### Property 12: Referential Retention

For all delete requests against `patients` or `appointments`, either the target row and every referencing `messages` and `audit_logs` row remain, or the target row is removed and no referencing row existed at the time of the request.

- Type: Invariant
- Covers: Requirement 1, criterion 10; Requirement 12, criteria 1, 2, and 11
- Testing approach: Property-based test generating patients and appointments with randomized sets of referencing `messages` and `audit_logs` rows, issuing delete requests, and asserting that no referencing row is ever orphaned or removed.

### Non-Property Criteria

The following criteria are verified by example-based or integration tests rather than property-based tests, because the behavior does not vary meaningfully with input:

- Requirement 1, criteria 1 through 18 and 21 through 25: schema shape is fixed. Verify with schema assertion tests.
- Requirement 3, criteria 7 through 11: password reset and session expiry flows. Verify with integration tests.
- Requirement 4, criteria 10, 11, and 14; Requirement 5, criteria 6, 7, and 13; Requirement 7, criterion 12: notification delivery and delivery-failure handling. Verify with example tests using a mock notification sender.
- Requirement 8, criteria 2, 3, and 15: invitation issue, expiry, and resend. Verify with integration tests.
- Requirement 14, criteria 1 through 3, 5, and 10: deployment and configuration posture. Verify with configuration checks and a bundle inspection test.
- Requirement 14, criteria 12 and 13: cross-origin restriction and security response headers. Verify with configuration checks and a response header assertion test.
- Requirement 14, criteria 4 and 15: secret scanning and dependency vulnerability scanning. Verify with continuous integration pipeline checks that fail the pipeline on a finding.
- Requirement 14, criterion 14: startup secret presence check. Verify with an example test that starts a process with a required variable removed.
- Requirement 15, criteria 1, 2, 4, 5, 6, and 7: seed routine behavior. Verify with example tests.
