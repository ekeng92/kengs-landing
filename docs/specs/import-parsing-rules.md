# Import Parsing Rules

## Purpose

Define the durable normalization and auto-approval rules for imported source data so the import workflow behaves consistently across files and over time.

## Applies To

- bank CSV imports
- card CSV imports
- Airbnb booking and payout exports
- spreadsheet-based legacy imports

## Core Principle

The parser may normalize aggressively, but it may only auto-approve conservatively.

If a row is missing a durable business meaning, it belongs in review.

## Shared Parsing Pipeline

1. store original file as an import job source document
2. create one `import_row` per source unit
3. preserve source data in `raw_payload`
4. normalize into canonical candidate fields in `normalized_payload`
5. validate required fields
6. determine duplicate risk
7. assign one of three outcomes:
   - auto-approve
   - flag for review
   - fail parsing

## Canonical Candidate Fields

### Expense Candidates

- transaction date
- amount
- merchant name
- original description
- normalized description
- payment method or source account when available
- candidate property
- candidate category
- candidate review state
- candidate tax period
- confidence explanation

### Booking Candidates

- source platform
- confirmation or reservation identifier
- guest name when available
- property
- check-in and check-out dates
- gross revenue
- fees
- taxes
- net payout
- confidence explanation

## Validation Rules

### Hard Failure

An import row fails parsing if any of the following are true:

- required date field cannot be interpreted
- amount is missing or malformed
- the row cannot be identified as a supported entity type
- the file structure does not provide enough data to create a canonical candidate

### Review Trigger

A row must be flagged for review if any of the following are true:

- property assignment is ambiguous
- category assignment depends on non-deterministic guesswork
- duplicate confidence is uncertain
- date or amount parses but conflicts with expected source structure
- tax period cannot be derived confidently
- the row looks like mixed personal or shared spending

## Auto-Approval Rule

An expense row may be auto-approved only if all of the following are true:

- the row parsed successfully
- duplicate protection indicates the row is new
- merchant normalization succeeded
- category mapping comes from an explicit deterministic rule
- property resolution is confident
- tax period is derived confidently
- no field requires human judgment to preserve business meaning

If any one of these conditions is missing, the row must go to review.

## Initial Source Rules

### Bank And Card CSV

For the first production workflow, these are the primary expense sources.

Required source signals:

- posted or transaction date
- amount
- merchant or description text

Normalization behavior:

- preserve exact source description in `raw_payload`
- normalize merchant casing and trivial noise in `normalized_payload`
- preserve signed meaning so refunds and charges can be distinguished

### Airbnb CSV

Airbnb imports may create booking candidates and payout-related rows.

Rules:

- booking identity should prefer Airbnb reservation identifiers when present
- payout-related financial lines must not silently become expense candidates unless the row type clearly maps to a canonical business meaning
- platform fees should remain distinct from gross revenue and net payout

### Spreadsheet Legacy Import

Spreadsheet imports are compatibility flows, not the canonical data model.

Rules:

- preserve imported source markers so legacy migrations remain auditable
- any field that cannot be mapped directly to the canonical model must be flagged rather than silently dropped

## Category Mapping Rule

Category mapping must use the canonical Schedule E aligned taxonomy already defined by the finance workflow.

The first supported categories are:

- Mortgage interest
- Property taxes
- Insurance
- Repairs & maintenance
- Supplies
- Utilities
- Cleaning & turnover
- Platform fees
- Professional services
- Advertising
- Travel
- Depreciation
- HOA / management fees
- Other

## Property Resolution Rule

Property assignment may come from:

- source-specific property identifier
- deterministic merchant or account mapping
- explicit user selection during import

If the parser cannot determine property confidently, the row stays in review.

## Duplicate Protection Rule

Duplicate protection must exist before auto-approval.

For expense candidates, the first-pass dedupe key should use a stable combination of:

- source type
- transaction date
- amount
- merchant normalization
- source row identifier when available

For booking candidates, dedupe should prefer platform reservation identifiers and only fall back to composite keys when those are missing.

## Confidence Handling

Every normalized row should carry an explanation of why it was auto-approved or sent to review.

This explanation is for auditability and user trust, not just debugging.

## Out Of Scope

- machine-learned classification
- direct bank API integrations
- probabilistic auto-approval without explicit reviewable rules