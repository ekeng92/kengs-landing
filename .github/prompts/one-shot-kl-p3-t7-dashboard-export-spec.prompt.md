---
description: 'Write dashboard and export workflow spec for MVP.'
mode: 'agent'
tools: [file_search, apply_patch]
---

# P3 T7: Dashboard & Export Spec

## Context
Read these files first:
- kengs-landing/docs/specs/mvp-workflow-slices.md (workflow context)
- backend/expense-import, backend/booking-ingest (implemented workflows)
- kengs-landing/docs/architecture/schema-draft.md (locked schema)

## Write Boundary
- You may edit: docs/specs/dashboard-export.md
- Do not edit: backend/, docs/architecture/schema-draft.md

## Task
Write a detailed workflow spec for the property dashboard and export features. Define user flows, data impact, acceptance criteria, and edge cases. Reference actual data shapes from implemented workflows.

## Acceptance Criteria
- Spec is implementation-ready
- Acceptance criteria are explicit
- Data impact is clear
- All changes reported

## Concurrent Work Awareness
- T5: Expense import implementation is complete
- T6: Booking ingestion implementation is complete

## Skills to Consider
- str-feature-spec

## Completion Notes
- Report files changed
- Report blockers or dependency collisions
