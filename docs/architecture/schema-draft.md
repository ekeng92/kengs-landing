# STR Finance Schema Draft

## Purpose

Translate the domain model into an initial relational shape suitable for the first real website.

This is a draft schema, not a migration file. Its job is to stabilize data meaning before implementation details harden.

## Design Goals

- one system of record for committed business data
- clear ownership through workspace and property boundaries
- import staging before promotion into reportable records
- auditability for meaningful user decisions
- spreadsheet compatibility through import and export, not live-state dependence

## Core Tables

### workspaces

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| name | text | workspace display name |
| created_at | timestamptz | creation timestamp |
| updated_at | timestamptz | last modification timestamp |

### workspace_memberships

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| workspace_id | uuid | foreign key to workspaces |
| user_id | uuid | auth user reference |
| role | text | owner, reviewer, accountant per access-control model |
| created_at | timestamptz | membership creation timestamp |
| updated_at | timestamptz | last modification timestamp |

### properties

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| workspace_id | uuid | foreign key to workspaces |
| name | text | human-readable property name |
| code | text | stable short identifier |
| placed_in_service_date | date | drives tax-period classification |
| ownership_type | text | LLC, personal, other |
| market | text | optional market or region label |
| notes | text | optional business notes |
| created_at | timestamptz | creation timestamp |
| updated_at | timestamptz | last modification timestamp |

### bookings

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| workspace_id | uuid | denormalized ownership guardrail |
| property_id | uuid | foreign key to properties |
| source_platform | text | Airbnb, VRBO, direct, other |
| source_confirmation_code | text | nullable but indexed when present |
| guest_name | text | nullable for incomplete imports |
| check_in_date | date | stay start |
| check_out_date | date | stay end |
| nights | integer | derived or imported |
| gross_revenue_amount | numeric(12,2) | before fees |
| cleaning_fee_amount | numeric(12,2) | optional breakout |
| platform_fee_amount | numeric(12,2) | explicit fee field |
| tax_amount | numeric(12,2) | optional breakout |
| net_payout_amount | numeric(12,2) | what actually reaches the owner |
| status | text | draft, committed, voided |
| source_import_row_id | uuid | optional promotion trace |
| created_at | timestamptz | creation timestamp |
| updated_at | timestamptz | last modification timestamp |

### expenses

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| workspace_id | uuid | denormalized ownership guardrail |
| property_id | uuid | nullable for general overhead |
| transaction_date | date | canonical expense date |
| merchant_name | text | vendor or payee |
| description | text | business-purpose description |
| category | text | Schedule E aligned canonical category |
| amount | numeric(12,2) | positive currency amount |
| payment_method | text | card, bank, cash, transfer, other |
| review_state | text | Business, Personal, Review |
| tax_period | text | snapshot at commit time: Pre-Service or Operational |
| documentation_status | text | CC, Y, N |
| needs_receipt_followup | boolean | optional helper for ops |
| status | text | draft, committed, voided — controls reporting eligibility |
| source_import_row_id | uuid | optional promotion trace |
| created_at | timestamptz | creation timestamp |
| updated_at | timestamptz | last modification timestamp |

### mileage_trips

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| workspace_id | uuid | ownership boundary |
| property_id | uuid | foreign key to properties |
| trip_date | date | business trip date |
| origin | text | optional text address or label |
| destination | text | optional text address or label |
| miles | numeric(10,2) | trip miles |
| purpose | text | business purpose |
| deduction_rate | numeric(10,4) | IRS rate snapshot |
| deduction_amount | numeric(12,2) | calculated or stored snapshot |
| created_at | timestamptz | creation timestamp |
| updated_at | timestamptz | last modification timestamp |

### budgets

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| workspace_id | uuid | ownership boundary |
| property_id | uuid | nullable for workspace-wide budget |
| year | integer | budget year |
| category | text | category or metric target |
| amount | numeric(12,2) | annual target |
| created_at | timestamptz | creation timestamp |
| updated_at | timestamptz | last modification timestamp |

