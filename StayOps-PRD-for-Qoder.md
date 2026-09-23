# StayOps — Product Requirements Document

**Status:** Build brief for Qoder  
**Date:** 23 September 2026  
**Working name:** StayOps; choose a final name after a separate name and trademark check.  
**Initial deployment:** Leo's apartment, then other small Philippine short-stay operators.  
**Assumption:** The apartment will be offered for nightly or short-term stays. Month-to-month leases, rent billing and tenant accounting are a different product workflow and are out of scope for this release.

## 1. Product definition

StayOps helps a small operator take a direct booking from inquiry to checkout and see the work and money attached to that stay. The first user is an owner with one apartment who currently could manage inquiries in chat and bookings in a spreadsheet. The product must continue to work for several properties, each with multiple rentable units, without redesigning its data model.

**Core promise:** See whether a unit is available, hold it while waiting for a deposit, record payment, prepare the unit for arrival, complete turnover, and understand cash collected and expenses in one place.

**Primary user:** Owner/operator with 1–20 short-stay units in the Philippines.  
**Secondary users:** Cleaner/staff member completing a turnover; guest opening a private booking link without an account.

### Goals

1. Prevent overlapping active reservations and holds for the same unit.
2. Show accurate booking, payment and readiness status at a glance.
3. Let an owner create and share a booking summary in under three minutes.
4. Record manual payments, refundable security deposits, expenses and turnover evidence without presenting guesses as accounting facts.
5. Make a complete booking cycle usable on a phone.

### Explicit exclusions for V1

OTA/channel synchronization, payment gateway and webhooks, public marketplace, self-service instant booking, automated WhatsApp/Messenger/SMS, tax invoice generation or tax advice, pricing optimization, dynamic rates, long-term lease management, guest identity-document collection, smart lock integration, accounting integrations, native apps, and AI features. The guest link is a **private booking-status page**, not a public booking engine.

## 2. Release boundary and delivery order

A release is complete when the owner can run the entire cycle below with one real unit. Deliver in vertical slices, keeping each slice usable:

| Slice | Deliverable | Exit condition |
| --- | --- | --- |
| 0. Foundation | App, authentication, tenant scoping, migrations, basic UI, seed data | Owner can log in and create an organization. |
| 1. Inventory and availability | Property/unit setup, out-of-service blocks, availability query, calendar | Unit availability is correct for a requested interval. |
| 2. Reservations | Guest record, quote/charge snapshot, holds with expiry, confirmations, cancellations, guest status link | A hold can be confirmed or expire; overlap is impossible. |
| 3. Money | Manual payment ledger, proof upload if configured, security-deposit and refund ledger, expenses | Owner can reconcile balance without counting refundable deposits as income. |
| 4. Stay operations | Check-in/out events, turnover checklist, ready state, damage and maintenance record | Owner can determine whether the unit is ready for the next guest. |
| 5. Reports and hardening | Cash and operating summary, permissions, audit events, mobile QA, automated tests | End-to-end acceptance scenarios pass. |

Do not mark the project complete at scaffolding or a static dashboard. If time is limited, finish slices 0–2 and clearly report slices 3–5 as incomplete; never simulate their data or display nonfunctional controls.

## 3. Product rules and workflows

### 3.1 Property and unit setup

- Organization owns properties; property contains one or more independently bookable units.
- Owner can add property name, address (private), IANA timezone (default `Asia/Manila`), check-in/check-out times and house rules.
- Unit has name, capacity, bedroom/bathroom counts, default nightly rate in PHP, optional cleaning fee, optional refundable security deposit, and status: `renovating`, `furnishing`, `ready_to_list`, `active`, `maintenance`, or `inactive`.
- Only `active` units accept new holds or reservations. Existing bookings remain visible if unit status changes; changing status must not silently cancel bookings.
- Renovation expenses can be recorded before activation. Categorize those as capital/startup spending rather than routine operating expenses. This classification is owner-entered, not tax advice.
- An explicit out-of-service date block can prevent bookings during repairs without changing the whole unit lifecycle. The UI must show why dates are blocked.

### 3.2 Availability and calendar

- Owner chooses check-in date and check-out date. Check-out is exclusive: a guest checking out on the 28th does not occupy the night of the 28th. Require check-out > check-in.
- Date-only nights use the property's local timezone. Store timestamps in UTC and render them in the property timezone. Do not calculate stay length by dividing elapsed UTC hours by 24.
- An active hold, confirmed/in-house reservation, or out-of-service block prevents another hold/confirmation for intersecting nights on that unit. A cancelled or expired hold does not.
- Display an understandable month/week calendar on desktop and a date-grouped list on mobile. Show guest name only to authorized staff; the guest page never exposes other bookings.
- Reject an attempted overlapping reservation with a specific conflict message, even if two browser sessions submit simultaneously. A UI availability check is advisory; the database operation is authoritative.

