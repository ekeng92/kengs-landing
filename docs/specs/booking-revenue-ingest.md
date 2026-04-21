# Booking and Revenue Ingestion — Workflow Spec

<!-- author: AEON Dev | created: 2026-04-19 | last updated: 2026-04-19 -->

## Purpose

Define the complete ingestion workflow for booking and revenue data — from file upload through committed booking records — so implementation can proceed without ambiguity.

This spec covers Slice 2 from `mvp-workflow-slices.md`. It coordinates with:
- **T1 (schema)**: `docs/architecture/schema-draft.md` — all field and table references are schema-aligned
- **T2 (expense import)**: `docs/specs/expense-import-review.md` — shared import job/import row lifecycle; do not duplicate that logic here

---

## Scope

**In scope:**
- Airbnb CSV upload and parsing
- Manual booking entry
- Deduplication against existing bookings
- Edge-case review flow
- Commit to reportable booking records

**Out of scope:**
- VRBO and direct booking ingestion (deferred; interface is compatible)
- Booking edits after commit (tracked changes, separate spec)
- Revenue allocation / Schedule E calculations
- Payout reconciliation against bank transactions

---

## User Flows

### Flow 1: Airbnb CSV Upload

**Precondition**: User is authenticated, has at least one property in their workspace.

1. User navigates to Import.
2. User selects import type **Airbnb CSV** and uploads a file.
3. System creates an `import_job` with status `uploaded` and stores the file.
4. System parses rows into `import_row` records with `entity_type = booking`.
5. Each row is normalized into canonical booking fields (see Normalization Rules below).
6. Deduplication runs against existing committed `bookings` (see Dedup Rules below).
7. System sets `import_job.status = parsed` (or `flagged` if any rows require review).
8. User sees a staging summary: total rows, auto-promotable, flagged, rejected.
9. User reviews flagged rows (see Review Flow below).
10. User triggers **Commit** — approved rows are promoted to `bookings` with `status = committed`.
11. System records `audit_events` for each promoted booking.
12. `import_job.status` advances to `promoted`.

**Terminal state per row**: `promoted`, `rejected`, or left as `pending` for a future session.

---

### Flow 2: Manual Booking Entry

**Precondition**: User is authenticated and has at least one property.

1. User navigates to Bookings and selects **Add Booking**.
2. User fills in required fields: property, check-in date, check-out date, net payout.
3. User optionally fills: guest name, platform, gross revenue, cleaning fee, platform fee, tax.
4. System validates required fields (see Validation Rules below).
5. On save, system creates a `booking` with `status = committed` directly (no import job needed).
6. System records an `audit_event` with `event_type = created`.

---

### Flow 3: Flagged Row Review

**Trigger**: After parsing, one or more rows have `review_status = flagged`.

1. User sees a review queue showing only flagged rows.
2. Each row displays: raw source values, normalized candidate values, flag reason.
3. User may:
   - **Approve** — confirms the normalized values; row is eligible for commit.
   - **Edit and approve** — corrects a field value, then approves.
   - **Reject** — explicitly discards the row; it will not be promoted.
   - **Defer** — leaves row in flagged state; job remains in `flagged` status.
4. Once all flagged rows are resolved, the user may proceed to Commit.

---

## Normalization Rules

These rules translate raw Airbnb CSV columns into canonical `import_row.normalized_payload` fields.

| Canonical Field | Source Mapping | Notes |
|---|---|---|
| `property_id` | User-selected at import time | Required; cannot be inferred from Airbnb CSV |
| `source_platform` | Hard-coded `airbnb` | Set by import type selection |
| `source_confirmation_code` | `Confirmation Code` column | Required for dedup; flag if missing |
| `guest_name` | `Guest Name` column | Optional; null is acceptable |
| `check_in_date` | `Start Date` column | Parse as `YYYY-MM-DD`; reject if unparseable |
| `check_out_date` | `End Date` column | Parse as `YYYY-MM-DD`; reject if unparseable |
| `nights` | `Nights` column or derived from dates | Prefer explicit; derive only if missing |
| `gross_revenue_amount` | `Gross Earnings` column | Numeric; strip currency symbols |
| `cleaning_fee_amount` | `Cleaning Fee` column | Optional; null if absent |
| `platform_fee_amount` | `Host Service Fee` column | Optional; null if absent |
| `tax_amount` | `Taxes` column | Optional; null if absent |
| `net_payout_amount` | `Amount` column | Required; reject if missing or zero |

