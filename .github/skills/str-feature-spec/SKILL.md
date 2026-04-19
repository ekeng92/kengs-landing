---
name: str-feature-spec
description: 'Create a workflow-first feature spec for the STR finance product. Use when the user says "create feature spec", "plan this feature", "define this workflow", "prepare this for implementation", or asks agents to scope work before building.'
metadata:
  author: GitHub Copilot
  created: '2026-04-18'
  lastUpdated: '2026-04-18'
---

# STR Feature Spec Skill

Create implementation-ready feature specs that keep AI-led delivery aligned with product intent.

## Before You Write

Read these documents first if they exist:

- `docs/STR-FINANCE-PRODUCT-BRIEF.md`
- `docs/architecture/ADR-001-prototype-boundaries.md`
- `docs/architecture/domain-model.md`
- `docs/roadmap/90-day-roadmap.md`

If one of these documents is missing and the requested feature depends on it, create or update the missing planning document before finalizing the feature spec.

## Output Location

Write the spec to `docs/specs/<feature-name>.md`.

## Required Sections

1. Purpose
2. User outcome
3. Why now
4. Workflow
5. Data impact
6. Audit and traceability
7. Acceptance criteria
8. Out of scope
9. Open questions
10. Delivery notes

## Workflow Rules

- Describe the trigger, happy path, review or exception path, and done state.
- Prefer workflow slices over technical component lists.
- Call out which parts are disposable prototype choices and which parts become durable product behavior.
- If the feature touches imports, define raw file, parsed row, normalized row, review state, and committed record.
- If the feature touches metrics, reuse canonical metric names from the planning docs.

## Acceptance Criteria Rules

- Acceptance criteria must be testable and observable.
- Avoid implementation leakage unless a technical constraint is itself part of the requirement.
- Include at least one failure or recovery criterion for any workflow involving imports or classification.

## Delivery Notes

- End with a recommended implementation slice order.
- If the feature is still underdefined, stop at the open questions instead of inventing certainty.