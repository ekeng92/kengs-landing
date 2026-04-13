# Keng's Landing

AI-powered financial operations system for a short-term rental business. Built as a real working system for Keng's Landing properties, with the goal of proving out a product that any Airbnb/VRBO host could use.

## What This Does

**The core problem:** STR owners drown in receipts, bank statements, and tax complexity. Platform payouts, multi-account expenses, mileage deductions, depreciation schedules, pre-service vs operational cost classification — it's a mess that most owners either ignore until April or overpay a CPA to untangle.

**The solution:** An AI agent + browser dashboard that turns raw bank/platform exports into organized, tax-ready financial data. Import a CSV, get categorized expenses, IRS-compliant mileage logs, pre-service/operational tagging, and a visual dashboard. No accounting software required.

### Current Capabilities

| Feature | Status |
|---------|--------|
| Multi-bank CSV import (Chase, Robinhood, any CC) | ✅ Working |
| Airbnb CSV import | ✅ Working |
| Automatic expense categorization (Schedule E aligned) | ✅ Working |
| Mileage log reconstruction from CC purchase locations | ✅ Working |
| Tax Period classification (Pre-Service vs Operational) | ✅ Working |
| 6-tab browser dashboard (Overview, Review, Bookings, Expenses, Mileage, Budget) | ✅ Working |
| Interactive expense review workflow (Business/Personal/Review) | ✅ Working |
| Excel tracker as single source of truth | ✅ Working |
| Audit trail CSV export | ✅ Working |
| VRBO CSV import | ⬜ Needs sample |
| Amazon order matching | ⬜ Deferred |
| Depreciation schedule | ⬜ Needs tax assessment data |
| Property tax protest tracking | ⬜ Planned |

### Product Viability Signals

This started as personal tooling. Evidence it could be a product:
- Imported 135 expenses from 4 bank accounts in minutes, not hours
- Tax period tagging (pre-service vs operational) is something CPAs charge for
- Mileage log from CC data is a feature hosts don't even know they're missing
- The Review workflow (flag → decide → apply) maps to how real people actually process expenses
- Dashboard runs in a browser with zero infrastructure — just open the HTML file

### What Would Make It a Product

- Multi-property support (currently hardcoded to 360 CR)
- User auth + cloud storage (currently local Excel + localStorage)
- Direct bank API integration (Plaid) instead of CSV import
- Auto-categorization ML model trained on STR expense patterns
- Hosted dashboard with mobile support
- Schedule E PDF generation
- Multi-user (co-hosts, property managers, CPAs)

## Property Context

**Current rate:** $150/night (raised from $125 — April 2026)

**Entity:** Keng's Landing LLC (Texas Series LLC) — 360 County Road is Series 360. Ironwood and Marlow remain personally held (mortgage due-on-sale clause).

## Repo Structure

```
finances/         ← THE CORE: tracker, dashboard, import scripts, task list
  dashboard.html  ← Open in Chrome — the main UI
  *.py            ← Import/export scripts
  TASKS.md        ← Living task list
docs/             ← Guest book, property guides
operations/       ← Leases, checklists, house rules, guest comms
improvements/     ← Renovation plans, project tracking
LLC/              ← Entity formation, deeds, EIN
signage/          ← Printable signs for the property
photos/           ← Property and listing photos
```

## Getting Started

1. Open `finances/dashboard.html` in Chrome
2. Click **Import xlsx** and select `finances/kengs-landing-finance-tracker.xlsx`
3. Browse tabs: Overview shows KPIs, Review shows items needing decisions, Expenses shows all transactions with Tax Period badges

To import new bank data, use the `@bkeng-str-finance` agent in VS Code.

## Agents

- **`@bkeng-str-finance`** — Financial operations: CSV import, expense categorization, tax strategy, P&L, Schedule E prep
- **`@bkeng-legal-counsel`** — LLC management, asset protection, compliance, document drafting