**Date parsing**: Accept `MM/DD/YYYY`, `YYYY-MM-DD`, and `M/D/YYYY`. Reject unrecognized formats and flag the row.

**Currency parsing**: Strip `$`, `,`, and whitespace. Treat parentheses as negative. Reject non-numeric remainders.

---

## Deduplication Rules

Before a parsed row can be auto-promoted, dedup runs against existing committed bookings.

**Primary key**: `source_platform + source_confirmation_code` — unique within a workspace.

**Outcomes**:

| Condition | Result |
|---|---|
| No match found | Row is eligible for auto-promotion as a new booking |
| Exact match found, no field conflicts | Row is treated as a duplicate — mark `review_status = rejected` with reason `duplicate_exact` |
| Match found, new row adds missing fields | Enrich the existing booking (see enrichment spec in `booking-reconciliation.md`) |
| Match found, field conflict on durable field | Flag row with reason `duplicate_conflict` for user review |
| Confirmation code absent | Run fallback dedup: property + check-in + check-out + guest name; flag all candidate matches |

**Idempotency**: Promoting the same `dedupe_key` twice into the same workspace must be a no-op after the first commit. The `dedupe_key` on `import_rows` is `{source_platform}:{source_confirmation_code}:{property_id}`.

---

## Validation Rules

### Row-Level Validation (blocking — row rejected if fails)

- `check_in_date` must be a valid date
- `check_out_date` must be a valid date and after `check_in_date`
- `net_payout_amount` must be a non-null numeric value
- `property_id` must resolve to a property in the user's workspace

### Row-Level Validation (soft — row flagged, not rejected)

- `source_confirmation_code` is absent
- `gross_revenue_amount` is absent or zero
- `nights` does not match the difference between check-in and check-out (tolerance: 0)
- `net_payout_amount` is negative (valid for adjustments, but needs review)
- `check_in_date` is more than 3 years in the past (stale data risk)
- `check_in_date` is more than 180 days in the future (likely placeholder)

### Manual Entry Validation (blocking)

- property, check-in date, check-out date, net payout are all required
- check-out must be after check-in

---

## Data Impact

### Tables Written

| Table | Operation | Condition |
|---|---|---|
| `import_jobs` | INSERT | On upload |
| `import_jobs` | UPDATE (status) | On parse, flag, promote |
| `import_rows` | INSERT (batch) | On parse |
| `import_rows` | UPDATE (review_status, promoted_entity_id) | On review and promote |
| `bookings` | INSERT | On new booking commit |
| `bookings` | UPDATE (enrichment fields) | On enrich of existing booking |
| `audit_events` | INSERT | On commit, edit, reject |
| `documents` | INSERT | On file storage |

### Tables Read

- `bookings` — deduplication lookup
- `properties` — validation of property ownership
- `workspace_memberships` — authorization check

### Fields Not Written by This Flow

- `expenses.*` — this flow never touches expenses
- `bookings.status = voided` — voiding is a separate action, not part of import
- `mileage_trips` — not in scope

---

## Acceptance Criteria

### Import Job Lifecycle

- [ ] Uploading a file creates an `import_job` with `status = uploaded` and a `documents` record pointing to the stored file
- [ ] A failed parse (malformed file) sets `import_job.status = failed` and surfaces a user-readable error
- [ ] Import job rows are traceable: each `booking` promoted from an import has `source_import_row_id` set

### Booking Promotion

- [ ] A clean Airbnb CSV with 10 rows and no duplicates creates exactly 10 `bookings` with `status = committed`
- [ ] Re-uploading the same CSV creates 0 new bookings (idempotent)
- [ ] Uploading a CSV with 1 duplicate and 9 new rows creates exactly 9 new bookings and flags 1 as duplicate
- [ ] A booking promoted from import has `source_platform`, `source_confirmation_code`, `gross_revenue_amount`, `net_payout_amount`, `check_in_date`, `check_out_date`, and `property_id` populated