### 3.3 Inquiry → hold → confirmation

- Owner creates a guest with name and at least one contact method (phone or email), selects unit/dates/guest count, then reviews an editable charge breakdown: nightly accommodation, cleaning, other fees/discounts, and refundable security deposit.
- Persist the agreed prices and policy as reservation snapshots; later edits to the unit's default price do not change existing bookings.
- `hold` reserves dates until a fixed `expires_at` timestamp (default 24 hours; owner can choose a shorter duration). Show countdown and required amount on the owner view. Expired holds release dates automatically and cannot be confirmed without rechecking availability.
- Owner may manually confirm a hold after recording a sufficient booking payment, or use an explicit **Confirm without deposit** action requiring a reason. A guest payment-proof upload alone never confirms a booking.
- Owner can make an immediately confirmed reservation through the same availability checks and must explicitly acknowledge an unpaid balance.
- Sending a link is a manual copy/share action in V1. The link presents the guest's dates, total, amount received, amount still due, payment instructions entered by the owner, and current status. Never display full internal notes, other bookings or another guest's details.
- The owner can cancel a hold/reservation with a reason. Cancellation releases inventory; received payments and refund obligations stay in the ledger. Never delete historical financial entries.

**Status model:** `hold`, `confirmed`, `checked_in`, `checked_out`, `cancelled`, `expired`. Store timestamped transitions. A reservation may be `checked_out` while turnover is still pending; do not make a single status field represent both reservation and unit readiness.

### 3.4 Payments and deposits

- V1 uses manual methods: GCash, Maya, bank transfer and cash. Owner records amount, currency PHP, method, date/time received, optional reference and optional evidence. `recorded_by` is retained.
- Guest link may let a guest submit a payment reference and optional screenshot as **unverified evidence** if object storage is configured. Owner must verify and then record the payment. No automatic bank/GCash verification claims.
- Booking balance = accommodation/fees/discount total minus payments allocated to booking charges, adjusted for explicit booking refunds. Security deposit is tracked separately as refundable liability, never included in accommodation revenue or occupancy revenue.
- Owner can record collection of a security deposit, then a refund and/or itemized deduction. Prevent total refunds plus deductions from exceeding collected deposit. A deduction is tied to a damage/incident record or a written reason. Show deposit held and refundable balance.
- Amounts use integer centavos in storage, decimal formatting in the UI. No binary floating-point arithmetic for money. Adjustments are new entries, never silent edits to already recorded entries.
- Each entry has immutable original amount/method/time, actor, and optional correcting reversal. Include a basic activity trail.

### 3.5 Check-in, checkout and turnover

- Owner marks check-in and checkout manually with an event timestamp. No automatic check-in based merely on dates.
- Checkout creates a turnover task for the unit. Checklist defaults: bedsheets, towels, bathroom, kitchen, fridge, rubbish, toiletries, Wi-Fi, aircon, and damage inspection. Owner can edit the template per unit; each task captures a snapshot of the template.
- Staff can complete an assigned task through authenticated staff access. If passwordless task links are implemented instead, make them short-lived, single-task scoped and revocable; do not grant a general organization session through them.
- Task stores completed items, who completed it, timestamps, notes and optional photos. `ready` requires required checklist items completed and an explicit mark-ready action. A damage report may keep the unit unavailable until owner resolves or overrides it with an audited reason.
- Show a warning if the next check-in occurs before the current turnover can be completed. Readiness and availability are separate: a future booked night may exist while the unit is temporarily not ready.

### 3.6 Expenses and owner report

- Expense belongs to a property and optionally a unit. Record amount, paid date, category, description, optional receipt, and classification `operating` or `capital`. Include operating categories such as cleaning, utilities, supplies, maintenance, internet and platform fees.
- Report separates **booked value**, **cash collected**, **refundable deposits held**, **booking refunds**, **operating expenses** and **capital spending**. Label each metric and period basis explicitly. Do not call cash collected or bookings 'profit'.
- For a chosen period, display occupied nights / bookable nights and average accommodation rate per occupied night. Exclude out-of-service nights from bookable-night denominator and explain the formula in the UI.
- A simple net operating cash view may show collected booking payments minus booking refunds minus operating expenses for the selected period, with a note that it is a cash view and excludes refundable deposits and capital spending. Do not imply formal taxable income, ROI or accrual accounting.

## 4. Screens

