---
description: 'Scaffold backend and implement schema/migrations for MVP.'
mode: 'agent'
tools: [file_search, apply_patch]
---

# P2 T4: Backend Scaffold

## Context
Read these files first:
- kengs-landing/docs/architecture/schema-draft.md (locked schema)
- kengs-landing/docs/architecture/domain-model.md (entity definitions)
- kengs-landing/docs/specs/mvp-workflow-slices.md (workflow context)

## Write Boundary
- You may edit: backend/ (new), db/
- Do not edit: docs/specs/*, docs/architecture/schema-draft.md

## Task
Scaffold the backend project, implement the locked schema, and set up initial migrations. Ensure all tables and relationships are present. Report any schema ambiguities or blockers.

## Acceptance Criteria
- Backend project structure exists
- Schema and migrations match locked draft
- All changes reported

## Concurrent Work Awareness
- T5: Expense import implementation will consume this backend
- T6: Booking ingestion implementation will consume this backend

## Skills to Consider
- None required

## Completion Notes
- Report files changed
- Report blockers or dependency collisions
