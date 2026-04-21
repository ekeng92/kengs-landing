<!-- author: AEON Dev | created: 2026-04-20 | last updated: 2026-04-20 -->

# Dashboard and Export — Workflow Spec

## Purpose

Define the property-level dashboard and export workflows so an STR owner can view reliable performance metrics and produce clean records for tax preparation and professional review.

This spec covers Slice 3 from `mvp-workflow-slices.md`. It coordinates with:
- **T5 (expense import):** committed expenses are the only source for expense metrics
- **T6 (booking ingestion):** committed bookings are the only source for revenue metrics
- **T1 (schema):** all table and field references are schema-aligned

---

## User Outcome

An STR owner can select a property, view performance across any date range, and export clean, categorized records for a CPA or tax preparer — without opening a spreadsheet.

## Why Now

Dashboard and exports are only valuable once underlying records are committed and credible. Expense import and booking ingestion must be functional before this slice ships. A dashboard built on incomplete records creates false confidence and erodes product trust.

---

## Scope

**In scope:**
- Property-level performance dashboard (revenue, expenses, occupancy, net income)
- Committed expenses export (CSV, filterable by tax period, category, and review_state)
- Committed bookings/revenue export (CSV, filterable by property and date range)
- Mileage summary display

**Out of scope:**
- Multi-property aggregated dashboard (deferred — single property view first)
- PDF export (deferred — CSV is the CPA handoff format for MVP)
- Budget vs. actual comparison (tracked in `budgets` table but not surfaced in MVP)
- AI-assisted categorization review (post-MVP)
- Chart and graph visualizations (disposable prototype layer — layout only)

---

## Metric Definitions

These definitions are durable. Any implementation must use exactly these semantics.

| Metric | Definition | Source |
|---|---|---|
| **Gross Booking Revenue** | Sum of `gross_revenue_amount` for committed bookings in the date range | `bookings WHERE status = 'committed'` |
| **Net Payout Revenue** | Sum of `net_payout_amount` for committed bookings in the date range | `bookings WHERE status = 'committed'` |
| **Platform Fees** | Sum of `platform_fee_amount` for committed bookings | `bookings WHERE status = 'committed'` |
| **Business Operating Expenses** | Sum of `amount` for committed expenses with `review_state = 'Business'` | `expenses WHERE status = 'committed' AND review_state = 'Business'` |
| **Net Operating Result** | Net Payout Revenue minus Business Operating Expenses | Derived |
| **Nights Booked** | Sum of `nights` for committed bookings with check-in date in range | `bookings WHERE status = 'committed'` |
| **Occupancy Rate** | Nights Booked ÷ days in date range × 100 | Derived |
| **Mileage Total** | Sum of `miles` for mileage trips associated with the property in the period | `mileage_trips` |

**Decision:** `Personal` and `Review` expenses are excluded from all business reporting. They are preserved for audit but never counted in Business Operating Expenses.

---

## User Flows

### Flow 1: View Property Dashboard

**Precondition:** User is authenticated, has at least one property with committed records.

1. User navigates to Dashboard.
2. User selects a property from the property selector.
3. User selects a date range (presets: YTD, Q1/Q2/Q3/Q4, custom).
4. System queries committed bookings and expenses for the property and date range.
5. System displays the metrics section:
   - Gross Booking Revenue
   - Net Payout Revenue
   - Platform Fees
   - Business Operating Expenses
   - Net Operating Result
   - Nights Booked
   - Occupancy Rate
   - Mileage Total
6. System displays recent committed bookings table (check-in, check-out, guest, net payout, platform).
7. System displays recent committed expenses table (date, merchant, category, amount, review_state).
8. User can drill into either table to see full record list.

**Empty state:** If no committed records exist for the selected property and date range, display a clear message and a prompt to import data.

---

### Flow 2: Export Committed Expenses (CPA Review)

**Precondition:** User is on the dashboard or expenses view with a property and date range selected.

1. User selects **Export Expenses**.
2. User optionally filters by: tax period (Pre-Service / Operational), category, review_state (Business / Personal / Review).
3. User clicks **Download CSV**.
4. System generates a CSV of committed expenses matching the filters.
5. File is downloaded to the user's machine.

**CSV fields:**
`date, merchant, description, category, amount, payment_method, review_state, tax_period, documentation_status, property_code`

**Decision:** Export always includes `property_code` to ensure the CPA can identify which property each expense belongs to.

---

### Flow 3: Export Committed Bookings / Revenue Summary

**Precondition:** User is on the dashboard or bookings view with a property and date range selected.

1. User selects **Export Bookings**.
2. User optionally filters by: platform, date range.
3. User clicks **Download CSV**.
4. System generates a CSV of committed bookings matching the filters.
5. File is downloaded to the user's machine.

**CSV fields:**
`confirmation_code, guest_name, check_in_date, check_out_date, nights, gross_revenue_amount, cleaning_fee_amount, platform_fee_amount, tax_amount, net_payout_amount, source_platform, property_code`

---

## Data Impact

### Tables Read (read-only in this slice)

- `bookings` — revenue metrics and booking table
- `expenses` — expense metrics and expense table
- `mileage_trips` — mileage summary
- `properties` — property selector and metadata
- `workspaces` — ownership boundary enforcement

### No writes in this slice

The dashboard and export slice must not mutate any committed records. It is strictly read and export.

---

## Durable Decisions In This Slice

- All metric definitions as specified above — these must not be re-derived differently elsewhere in the codebase
- Export CSV field lists — adding fields is fine; removing or renaming fields is a breaking change requiring a spec update
- `Personal` and `Review` expenses are excluded from business metrics
- `status = 'committed'` is the only filter for reportable records — drafts and voided records never appear in dashboard or exports
- `property_code` is always included in exports for CPA traceability

## Disposable Prototype Choices In This Slice

- Dashboard layout and card arrangement
- Chart and graph types (if added)
- Color coding for metrics
- Mobile responsive behavior
- Date range preset labels

---

## Acceptance Criteria

- Property selector shows all properties in the workspace
- Date range filter updates all metrics and tables when changed
- Gross Booking Revenue, Net Payout Revenue, Business Operating Expenses, and Net Operating Result are correct for real imported data
- Occupancy Rate is derived correctly from nights booked and days in range
- Expense export downloads a valid CSV with all required fields
- Booking export downloads a valid CSV with all required fields
- Exports respect active filters
- Empty state is shown when no committed records exist for the selected filters
- No committed record is mutated by any dashboard or export action
- Dashboard and exports use only committed records (`status = 'committed'`)
