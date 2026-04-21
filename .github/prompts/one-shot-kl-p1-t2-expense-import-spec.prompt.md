---
description: 'Finalize and clarify the expense import/review workflow spec for MVP.'
mode: 'agent'
tools: [file_search, apply_patch]
---

# P1 T2: Expense Import Spec Finalize

## Context
Read these files first:
- kengs-landing/docs/specs/expense-import-review.md (current spec)
- kengs-landing/docs/architecture/schema-draft.md (schema reference)
- kengs-landing/docs/specs/mvp-workflow-slices.md (workflow context)

## Write Boundary
- You may edit: docs/specs/expense-import-review.md
- Do not edit: docs/architecture/schema-draft.md, backend/

## Task
Clarify and complete the expense import/review workflow spec. Add missing acceptance criteria, edge cases, and clarify data impact. Coordinate with schema thread if new fields are needed.

## Acceptance Criteria
- Spec is implementation-ready
- Acceptance criteria are explicit
- Data impact is clear
- All changes reported

## Concurrent Work Awareness
- T1: Schema is being finalized
- T3: Booking/revenue spec is being written

## Skills to Consider
- str-feature-spec

## Completion Notes
- Report files changed
- Report blockers or dependency collisions
