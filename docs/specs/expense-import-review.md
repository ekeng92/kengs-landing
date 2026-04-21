# Expense Import And Review

<!-- author: AEON Dev | created: 2026-04-19 | last updated: 2026-04-19 -->

## Purpose

Define the first real product workflow for importing financial transactions, surfacing ambiguous expenses, and committing reviewed records into the system of record.

## User Outcome

An STR owner can upload a bank or card export, quickly separate obvious expenses from uncertain ones, and trust that the final records will survive later reporting and tax review.

## Why Now

This is the highest-friction recurring workflow in the current operating model and the clearest opportunity to prove the product is better than spreadsheet cleanup.

---

## State Model

This workflow involves two distinct state layers that must not be conflated.

### Import Row State (`import_rows.review_status`)

Tracks the lifecycle of a staged row before and during promotion.

| State | Meaning |
|---|---|
| `pending` | Row parsed successfully; not yet evaluated for auto-approval |
| `flagged` | Ambiguous or low-confidence; requires user review |
| `approved` | User or auto-approval has cleared this row for promotion |
| `rejected` | User explicitly excluded this row; it will not be promoted |
| `promoted` | Row has been committed into the target entity (`expenses`) |

### Expense Review State (`expenses.review_state`)

Tracks the business classification of a committed expense record for reporting and tax purposes.

| State | Meaning |
|---|---|
| `Business` | Deductible business expense; included in Schedule E reporting |
| `Personal` | Not deductible; promoted for traceability but excluded from business reports |
| `Review` | Classification uncertain; excluded from final reporting until resolved |

**Decision:** `Personal` rows ARE promoted into `expenses` with `review_state: Personal`. They are preserved for full traceability and audit lineage but excluded from all business reporting and tax exports by default.

---

## Workflow

### Trigger

The user selects an expense source file, typically a bank or credit card CSV export.

### Happy Path

1. user uploads a supported source file
2. system stores the raw file and creates an `import_job` with `status: uploaded`
3. system parses source rows into `import_rows` with `raw_payload` preserved
4. system normalizes each row into `normalized_payload` and sets `status: parsed`
5. system evaluates each row against auto-approval rules (see Auto-Approval Rules below)
6. rows meeting strict confidence criteria are set to `review_status: approved`; all others to `flagged`
7. `import_job.status` advances to `flagged` if any rows require review, otherwise `promoted`
8. user reviews flagged rows and applies classification decisions
9. user sets `review_status: approved` or `rejected` on each flagged row
10. system promotes approved rows into committed `expenses`, setting `review_state` from the row's classification decision
11. `import_rows.promoted_entity_id` is set to the new expense id
12. `import_rows.review_status` advances to `promoted`
13. `import_job.status` advances to `promoted` when all rows are resolved
14. dashboard and exports use committed expenses only

### Review Queue Interaction

1. user opens the review queue for a specific import job
2. user filters by property, merchant, category suggestion, or review status
3. for each flagged row, user sets a classification: `Business`, `Personal`, or `Review`
4. user confirms or overrides supporting fields: category, property, description, payment_method, documentation_status
5. user may reject the row entirely if it is not an expense (e.g. a refund or transfer)
6. system records an `audit_event` (event_type: `classified`) for every classification applied to a staged row
7. on promotion, system records an `audit_event` (event_type: `promoted`) referencing both the import row and committed expense

### Post-Promotion Reclassification

1. user revisits a committed expense and changes its `review_state` or category
2. system records an `audit_event` (event_type: `classified`) with `old_values` and `new_values`
3. the expense's `source_import_row_id` remains unchanged as permanent provenance

### Failure Path

1. file cannot be parsed or contains an unsupported structure
2. system marks `import_job.status: failed` and sets `validation_errors` on affected rows
3. rows with validation errors are never promoted and never appear as committed expenses
4. user sees row-level error detail; the import does not affect committed data
5. user may upload a corrected file as a new import job; the failed job remains for audit lineage
6. a file with zero valid parsed rows is treated as a failed import job

### Done State

The import job has a visible status, every row is either promoted, rejected, or flagged-and-held, and committed expenses are available to reporting.

---

## Auto-Approval Rules

Auto-approval applies only when ALL of the following are true. These rules are deterministic and must be documented in `docs/specs/import-parsing-rules.md` before implementation.

- row has a valid `transaction_date` in a recognized date format
- row has a non-zero positive `amount`
- row has a non-empty `merchant_name` after normalization
- `category` can be resolved to a recognized Schedule E category without ambiguity
- `property_id` can be resolved to a single known property (or is explicitly flagged as general overhead)
- `review_state` is inferred as `Business` with high confidence (see parsing rules spec for confidence definition)
- no `validation_errors` are present
- no existing committed expense shares the same `dedupe_key`

