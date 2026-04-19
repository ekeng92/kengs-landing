---
applyTo: 'docs/STR-FINANCE-PRODUCT-BRIEF.md,docs/architecture/**/*.md,docs/specs/**/*.md,docs/roadmap/**/*.md'
author: 'GitHub Copilot'
created: '2026-04-18'
lastUpdated: '2026-04-18'
---

# STR Product Planning Standards

Use planning documents to reduce product risk before implementation, not to restate aspirations.

## Core Rules

- Write planning around workflows and data boundaries, not pages or tabs.
- Separate **prototype decisions** from **durable product commitments** in every major planning doc.
- Every planning artifact must state: purpose, decision(s), non-goals, open questions, and what remains intentionally disposable.
- Use one canonical name for each business concept and metric across all docs.
- Define success in observable terms. Avoid vague language like "intuitive", "robust", or "easy" unless followed by measurable meaning.

## Required Content By Artifact Type

### ADRs

- State the decision, alternatives considered, and the consequence of being wrong.
- Be explicit about which choices are reversible versus expensive to reverse.

### Domain Model And Schema Drafts

- Model the business truth first, not the current UI.
- Identify ownership boundaries, audit requirements, and import provenance.
- Call out fields whose semantics affect reporting or tax outputs.

### Feature Specs

- Center the workflow: trigger, happy path, review path, failure path, done state.
- Include data entities touched, state transitions, audit expectations, and acceptance criteria.
- Mark what is out of scope so agents do not expand the work opportunistically.

### Roadmaps

- Sequence by risk retirement, not by visual appeal.
- Front-load decisions that stabilize future implementation: data model, auth, imports, and auditability.

## Finance Product Biases

- For this product, metric definitions and record provenance matter more than screen polish.
- Mobile support is required, but dense review workflows should remain desktop-first unless a workflow is explicitly mobile-native.
- AI assistance is an accelerator, not a source of truth. Human-reviewable state must exist for every important financial decision.