---
description: 'Write the booking/revenue ingestion workflow spec for MVP.'
mode: 'agent'
tools: [file_search, apply_patch]
---

# P1 T3: Booking/Revenue Spec

## Context
Read these files first:
- kengs-landing/docs/specs/mvp-workflow-slices.md (workflow context)
- kengs-landing/docs/architecture/schema-draft.md (schema reference)
- kengs-landing/docs/architecture/domain-model.md (entity definitions)

## Write Boundary
- You may edit: docs/specs/booking-revenue-ingest.md
- Do not edit: docs/architecture/schema-draft.md, backend/

## Task
Write a detailed workflow spec for booking/revenue ingestion. Define user flows, data impact, acceptance criteria, and edge cases. Coordinate with schema thread if new fields are needed.

## Acceptance Criteria
- Spec is implementation-ready
- Acceptance criteria are explicit
- Data impact is clear
- All changes reported

## Concurrent Work Awareness
- T1: Schema is being finalized
- T2: Expense import spec is being finalized

## Skills to Consider
- str-feature-spec

## Completion Notes
- Report files changed
- Report blockers or dependency collisions
