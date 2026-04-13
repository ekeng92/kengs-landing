# Keng's Landing — Finances

Financial tracking for the Keng's Landing short-term rental business.

> **Property ownership:** 360 County Road is being transferred into the LLC (Series 360). Ironwood and Marlow are personally held (mortgage due-on-sale clause prevents LLC transfer). All three properties are tracked for financial purposes.

## Folder Structure

```
finances/
├── README.md              ← You are here
├── templates/             ← Reusable templates (committed — no real data)
│   ├── booking-log.md     ← Monthly booking log template
│   ├── expense-log.md     ← Monthly expense log template
│   └── schedule-e-worksheet.md  ← Annual tax prep worksheet
├── 2026/                  ← Current year working data
│   ├── revenue/           ← Monthly booking logs (*.ignore.* files)
│   ├── expenses/          ← Monthly expense logs (*.ignore.* files)
│   └── receipts/          ← Receipt images/PDFs by month (*.ignore.* files)
└── tax/                   ← Year-end tax prep materials (*.ignore.* files)
```

## Conventions

- **No real dollar amounts in committed files.** All files with actual financial data MUST use the `*.ignore.*` naming pattern (e.g., `2026-04-revenue.ignore.csv`). The `.gitignore` excludes these from version control.
- **Templates are committed.** Column headers, category lists, and empty structures are fine to commit.
- **Per-property tracking.** Tag every transaction with the property it belongs to: `360`, `Ironwood`, `Marlow`, or `General` for shared costs. Only 360 is under the LLC — Ironwood and Marlow are reported on personal Schedule E.
- **Schedule E categories.** Expenses are categorized to align directly with IRS Schedule E for tax filing.

## Expense Categories (Schedule E Aligned)

| Category | Examples |
|----------|----------|
| Mortgage interest | Monthly payment (interest portion only) |
| Property taxes | County tax, special assessments |
| Insurance | Landlord policy, umbrella coverage |
| Repairs & maintenance | Plumbing, HVAC, pest control, appliance repair |
| Supplies | Cleaning supplies, toiletries, linens, kitchen items |
| Utilities | Electric, water, propane, Starlink internet, trash |
| Cleaning & turnover | Professional cleaning between guests |
| Platform fees | Airbnb/VRBO host fees |
| Professional services | CPA, attorney, property manager |
| Advertising | Listing boosts, photography |
| Travel | Mileage to property for maintenance/supplies |
| Depreciation | Building (27.5yr), furniture/appliances (5-7yr) |
| Other | Locks, permits, software subscriptions |

## Revenue Sources

| Platform | Status |
|----------|--------|
| Airbnb | Primary — most bookings |
| VRBO | Active |
| Zillow | Active |
| TurboTenant (Apartments.com) | Active |

## Tax Calendar

| When | What |
|------|------|
| Jan–Mar | Gather 1099s, compile annual P&L, prep Schedule E |
| Apr 15 | Federal tax filing deadline |
| May 15 | Texas property tax protest deadline |
| Jun 15, Sep 15 | Estimated quarterly tax payments (if applicable) |
| Dec | Year-end close, reconcile all months, generate annual summary |

## Getting Started

Use the `@bkeng-str-finance` agent in VS Code to:
- Create monthly booking/expense logs from templates
- Categorize and tag transactions
- Generate P&L summaries
- Prep Schedule E worksheets at tax time