### import_jobs

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| workspace_id | uuid | ownership boundary |
| created_by_user_id | uuid | initiating user |
| import_type | text | bank_csv, airbnb_csv, spreadsheet, other |
| original_filename | text | source file name |
| storage_path | text | object storage pointer |
| status | text | uploaded, parsed, flagged, promoted, failed |
| row_count | integer | parsed rows |
| error_count | integer | failed rows |
| metadata | jsonb | source-specific details |
| created_at | timestamptz | creation timestamp |
| updated_at | timestamptz | last modification timestamp |

### import_rows

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| import_job_id | uuid | foreign key to import_jobs |
| row_index | integer | source row position |
| entity_type | text | expense, booking, other |
| raw_payload | jsonb | exact row content as received |
| normalized_payload | jsonb | parsed canonical representation |
| validation_errors | jsonb | array-like error payload |
| review_status | text | pending, flagged, approved, rejected, promoted |
| promoted_entity_type | text | booking or expense when promoted |
| promoted_entity_id | uuid | target entity reference |
| dedupe_key | text | source-specific duplicate protection |
| created_at | timestamptz | creation timestamp |
| updated_at | timestamptz | last modification timestamp |

### documents

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| workspace_id | uuid | ownership boundary |
| property_id | uuid | nullable when workspace-scoped |
| related_entity_type | text | expense, booking, import_job, property |
| related_entity_id | uuid | related record |
| document_type | text | receipt, source_file, export, support |
| storage_path | text | object storage pointer |
| uploaded_by_user_id | uuid | actor |
| created_at | timestamptz | creation timestamp |
| updated_at | timestamptz | last modification timestamp |

### audit_events

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| workspace_id | uuid | ownership boundary |
| actor_user_id | uuid | actor |
| entity_type | text | expense, booking, import_job, property, other |
| entity_id | uuid | related record |
| event_type | text | created, updated, classified, promoted, exported |
| old_values | jsonb | nullable prior state |
| new_values | jsonb | nullable new state |
| metadata | jsonb | contextual detail |
| created_at | timestamptz | event time |

## Important Constraints

- every committed booking and expense belongs to exactly one workspace
- every committed booking belongs to exactly one property
- expenses may be property-specific or workspace-general
- import rows must never be the reporting source of truth after promotion
- review state and tax period use canonical enums only
- import promotion should be idempotent for the same dedupe key and target entity type

## Suggested Indexes

- `properties(workspace_id, code)` unique within workspace
- `workspace_memberships(workspace_id, user_id)` unique pair
- `bookings(property_id, check_in_date)`
- `bookings(workspace_id, check_in_date)` for workspace-scope dashboard queries
- `bookings(source_platform, source_confirmation_code)` partial: where source_confirmation_code is not null
- `expenses(property_id, transaction_date)`
- `expenses(workspace_id, transaction_date)` for workspace-scope dashboard queries
- `expenses(category, review_state)`
- `import_rows(import_job_id, review_status)`
- `import_rows(dedupe_key, promoted_entity_type)` unique partial: where dedupe_key is not null — idempotent promotion guard
- `mileage_trips(property_id, trip_date)`
- `audit_events(workspace_id, entity_type, entity_id, created_at desc)`

## Open Questions

- whether review state should generalize to other imported entity types later — deferred; expenses are the only first-class reviewed entity in MVP
- whether workspace-level expenses should be allocated across properties later — deferred; they remain explicitly unallocated in MVP
- `import_jobs.status` starts at `uploaded` in this schema; the domain model listed `draft` as the first value — resolved as `uploaded` here because it more clearly describes the initial state of an ingestion run

## T2 / T3 Coordination Notes

- T2 (expense import spec): the `expenses.status` field (draft/committed/voided) and `import_rows.dedupe_key` idempotency are the primary schema surface for the import promotion workflow — do not alter these without coordination
- T3 (booking/revenue spec): the `bookings` table is complete for MVP; `source_confirmation_code` is the dedup anchor for Airbnb imports — T3 spec should confirm this is sufficient or raise a schema change request