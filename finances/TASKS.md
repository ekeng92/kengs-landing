# Keng's Landing — STR Finance Task List

> Living task list. Newest additions at top within each section.

## Priority — Tax Prep / Depreciation

- [x] **Placed-in-service date: March 1, 2026** — based on first VRBO booking (Mar 2026). Tax Period column added to tracker: 94 Pre-Service, 41 Operational
- [ ] **Pull Freestone County tax assessment** — need land vs building value split for 27.5-year depreciation calculation. Check Freestone County CAD website or 2025 property tax statement
- [ ] **Get golf cart bill of sale** — need documentation for Section 179 election ($2,400). Check texts/FB Marketplace messages
- [ ] **Categorize pre-service expenses into tax buckets** — 94 expenses tagged Pre-Service ($18K+). Need to split into: (1) capital improvements (add to basis, depreciate 27.5yr), (2) startup costs (up to $5K deducted year 1, remainder amortized 15yr). See Tax Notes below
- [ ] **Build Depreciation Schedule sheet** — add to Excel tracker once assessment data and placed-in-service date are confirmed

## Review Items (31 pending)

- [ ] **Home Depot / Lowe's charges** (~19 from Robinhood CC + 2 from Chase CC) — keep in Review, export HD/Lowe's transaction history later to categorize
- [ ] **FB Marketplace purchases** (~$350 total, 5 items) — determine which are STR furniture/supplies vs personal
- [ ] **ATM withdrawal $500** — check texts for Jeff Yancey payment context
- [ ] **Golf carts $2,400** — pending bill of sale (see above)
- [ ] **Unaccounted cash $3,400** — do NOT report until documented. Try to reconstruct from texts/receipts

## Data Imports

- [ ] **Amazon orders** — Option C deferred. Export Amazon order history CSV, match ~$6,188 across 181 transactions to STR vs personal
- [ ] **VRBO import** — need sample VRBO CSV export to build import script

## Dashboard / Reporting

- [ ] **Depreciation Schedule sheet** — blocked on tax assessment data
- [ ] **Annual CC statement archive** — at year-end, download full Robinhood CC + Chase transaction histories to `finances/2026/`

## Completed

- [x] Airbnb CSV import (3 bookings enriched)
- [x] Robinhood CC import (66 expenses, $4,154)
- [x] Chase 3-account import (64 expenses, $20,448)
- [x] Mileage log (20 trips, 2,400 mi, $1,680 deductions)
- [x] Dashboard 6 tabs (Overview, Review, Bookings, Expenses, Mileage, Budget)
- [x] Dynamic improvements computation (replaced $10K guess)
- [x] $7.5K cash withdrawal broken into components
- [x] Category normalization (56 entries)
- [x] Financial snapshot generated
- [x] Tax Period column added (Pre-Service/Operational, PIS: 2026-03-01)
- [x] Dashboard bugs fixed (category casing, Investment Recovery, localStorage migration)
- [x] Audit trail CSV exported to finances/2026/expenses/

---

## Tax Notes — 2025 Pre-Service Expenses

360 CR was purchased in 2025 but not placed in service as a rental until ~May 2026. Tax preparer confirmed: 2025 expenses cannot be deducted on 2025 return (property was not yet a rental). All pre-service costs are deducted starting in the placed-in-service year (2026).

**Two buckets for pre-service costs:**

1. **Capital improvements** (renovations, new systems, structural work) → added to the property's cost basis → depreciated over 27.5 years starting placed-in-service date
2. **Startup costs** (non-capital: supplies, travel, market research, listing photos, initial cleaning) → IRC §195 election: deduct up to $5,000 in Year 1, amortize remainder over 180 months (15 years)

No amended 2025 return needed. Everything flows through the 2026 Schedule E.