If any rule fails, the row is flagged for user review. Auto-approved rows may still be reclassified post-promotion.

**Schema dependency:** if a numeric confidence score is used to drive auto-approval logic, `import_rows` needs a `confidence_score numeric(5,4)` field. Flag for T1 (schema thread) before finalizing auto-approval implementation.

---

## Data Impact

### Tables Touched

| Table | Operation | Notes |
|---|---|---|
| `import_jobs` | INSERT, UPDATE | One record per upload; status advances through lifecycle |
| `import_rows` | INSERT, UPDATE | One record per parsed source row; raw and normalized payloads preserved |
| `expenses` | INSERT, UPDATE | Only promoted approved rows; never populated from import_rows directly |
| `audit_events` | INSERT | On classification and promotion; also on post-promotion reclassification |
| `documents` | INSERT | Source file ALWAYS stored and linked via `related_entity_type: import_job` |

### Raw To Committed Lifecycle

1. raw source file stored to object storage; path recorded in `documents.storage_path`
2. `documents.related_entity_type = 'import_job'`, `documents.related_entity_id = import_job.id`
3. each parsed row inserted into `import_rows` with `raw_payload` capturing exact source content
4. normalized candidate data stored in `import_rows.normalized_payload`
5. on approval, row promoted into `expenses`; `import_rows.promoted_entity_id` set to `expenses.id`
6. `import_rows.promoted_entity_type = 'expense'`

### Field-Level Decisions At Promotion Time

| Field | Source |
|---|---|
| `expenses.transaction_date` | `import_rows.normalized_payload.transaction_date` |
| `expenses.merchant_name` | normalized; user may override during review |
| `expenses.description` | user-provided during review, or normalized fallback |
| `expenses.category` | user-confirmed or auto-resolved Schedule E category |
| `expenses.amount` | normalized; always positive; refunds handled as separate negative records |
| `expenses.payment_method` | user-confirmed during review or inferred from source format |
| `expenses.review_state` | user's classification decision (`Business`, `Personal`, `Review`) |
| `expenses.tax_period` | computed at promotion time from `properties.placed_in_service_date`; `Pre-Service` if transaction_date < placed_in_service_date, else `Operational`; property-null expenses default to `Operational` |
| `expenses.documentation_status` | user-set during review; defaults to `N` if unset |
| `expenses.property_id` | nullable; general overhead expenses may remain property-null; no synthetic property required |
| `expenses.source_import_row_id` | always set on import-originated expenses |

### Deduplication

- `import_rows.dedupe_key` is computed from source-specific fields (e.g., transaction date + amount + merchant + bank reference id if available)
- before promotion, system checks whether an existing committed expense shares the same `dedupe_key`
- if a match exists, the row is flagged with a validation warning and blocked from auto-approval; user must explicitly confirm or reject
- re-uploading the same file creates a new `import_job` but promotion is blocked for rows whose `dedupe_key` already maps to a committed expense
- dedupe key computation rules must be documented in `docs/specs/import-parsing-rules.md` per source type

### Import Job Status Progression

```
uploaded → parsed → flagged (if any rows need review)
                  → promoted (if all rows resolved without review)
         → failed (if file cannot be parsed)
```

A job in `flagged` state advances to `promoted` once all rows are either `promoted` or `rejected`.

### Durable Decisions In This Feature

- import job and import row lifecycle states (as defined above)
- expense `review_state` semantics and values
- promotion boundary: import rows are staging only; committed expenses are the reporting source of truth
- `tax_period` assigned at promotion time, not retroactively
- `Personal` rows promoted for traceability, excluded from business reporting
- source file always retained via `documents` table
- audit events recorded on classification and promotion, not on intermediate staging changes
- deduplication is key-based and deterministic; ML-based matching is out of scope

### Disposable Prototype Choices In This Feature

- queue layout and visual grouping
- exact filter arrangement
- whether review appears as a drawer, page, or split view
- badge styling and sort order defaults

---

## Audit And Traceability

- every import creates an `import_job` with source metadata, original filename, and storage path
- every parsed row remains recoverable through `import_rows.raw_payload` regardless of outcome
- every promotion into `expenses` records `source_import_row_id` as permanent provenance
- every manual reclassification after promotion creates an `audit_event` with `old_values` and `new_values`
- failed and rejected rows remain visible for diagnosis; they do not affect committed data
- the source file is always stored and linked; it is never deleted as part of normal operations

---

## Acceptance Criteria

### Import Lifecycle

