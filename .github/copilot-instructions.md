# Keng's Landing — Copilot Instructions

## What This Repo Is

AI-powered financial operations system for **Keng's Landing**, a short-term rental property business. The core value is turning raw bank/platform CSV exports into organized, tax-ready financial data through an AI agent + browser dashboard.

Also serves as a test domain for a potential product: an STR finance tool any Airbnb/VRBO host could use.

This repo now has two valid modes:

- **Prototype operations** — the current spreadsheet-driven finance system under `finances/`
- **Product planning and transition** — the committed documents under `docs/` that define how the website becomes a real application

**Entity:** Keng's Landing LLC (Texas Series LLC) — 360 County Road is Series 360. Ironwood and Marlow are personally held (mortgage due-on-sale clause).

## Key System Files

| File | Role |
|------|------|
| `finances/kengs-landing-finance-tracker.xlsx` | The database — single source of truth, committed to git |
| `finances/dashboard.html` | The UI — open in Chrome, reads/writes the Excel file |
| `finances/TASKS.md` | Living task list for tax prep, review items, imports |
| `finances/import-*.py` | CSV import scripts (Airbnb, Chase, Robinhood) |
| `docs/STR-FINANCE-PRODUCT-BRIEF.md` | Product intent and scope anchor |
| `docs/architecture/ADR-001-prototype-boundaries.md` | Prototype-first vs durable decision boundary |
| `docs/architecture/domain-model.md` | Canonical product entities and relationships |
| `docs/roadmap/90-day-roadmap.md` | Near-term sequencing by risk retirement |

## Structure

| Folder | Purpose |
|--------|---------|
| `finances/` | **Core** — tracker, dashboard, import scripts, audit trail |
| `docs/` | Product brief, architecture, roadmap, workflow specs, guest docs |
| `operations/` | Leases, checklists, house rules, guest comms |
| `improvements/` | Renovation plans, project tracking |
| `LLC/` | Entity formation, deeds, EIN, governing docs |
| `signage/` | Printable signs for the property |
| `photos/` | Property and listing photos |

## Design Principles

When evaluating features or changes, ask: **"Would this be useful to any STR owner, or just to Eric?"**

- Features useful to any host → build generically, document well
- Features specific to Eric's personal life → still build, but keep isolated
- The finance system (import → categorize → review → report) is the product-viable core
- Tax intelligence (Schedule E categories, pre-service classification, depreciation, mileage) is the differentiator

## Product Transition Rules

- Prototype fast on UI and workflow detail, but keep data meaning durable.
- Spreadsheet compatibility remains important, but Excel is an import/export format, not the target architecture.
- Before non-trivial implementation, agents should create or update a workflow-first spec under `docs/specs/`.
- If a change affects metric definitions, import lifecycle, or auditability, update the matching `docs/architecture/` or `docs/roadmap/` artifact in the same task.

## Planning Artifacts

- `docs/STR-FINANCE-PRODUCT-BRIEF.md` — vision, scope, guardrails
- `docs/architecture/ADR-001-prototype-boundaries.md` — what can be disposable vs durable
- `docs/architecture/domain-model.md` — canonical entities, ownership, and lifecycle
- `docs/roadmap/90-day-roadmap.md` — next 90 days of work
- `docs/specs/` — feature-ready workflow specs used before implementation

## Agents

- `@str-finance` — finance operations, tax-aware bookkeeping, spreadsheet workflows
- `@str-legal-counsel` — LLC structure, compliance, deed and legal document strategy
- `@str-product-tpm` — product oversight, sequencing, readiness checks, and drift prevention across planning and implementation

## Conventions

- The Excel tracker contains real financial data and IS committed (it's the database)
- Sensitive personal files still use `*.ignore.*` pattern where appropriate
- PDFs committed for legal/governing docs
- Markdown preferred for anything that benefits from version history
- Use the scoped files under `.github/instructions/` to govern planning and implementation work instead of expanding this file into a monolith

## GitHub Account

This repo is on the **ekeng92** personal GitHub account. See `.github/instructions/github-operations.instructions.md` for auth details.
