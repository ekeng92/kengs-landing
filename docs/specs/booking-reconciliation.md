# Booking Reconciliation

## Purpose

Define how the product identifies, deduplicates, enriches, and corrects booking records so revenue data remains trustworthy across imports and manual edits.

## Core Principle

A single stay should become a single canonical booking record.

Imports may add information to that record, but they should not create duplicate business truth just because a stay appears in more than one source or more than one file.

## Canonical Booking Identity

### Primary Identity

When available, the booking's platform reservation or confirmation identifier is the primary identity key.

### Fallback Identity

If a platform identifier is missing, fallback matching may use a composite of:

- property
- check-in date
- check-out date
- guest name when available
- gross revenue or payout signals when available

Fallback matching is review-sensitive and must not auto-merge when ambiguity remains.

## Reconciliation Outcomes

Each candidate booking row must resolve to one of the following outcomes:

- create a new canonical booking
- enrich an existing canonical booking
- flag for review because the match is ambiguous
- reject because the row is invalid or unsupported

## Enrichment Rules

A new import may enrich an existing booking when:

- the canonical identity key matches confidently
- the new data adds missing fields
- the new data refines a previously incomplete record without changing its business identity

Examples of safe enrichment:

- adding guest name to an existing booking with the same platform identifier
- adding fee breakdowns to a booking that previously only had net payout
- updating a draft or partial booking to a more complete committed record from the same source identity

## Conflict Rules

If a new row conflicts with an existing booking on a durable field, the system must not silently overwrite the record.

Durable conflict fields include:

- property
- check-in date
- check-out date
- gross revenue
- net payout when already committed from a trusted source

Conflicting rows should be flagged for review with explicit side-by-side comparison.

## Source Precedence

Initial precedence should follow this order:

1. direct platform booking export with reservation identifier
2. canonical previously committed booking record
3. manually entered draft or legacy-imported booking

This is a reconciliation aid, not a license to silently rewrite committed records.

## Duplicate Protection Rules

- the same import file run twice must not create duplicate committed bookings
- the same reservation appearing in multiple imports should enrich or flag, not duplicate
- duplicate protection must be evaluated before promotion into committed `bookings`

## Review Triggers

A booking candidate must be flagged for review if:

- reservation identifier is missing and fallback matching finds more than one plausible target
- gross revenue, fee, or payout values conflict materially with an existing committed booking
- property resolution is uncertain
- the candidate appears to represent a cancellation, modification, or correction rather than a clean new booking

## Cancellation And Change Handling

- cancellations and major booking changes must remain auditable
- the system should prefer status transitions or correction events over deleting historical booking truth
- a corrected booking should preserve provenance to the original import row and prior state

## Out Of Scope

- channel manager integrations
- calendar sync features
- guest messaging
- pricing optimization logic