| Owner screen | Required content/actions |
| --- | --- |
| Setup | Organization, property, unit, policy and payment instructions. |
| Calendar (home) | Date navigation, unit filter, holds/bookings/blocks, quick availability, create reservation. |
| Reservations | Search/filter by guest, unit, dates and status; create and inspect reservation. |
| Reservation detail | Charges, hold expiration, timeline, guest link, payments, deposit, cancellation and stay actions. |
| Guests | Contact details and reservation history within organization. |
| Units | Unit setup, lifecycle, photos (optional), blocks, checklist template. |
| Tasks | Turnover queue, checklist, evidence, ready action. |
| Expenses | Add/filter expenses and receipts. |
| Reports | Period and property filters, cash/operating breakdown and occupancy definitions. |
| Settings | Staff permissions, payment instructions, house rules, audit activity. |
| Guest page | Mobile-first private booking summary and house rules; no login. |

Use plain language in the UI: `Hold`, `Deposit received`, `Balance due`, `Checked out`, `Needs cleaning`, `Ready`. Avoid generic admin-template dashboards or decorative AI copy. Provide empty, loading, error and permission-denied states. Accessible labels, keyboard navigation and sufficient contrast are required.

## 5. Data model (logical)

All tenant-owned records include `organization_id`; most records have `created_at` and `updated_at`. Use UUIDs, explicit foreign keys, and indexed foreign keys/filter columns.

| Entity | Important fields and constraints |
| --- | --- |
| `organizations`, `memberships` | Org identity; user membership and role (`owner`, `staff`). |
| `properties` | Organization, name, address, timezone, arrival/departure policy. |
| `units` | Property, name, capacity, lifecycle status, default rates in centavos. |
| `unit_blocks` | Unit, half-open local date range, reason, creator. |
| `guests` | Organization, name, email/phone; private notes. |
| `reservations` | Organization, unit, guest, check-in/out dates, status, `expires_at`, totals snapshot, created/confirmed/cancelled timestamps, source `direct`. |
| `reservation_charges` | Reservation, type, description, quantity, amount; separately flag refundable deposit requirement. |
| `payment_entries` | Reservation, allocation `booking` or `security_deposit`, amount, method, reference, timestamp, actor, reversal reference. |
| `refund_entries` | Reservation, allocation, amount, timestamp, method, actor, reason. |
| `deposit_deductions` | Reservation, amount, reason, optional damage-report reference. |
| `expenses` | Organization, property/unit, amount, category, classification, paid date, receipt attachment. |
| `tasks`, `task_items` | Unit/reservation, assignee, state, checklist snapshot and completion metadata. |
| `damage_reports` | Unit/reservation, description, photos, estimated/actual amount, status. |
| `attachments` | Organization, object key, purpose, content type, size, uploader, related record; never public bucket URLs. |
| `access_tokens` | Hash of guest-link token, reservation, expiration, revocation and last-used time. |
| `audit_events` | Organization, actor, entity, action, timestamp and safe metadata. |

Protect cross-organization relationships at the service layer and, where practical, with compound database keys/constraints. Store payment and booking ledgers separately from aggregate cached totals. A migration must enforce unique unit/active-date occupancy, or the booking service must serialize creation per unit in a transaction and recheck conflicts under the lock. Prefer both a database exclusion constraint over half-open date ranges for active statuses and transactional state changes. Expire stale holds in the same transaction before availability is committed; a background job alone is insufficient.

## 6. API and architecture expectations

**Suggested stack:** Next.js with TypeScript, PostgreSQL, Drizzle ORM and Better Auth, consistent with Leo's current stack. Use a single deployable web application initially, with server-side domain services; a separate API service is unnecessary for V1. Confirm compatible package versions at implementation time. Use S3-compatible private object storage only when attachments are enabled. A scheduled job handles hold expiry and reminders; expiry is also enforced synchronously during booking operations.

- Authenticated mutations for property, unit, guest, reservation, payment, refund, expense and task operations.
- Read-only guest endpoint/page using an opaque random token, stored only as a hash. Rate limit access. Use a URL without guest name or phone number. Support revoke/rotate.
- Server validates all inputs and derives `organization_id` from authenticated membership, never from a trusted client field.
- All booking state transitions live in explicit domain methods (e.g. `createHold`, `confirmHold`, `expireHold`, `cancelReservation`, `checkOut`, `markUnitReady`), not scattered in UI handlers.
- Use transactions for availability/booking mutations and money ledger writes. Enforce idempotency for repeat payment submissions and other retried mutations.
- Every scheduled job is safe to run twice. Store job results or use idempotent transitions; log failures without exposing sensitive data.

## 7. Coding practices Qoder must follow

