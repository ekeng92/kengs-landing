# Keng's Landing — Finance System

The financial engine for Keng's Landing STR operations. Everything flows through the Excel tracker, viewed and edited via the browser dashboard.

## How It Works

```
Bank CSV exports ──→ Python import scripts ──→ Excel tracker ──→ Browser dashboard
                                                    ↕
                                              localStorage (auto-save)
```

1. **Export** a CSV from your bank (Chase, Robinhood, any CC) or platform (Airbnb)
2. **Run** the matching import script — it categorizes, deduplicates, and writes to the Excel tracker
3. **Open** `dashboard.html` in Chrome, import the xlsx, and review your data
4. **Decide** on flagged items in the Review tab (Business / Personal)
5. **Export** back to xlsx when done — the Excel file is the permanent record

## Key Files

| File | Purpose |
|------|---------|
| `kengs-landing-finance-tracker.xlsx` | **The database.** Single source of truth. Committed to git. |
| `dashboard.html` | **The UI.** Open in Chrome. Reads/writes the Excel file. |
| `TASKS.md` | Living task list — tax prep, review items, data imports |
| `import-airbnb-csv.py` | Import Airbnb transaction exports |
| `import-bank-csv.py` | Import Robinhood CC bank statements |
| `import-chase-accounts.py` | Import Chase checking/CC statements |
| `generate-mileage-log.py` | Reconstruct mileage log from CC purchase locations |
| `reconcile-expenses.py` | Process Business/Personal decisions from Review tab |
| `2026/expenses/all-expenses-audit-trail.csv` | Full export for audit/backup |

## Excel Tracker Sheets

| Sheet | Contents |
|-------|----------|
| Bookings | Platform, guest, dates, rates, fees, net payout |
| Expenses | Date, category, vendor, amount, payment method, receipt status, Status (Business/Personal/Review), Tax Period (Pre-Service/Operational) |
| Monthly Summary | Auto-computed from Bookings + Expenses |
| Investment & ROI | Purchase price, computed improvements, target payback |
| Budget vs Actual | Annual budget by Schedule E category vs actuals |
| Category Reference | IRS Schedule E category definitions |
| Mileage Log | Date, origin, destination, miles, purpose, IRS rate, deduction |

## Dashboard Tabs

| Tab | What You See |
|-----|-------------|
| **Overview** | KPI cards (revenue, expenses, net profit, occupancy, mileage deduction, investment recovery), monthly P&L table, category breakdown, ROI progress |
| **Review** | Only items flagged for review. Click Business or Personal to decide. Apply to save. |
| **Bookings** | Editable booking table. Add/remove bookings. |
| **Expenses** | Full expense list with Tax Period badges (blue=Pre-Service, green=Operational). Sortable, editable. |
| **Mileage** | KPI cards (total trips, miles, deduction) + trip log table |
| **Budget** | Budget vs Actual by category + Investment Quick View sidebar |

## Tax Period Classification

Every expense is tagged based on the **placed-in-service date (March 1, 2026)**:

- **Pre-Service** (before March 1, 2026) — startup costs and capital improvements. These go into two IRS buckets:
  - Capital improvements → added to cost basis → depreciated 27.5 years
  - Startup costs → up to $5K deducted in year 1, remainder amortized 15 years (IRC §195)
- **Operational** (March 1, 2026 forward) — fully deductible on Schedule E in the year incurred

## Expense Categories (IRS Schedule E)

| Category | Examples |
|----------|----------|
| Repairs & maintenance | Plumbing, HVAC, pest control, appliance repair, contractor work |
| Supplies | Cleaning supplies, toiletries, linens, kitchen items, furniture |
| Utilities | Electric, water, propane, Starlink internet, trash |
| Cleaning & turnover | Professional cleaning between guests |
| Travel | Mileage to property, meals during property work, tolls |
| Professional services | CPA, attorney, property manager |
| Platform fees | Airbnb/VRBO host fees |
| Insurance | Landlord policy, umbrella coverage |
| Mortgage interest | Monthly payment (interest portion only) |
| Property taxes | County tax, special assessments |
| Advertising | Listing boosts, photography |
| Depreciation | Building (27.5yr), furniture/appliances (5-7yr or §179) |
| Other | Locks, permits, software subscriptions |

## Receipt Documentation

| Receipt Value | Meaning |
|---------------|---------|
| `CC` | Credit/debit card statement is the record (sufficient for IRS) |
| `Y` | Physical/digital receipt saved |
| `N` | No documentation — flag for follow-up |

## Adding New Bank Data

```bash
# 1. Export CSV from bank/platform
# 2. Place in ~/Downloads/
# 3. Ask the @bkeng-str-finance agent to import it
#    OR run the matching script directly:
python3 finances/import-airbnb-csv.py
python3 finances/import-bank-csv.py
python3 finances/import-chase-accounts.py
```
