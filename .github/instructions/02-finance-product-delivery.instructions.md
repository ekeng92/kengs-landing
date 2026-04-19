---
applyTo: 'finances/dashboard/**/*.{js,css,html},finances/*.py,finances/dashboard.html'
author: 'GitHub Copilot'
created: '2026-04-18'
lastUpdated: '2026-04-18'
---

# STR Product Delivery Guardrails

This repo is in a prototype-to-product transition. Move quickly, but do not let disposable implementation choices redefine durable business behavior.

## Implementation Rules

- Prototype UI and interaction details can move fast. Data semantics, metric definitions, ownership rules, and import lifecycles must remain stable.
- Do not add new business logic directly inside DOM event handlers when it can live in a domain module or service.
- If a change alters how revenue, expenses, occupancy, payout, tax period, or review state are computed, update the matching planning doc in the same task.
- Avoid creating a second meaning for an existing metric. If a label already exists, reuse its formula or explicitly rename the new concept.
- Preserve a path from current prototype behavior to the intended product architecture. Do not deepen dependence on local-only persistence without stating why it is temporary.

## Feature Readiness

- For any non-trivial feature, create or update a spec in `docs/specs/` before broad implementation.
- Each spec must define workflow states, acceptance criteria, data impact, and what remains out of scope.
- If the feature changes import behavior, spell out raw input, normalized record, review state, and final committed state.

## UX Biases

- Finance review workflows are desktop-primary unless explicitly marked otherwise.
- Mobile-capable is sufficient for dashboard summary, quick capture, and light review; do not degrade dense review tables just to satisfy a mobile-first slogan.

## Product Integrity

- Keep spreadsheet compatibility, but treat Excel as interoperability, not system design.
- Auditability is a feature. Preserve provenance and user-visible decision trails whenever records are transformed or reclassified.