- uploading a supported file creates exactly one traceable `import_job` with status `uploaded`
- re-uploading the same file creates a new `import_job`; it does not modify existing committed expenses
- `import_job.status` is always visible to the user and reflects current lifecycle state
- a file with zero parseable rows results in `import_job.status: failed` with no committed expenses created

### Row Processing

- every source row is stored in `import_rows.raw_payload` before any processing occurs
- rows with `validation_errors` never advance to `approved` or `promoted`
- rows that fail parsing are visible in the review queue with their error detail
- auto-approved rows meet ALL auto-approval criteria; partial matches are always flagged

### Review Workflow

- users can classify a flagged row as `Business`, `Personal`, or `Review`
- users can reject a row entirely; rejected rows are preserved in `import_rows` but never promoted
- users can override category, property, description, payment_method, and documentation_status during review
- a classification action on a staged row creates an `audit_event` before promotion occurs
- users can filter the review queue by property, merchant, category suggestion, and review status

### Promotion And Committed Data

- only rows with `review_status: approved` are promoted into `expenses`
- `Personal` rows are promoted into `expenses` with `review_state: Personal` and are excluded from business reporting and tax exports
- `tax_period` is computed at promotion time from the property's `placed_in_service_date`
- promotion is idempotent: re-triggering promotion for a row whose `dedupe_key` already maps to a committed expense does not create a duplicate
- `expenses.source_import_row_id` is always set for import-originated expenses
- dashboard and reporting views use committed `expenses` only; `import_rows` are never the reporting source of truth

### Post-Promotion

- changing a committed expense's `review_state` or `category` creates an `audit_event` with `old_values` and `new_values`
- committed expenses can be filtered by property, category, review_state, tax_period, and documentation_status

### Traceability

- the original source file is always stored and linked to the import job via `documents`
- raw row content is always recoverable through `import_rows.raw_payload`
- the complete import-to-committed lineage is traceable: source file → import_job → import_row → expense → audit_events

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| File has no rows | Import job created with status `failed`; user sees empty row count |
| All rows auto-approved | Import job advances directly to `promoted` without review queue interaction |
| Row amount is zero | Row flagged as invalid; validation error recorded; not auto-approved |
| Row amount is negative | Row flagged for user review; may represent a refund; user must confirm intent |
| Property cannot be resolved | Row flagged; user must assign or leave as general overhead (property-null) |
| Category is ambiguous | Row flagged; user must select from canonical Schedule E categories |
| Duplicate dedupe key on same import | Both rows flagged with a duplicate warning; user must resolve which to keep |
| Duplicate dedupe key against existing expense | Row flagged; blocked from auto-approval; user must explicitly confirm |
| User rejects a row after auto-approval | Auto-approved rows may be rejected before promotion; rejection creates audit event |
| Same file re-uploaded | New import job created; previously promoted rows blocked by dedupe |
| General overhead expense | property_id is null; tax_period defaults to Operational; no property required |
| Pre-service property expense | tax_period set to `Pre-Service` based on placed_in_service_date |

---

## Out Of Scope

- direct bank API integrations
- automatic machine-learned categorization
- accountant collaboration features
- native mobile workflow optimization beyond basic responsiveness
- depreciation or fixed-asset treatment engine
- bulk approve / bulk reject actions (deferred to post-MVP)
- split transactions (one row allocated across multiple categories or properties)

---

## Schema Dependencies (Flag For T1)

The following potential schema gaps were identified during spec finalization. T1 (schema thread) should confirm or reject each before implementation begins.

1. **`import_rows.confidence_score`** — if auto-approval uses a numeric confidence threshold, this field should be added. Current schema does not include it.
2. **`import_rows.dedupe_key` uniqueness scope** — schema has the field but does not define the uniqueness constraint. Recommend unique index on `(import_job_id, dedupe_key)` and a cross-job lookup before promotion.
3. **`expenses.review_state` enum enforcement** — schema lists `Business`, `Personal`, `Review` as text. A database-level check constraint or enum type is recommended.
4. **`import_job.status` enum enforcement** — same as above; `uploaded, parsed, flagged, promoted, failed` should be constrained.

---

## Delivery Notes

Recommended slice order:

1. implement `import_jobs` and `import_rows` tables and lifecycle state machine
2. define parsing contract, normalization rules, and auto-approval criteria for one source type (Chase CSV recommended as first); document in `docs/specs/import-parsing-rules.md`
3. implement source file storage and `documents` link
4. build minimal review queue for flagged rows with classification actions and audit events
5. implement promotion into committed `expenses` with dedupe check and tax_period assignment
6. add post-promotion reclassification and audit event capture
7. connect dashboard and export paths to committed expenses only