### Revenue Integrity

- [ ] Gross revenue, cleaning fee, platform fee, tax, and net payout are stored as separate fields — never combined into one
- [ ] `net_payout_amount` is never derived from other amounts; it is always stored from source or user input
- [ ] A booking with only net payout (no gross/fee breakout) is valid and committable

### Review Flow

- [ ] A flagged row shows the flag reason in the review queue
- [ ] An approved-and-edited row commits with the edited values, not the raw source values
- [ ] A rejected row is never promoted; it remains in `import_rows` with `review_status = rejected`
- [ ] Committing after all flags are resolved advances `import_job.status = promoted`

### Property Association

- [ ] Every committed booking has exactly one `property_id`
- [ ] Attempting to commit a row with no property resolves to a validation error
- [ ] Property selection UI shows only properties in the user's workspace

### Audit Trail

- [ ] Promoting a booking creates an `audit_event` with `event_type = created` and `entity_type = booking`
- [ ] Editing a field during review and then committing records the edited values in `new_values`, not the raw source

### Manual Entry

- [ ] A manually entered booking is committed immediately with `status = committed`
- [ ] Manual bookings have `source_import_row_id = null`

---

## Edge Cases

| Scenario | Expected Behavior |
|---|---|
| CSV file is empty (header only) | Import job created with `row_count = 0`; user sees "No rows found" message; job status = `failed` |
| CSV column headers differ from expected (e.g., localized Airbnb export) | Parser flags all rows; surface unrecognized header warning at job level |
| Same confirmation code, two different properties | Treated as two distinct bookings (property is part of dedupe key) |
| Booking with check-in == check-out | Rejected as invalid (zero-night stay) |
| Net payout is negative (adjustment/refund row) | Flagged for review; valid to commit after confirmation |
| CSV includes non-booking rows (payout summaries, etc.) | Non-booking rows are parsed as `entity_type = other`, not promoted, logged for awareness |
| Import interrupted mid-commit | Already-promoted rows keep their `booking` records; unpromoted rows retain `review_status = approved` and can be re-committed |
| User uploads Airbnb CSV to wrong property | No system prevention possible pre-commit; dedup based on confirmation code may surface cross-property conflicts if re-imported correctly |
| Guest name contains Unicode or special characters | Stored as-is; no normalization beyond trimming whitespace |
| Airbnb CSV from a co-host account includes bookings for multiple properties | All rows map to the same selected property; user must run separate imports per property or accept a multi-property disambiguation UI (deferred) |

---

## Schema Dependency Flags

These schema fields are confirmed as-is in `schema-draft.md` and this spec aligns to them:

- `bookings.source_confirmation_code` — nullable, indexed: confirmed
- `bookings.status` enum (`draft`, `committed`, `voided`): confirmed
- `import_rows.dedupe_key`: confirmed
- `import_rows.promoted_entity_type` and `promoted_entity_id`: confirmed
- `import_rows.review_status` enum (`pending`, `flagged`, `approved`, `rejected`, `promoted`): confirmed

**No new schema fields are required by this spec.** If the schema thread modifies field names or enum values before this spec is implemented, update the Normalization Rules table and Dedup Rules section first.

---

## Dependencies and Coordination Notes

- **T1 (schema)**: No schema additions required. If T1 changes the `bookings` table structure before implementation, re-validate the Normalization Rules table.
- **T2 (expense import)**: Import job and import row lifecycle is shared. Do not re-spec that lifecycle here — reference `expense-import-review.md` for the definitive import job state machine. Booking import uses the same state machine.
- **`booking-reconciliation.md`**: Defines enrichment and conflict resolution in detail. This spec delegates to that document for enrichment logic.

---

## Out of Scope (Explicitly Deferred)

- VRBO CSV format support
- Direct booking manual import (non-platform stays)
- Automated payout matching against bank transactions
- AI-assisted duplicate detection beyond confirmation code + composite fallback
- Multi-property disambiguation during a single import job
