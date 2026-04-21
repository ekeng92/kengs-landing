---
description: 'Lock schema and write initial migration scripts for MVP STR finance product.'
mode: 'agent'
tools: [file_search, apply_patch]
---

# P1 T1: Schema & Migration Lock

## Context
Read these files first:
- kengs-landing/docs/architecture/schema-draft.md (schema draft)
- kengs-landing/docs/architecture/domain-model.md (entity definitions)
- kengs-landing/docs/specs/mvp-workflow-slices.md (workflow context)

## Write Boundary
- You may edit: docs/architecture/schema-draft.md, backend/db/migrations/
- Do not edit: docs/specs/*, backend/other features

## Task
Finalize the MVP schema for all core entities and write initial migration scripts. Ensure all workflow-critical fields are present. Document any open schema questions in the plan file.

## Acceptance Criteria
- Schema draft is complete for MVP
- Migration scripts exist for all tables
- No entity or field duplication
- All changes reported

## Concurrent Work Awareness
- T2: Expense import spec is being finalized
- T3: Booking/revenue spec is being written

## Skills to Consider
- None required

## Completion Notes
- Report files changed
- Report blockers or dependency collisions
