# Expense Import And Review

## Purpose

Define the first real product workflow for importing financial transactions, surfacing ambiguous expenses, and committing reviewed records into the system of record.

## User Outcome

An STR owner can upload a bank or card export, quickly separate obvious expenses from uncertain ones, and trust that the final records will survive later reporting and tax review.

## Why Now

This is the highest-friction recurring workflow in the current operating model and the clearest opportunity to prove the product is better than spreadsheet cleanup.

## Workflow

### Trigger

The user selects an expense source file, typically a bank or credit card CSV export.

### Happy Path

1. user uploads a supported source file
2. system creates an `import_job`
3. system parses source rows into `import_rows`
4. system normalizes rows into candidate expense payloads
5. system auto-approves rows that meet strict confidence rules
6. system flags ambiguous rows for review
7. user reviews flagged rows and applies classification decisions
8. system promotes approved rows into committed `expenses`
9. dashboard and exports use committed expenses only

### Review Path

1. user opens the review queue for a specific import job
2. user filters by property, merchant, category suggestion, or review status
3. user marks each row as `Business`, `Personal`, or `Review`
4. user confirms supporting fields such as category, property, and description
5. system records an audit event for each committed classification change

### Failure Path

1. file cannot be parsed or contains unsupported structure
2. system marks the import job as failed or flagged
3. user sees row-level issues and the import does not affect committed expenses
4. user can retry with a corrected file without contaminating reporting data

### Done State

The import job has a visible status, ambiguous rows are either resolved or intentionally left in review, and committed expenses become reportable.

## Data Impact

### Tables Touched

- `import_jobs`
- `import_rows`
- `expenses`
- `audit_events`
- `documents` if the original source file is retained in object storage

### Raw To Committed Lifecycle

1. raw source file stored and linked to `import_job`
2. raw row copied into `import_rows.raw_payload`
3. normalized candidate data stored in `import_rows.normalized_payload`
4. approved row promoted into `expenses`
5. `import_rows.promoted_entity_id` references the committed expense

### Durable Decisions In This Feature

- import-job lifecycle states
- expense review-state semantics
- promotion boundary between staged data and committed reporting data
- audit behavior for classification decisions
- deterministic auto-approval rules are defined in `docs/specs/import-parsing-rules.md`

### Disposable Prototype Choices In This Feature

- queue layout and visual grouping
- exact filter arrangement
- whether review appears as a drawer, page, or split view

## Audit And Traceability

- every import creates an `import_job` with source metadata
- every parsed row remains recoverable through `import_rows`
- every promotion into `expenses` records provenance back to the import row
- every manual reclassification after promotion creates an `audit_event`
- failed rows remain visible for diagnosis and retry

## Acceptance Criteria

- uploading a supported file creates one traceable import job
- rows that fail parsing or validation never appear as committed expenses
- ambiguous rows remain outside final reporting until explicitly approved
- users can classify a row as `Business`, `Personal`, or `Review`
- committed expenses can be filtered by property, category, review state, and tax period
- changing a committed expense classification creates a visible audit event
- re-importing the same file or duplicate row set does not create duplicate committed expenses
- the source file and row lineage remain available for later review

## Out Of Scope

- direct bank API integrations
- automatic machine-learned categorization
- accountant collaboration features
- native mobile workflow optimization beyond basic responsiveness
- depreciation or fixed-asset treatment engine

## Open Questions

- whether `Personal` items should remain in the same table for traceability or be excluded from most reports by default
- whether general overhead expenses must choose a synthetic `General` property or may remain property-null
- how aggressively the first version should support bulk actions versus row-by-row review

## Delivery Notes

Recommended slice order:

1. implement `import_jobs` and `import_rows`
2. define parsing contract and normalization rules for one source type
3. build a minimal review queue for flagged rows
4. implement promotion into committed `expenses`
5. add audit events for post-promotion changes
6. connect dashboard and export paths to committed expenses only