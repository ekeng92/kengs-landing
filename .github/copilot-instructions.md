# Keng's Landing — Copilot Instructions

## What This Repo Is

AI-powered financial operations system for **Keng's Landing**, a short-term rental property business. The core value is turning raw bank/platform CSV exports into organized, tax-ready financial data through an AI agent + browser dashboard.

Also serves as a test domain for a potential product: an STR finance tool any Airbnb/VRBO host could use.

**Entity:** Keng's Landing LLC (Texas Series LLC) — 360 County Road is Series 360. Ironwood and Marlow are personally held (mortgage due-on-sale clause).

## Key System Files

| File | Role |
|------|------|
| `finances/kengs-landing-finance-tracker.xlsx` | The database — single source of truth, committed to git |
| `finances/dashboard.html` | The UI — open in Chrome, reads/writes the Excel file |
| `finances/TASKS.md` | Living task list for tax prep, review items, imports |
| `finances/import-*.py` | CSV import scripts (Airbnb, Chase, Robinhood) |

## Structure

| Folder | Purpose |
|--------|---------|
| `finances/` | **Core** — tracker, dashboard, import scripts, audit trail |
| `docs/` | Guest book, property guides |
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

## Conventions

- The Excel tracker contains real financial data and IS committed (it's the database)
- Sensitive personal files still use `*.ignore.*` pattern where appropriate
- PDFs committed for legal/governing docs
- Markdown preferred for anything that benefits from version history

## GitHub Account

This repo is on the **ekeng92** personal GitHub account. See `.github/instructions/github-operations.instructions.md` for auth details.
