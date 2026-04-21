---
description: 'Implement booking/revenue ingestion workflow (backend + minimal UI) for MVP.'
mode: 'agent'
tools: [file_search, apply_patch]
---

# P2 T6: Booking Ingestion Implementation

## Context
Read these files first:
- kengs-landing/docs/specs/booking-revenue-ingest.md (finalized spec)
- kengs-landing/docs/architecture/schema-draft.md (locked schema)
- backend/ (scaffolded backend)

## Write Boundary
- You may edit: backend/booking-ingest, frontend/booking-review
- Do not edit: docs/specs/booking-revenue-ingest.md, docs/architecture/schema-draft.md

## Task
Implement the booking/revenue ingestion workflow, including backend logic and minimal UI for review. Ensure deduplication and property association are handled. Report any blockers or schema gaps.

## Acceptance Criteria
- Booking/revenue ingestion workflow is functional
- Deduplication and property association are implemented
- Minimal UI for booking review exists
- All changes reported

## Concurrent Work Awareness
- T4: Backend scaffold is being completed
- T5: Expense import implementation is running in parallel

## Skills to Consider
- airbnb-csv-import
- str-feature-spec

## Completion Notes
- Report files changed
- Report blockers or dependency collisions