1. **Inspect before changing.** If a repository exists, read its README, `AGENTS.md`, package scripts, conventions and current architecture. Follow repository instructions. If none exists, create the project in the current working directory without destructive resets.
2. **Small vertical slices.** For each slice, implement migration + server logic + UI + relevant tests together. Keep the application runnable after each slice. Do not create placeholders presented as shipped features.
3. **Type safety and validation.** TypeScript strict mode; no unexplained `any`; shared schemas for input validation; validate on the server, including dates, prices, permissions and file uploads. Discriminated unions or explicit transition maps for states.
4. **Separation of concerns.** Route handlers/actions handle transport and auth; domain services enforce rules; repositories implement persistence; UI components render state. Avoid giant files and duplicate business rules.
5. **Data integrity first.** Use migrations committed to source control, foreign keys, check constraints, transactions, integer centavos, and a real concurrent-booking guard. Never rely on client-side availability or in-memory locks.
6. **Security and privacy.** Authorize every record lookup by organization and role. No guest data in public logs or URLs; redact payment references and personal details in errors. Private attachments use short-lived signed reads, type/size limits and server-generated keys. Never commit credentials or seed real guest data.
7. **Accessibility and usability.** Responsive forms, meaningful validation errors, date formatting in property timezone, keyboard operability and visible status text alongside colours. Avoid assuming desktop use.
8. **Testing based on risks.** Unit tests for night overlap, status transitions, money totals and expiry; integration tests against PostgreSQL for concurrency, organization isolation and idempotency; one end-to-end scenario for hold → payment → confirm → checkout → turnover. Avoid tests that only copy implementation details.
9. **Operational quality.** Structured logs, actionable server errors, migration/backup instructions, environment example without secrets, health check, and a seed command with clearly fake data. Include commands to run, test, lint and build.
10. **Code review discipline.** Run formatting, lint, typecheck and relevant tests after a slice; fix failures. Document any tradeoffs or incomplete acceptance criteria honestly. Keep functions and components focused, name states and amounts precisely, and favor simple designs over speculative abstractions.

## 8. Acceptance criteria

1. Given one active unit and a confirmed stay Sep 28–30, another booking for Sep 29–Oct 1 fails; a booking starting Sep 30 succeeds.
2. Two concurrent requests for the same open dates result in exactly one committed hold/booking; the other receives a conflict response.
3. A hold that expires at 20:00 cannot be confirmed at 20:01. A fresh booking of those nights succeeds even if the background job has not run.
4. A cancelled reservation releases dates but preserves payments, refunds and its audit history.
5. A booking charge of ₱5,500 with a ₱2,000 refundable security deposit and ₱3,000 booking payment shows **booking balance ₱2,500**. Collecting the deposit changes deposit-held to ₱2,000 without reducing the booking balance or increasing accommodation income.
6. A second identical payment request with the same idempotency key records only one ledger entry.
7. An owner in organization A cannot read or mutate an organization B reservation, including by guessing identifiers or attachment keys.
8. A guest link shows only its reservation and can be revoked. A guest-submitted reference or screenshot stays unverified until the owner acts.
9. Checkout opens a turnover task. Completing required items and marking ready records actor/time; damage requiring attention prevents an unreviewed ready transition.
10. A period report displays booked value, collected cash, deposits held, operating expense, capital spending, and occupancy with clear labels; no refundable deposit appears in accommodation revenue.
11. The primary flows work at 375px viewport width and by keyboard. No dead navigation or fake metrics.

## 9. Open decisions and defaults

These are configurable product choices, not blockers to starting the implementation:

| Question | V1 default |
| --- | --- |
| Rental model | Nightly short stays; one rentable unit may be an apartment. |
| Currency | PHP only; prices entered as pesos and stored in centavos. |
| Timezone | Asia/Manila per property; support other IANA zones in data model. |
| Hold duration | 24 hours, editable per hold; exact expiry timestamp shown. |
| Required booking deposit | Owner specifies amount for each booking; zero allowed with explicit unpaid confirmation. |
| Payment collection | Manual owner verification; no checkout gateway. |
| Guest notifications | Owner copies and sends private link manually. |
| Staff access | Authenticated staff invited by owner; owner-only money/report permissions initially. |
| Attachments | Optional in early slices; enable with private storage before exposing upload controls. |
| Renovation tracking | Capital expense entries and property lifecycle; no contractor/project-management module. |

## 10. Instructions to paste into Qoder

> Build the StayOps V1 described in this PRD in the current repository. First inspect the existing project and summarize its architecture and any repo instructions. Then implement slices 0 through 5 in order, keeping the app runnable and using the coding practices and acceptance criteria here as the definition of done. Begin with schema, auth and a working owner flow for one short-stay apartment. Enforce booking conflicts in PostgreSQL under concurrency, keep refundable deposits separate from booking revenue, and use Asia/Manila date-only night semantics. After each slice, run appropriate checks and report what works, what is incomplete, and how to run it locally. Make reasonable choices where the PRD gives a default. Do not invent payment integrations, tax compliance, or functional UI controls that have not been implemented.
