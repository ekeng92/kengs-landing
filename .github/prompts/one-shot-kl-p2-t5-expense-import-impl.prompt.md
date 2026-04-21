---
description: 'Implement expense import/review workflow (backend + minimal UI) for MVP.'
mode: 'agent'
tools: [file_search, apply_patch]
---

# P2 T5: Expense Import Implementation

## Context
Read these files first:
- kengs-landing/docs/specs/expense-import-review.md (finalized spec)
- kengs-landing/docs/architecture/schema-draft.md (locked schema)
- backend/ (scaffolded backend)

## Write Boundary
- You may edit: backend/expense-import, frontend/expense-review
- Do not edit: docs/specs/expense-import-review.md, docs/architecture/schema-draft.md

## Task
Implement the expense import and review workflow, including backend logic and minimal UI for review. Ensure audit trail and review state are handled. Report any blockers or schema gaps.

## Acceptance Criteria
- Expense import and review workflow is functional
- Audit trail and review state are implemented
- Minimal UI for review queue exists
- All changes reported

## Concurrent Work Awareness
- T4: Backend scaffold is being completed
- T6: Booking ingestion implementation is running in parallel

## Skills to Consider
- excel-finance-tracker
- str-feature-spec

## Completion Notes
- Report files changed
- Report blockers or dependency collisions
