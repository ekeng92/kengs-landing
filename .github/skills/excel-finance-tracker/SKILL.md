---
name: excel-finance-tracker
description: 'Read, update, and maintain the Keng''s Landing finance tracker Excel workbook. Use when the user reports revenue, expenses, or asks to update the spreadsheet, regenerate it, add new data, or check financial status.'
metadata:
  version: 1.0.0
---

# Excel Finance Tracker Skill

Read, write, and regenerate the Keng's Landing STR finance tracker Excel workbook using openpyxl.

## Workbook Location

`/Users/ekeng/IdeaProjects/kengs-landing/finances/kengs-landing-finance-tracker.xlsx`

## Workbook Structure

| Sheet | Purpose | Data Entry? |
|-------|---------|-------------|
| **Bookings** | Revenue from guest stays | YES — add rows here |
| **Expenses** | All business expenses | YES — add rows here |
| **Monthly Summary** | Auto-calculated P&L by month | NO — formulas only |
| **Investment & ROI** | Auto-calculated ROI tracker | NO — formulas only |
| **Budget vs Actual** | Budget targets vs real spend | YES — column B (Annual Budget) only |
| **Category Reference** | Expense category guide | NO — reference only |

## How Formulas Flow

```
Bookings (data) ──→ Monthly Summary (SUMIFS) ──→ Investment & ROI (cell refs)
Expenses (data) ──→ Monthly Summary (SUMIFS) ──→ Investment & ROI (cell refs)
                ──→ Budget vs Actual (SUMIFS)
```

- Monthly Summary uses `SUMIFS` to aggregate by month name (e.g., "Mar 2026")
- Investment & ROI pulls totals from Monthly Summary row 16 (annual totals)
- Budget vs Actual uses `SUMIFS` against expense Category column — same categories as the Expenses dropdown
- The user only enters data in Bookings, Expenses, and Budget column B — everything else auto-calculates

## Adding a Booking (Revenue)

```python
import openpyxl

wb = openpyxl.load_workbook('finances/kengs-landing-finance-tracker.xlsx')
ws = wb['Bookings']

# Find next empty row (column A is Month)
next_row = None
for r in range(2, 102):
    if ws.cell(row=r, column=1).value is None:
        next_row = r
        break

# Required columns:
ws.cell(row=next_row, column=1, value='Apr 2026')    # A: Month (MUST match "MMM YYYY" format)
ws.cell(row=next_row, column=2, value='Airbnb')       # B: Platform
ws.cell(row=next_row, column=11, value=590.97)        # K: Net Payout
ws.cell(row=next_row, column=11).number_format = '#,##0.00'
ws.cell(row=next_row, column=12, value='Payout 2026-04-06')  # L: Notes

# Optional columns (fill when available):
# C: Guest Name, D: Check-In date, E: Check-Out date
# F: Nights, G: Nightly Rate, H: Cleaning Fee
# I: Gross Revenue, J: Platform Fees

wb.save('finances/kengs-landing-finance-tracker.xlsx')
```

### Critical Rules for Bookings
- **Column A (Month) must be exact text**: `"MMM YYYY"` format — e.g., `"Mar 2026"`, `"Apr 2026"`. This is the key that Monthly Summary uses for SUMIFS matching
- **Column K (Net Payout) is the revenue number** that flows to Monthly Summary. If only a lump payout amount is known, put it here
- **Column I (Gross Revenue)** and **Column J (Platform Fees)** are optional detail — fill when breakdown is available
- **Always find the next empty row** — never overwrite existing data

## Adding an Expense

```python
from datetime import date

ws = wb['Expenses']

# Find next empty row (column A is Date)
next_row = None
for r in range(2, 202):
    if ws.cell(row=r, column=1).value is None:
        next_row = r
        break

ws.cell(row=next_row, column=1, value=date(2026, 4, 8))  # A: Date (datetime object)
ws.cell(row=next_row, column=1).number_format = 'YYYY-MM-DD'
# B: Month — auto-formula, DO NOT SET
ws.cell(row=next_row, column=3, value='Cleaning & Turnover')  # C: Category
ws.cell(row=next_row, column=4, value='Julie Rose')           # D: Vendor
ws.cell(row=next_row, column=5, value='Airbnb turnover')      # E: Description
ws.cell(row=next_row, column=6, value=60)                     # F: Amount
ws.cell(row=next_row, column=6).number_format = '#,##0.00'
ws.cell(row=next_row, column=7, value='Cash')                 # G: Payment Method
ws.cell(row=next_row, column=8, value='N')                    # H: Receipt?
```

### Critical Rules for Expenses
- **Column A must be a Python `date` or `datetime` object** — not a string. Excel needs a real date for the Month formula to work
- **Column B is a formula** (`=IF(A{row}="","",TEXT(A{row},"MMM YYYY"))`). NEVER overwrite it with static text. The generator sets this for all 200 rows
- **Column C must match a category exactly**: `"Mortgage Interest"`, `"Property Taxes"`, `"Insurance"`, `"Repairs & Maintenance"`, `"Supplies"`, `"Utilities"`, `"Cleaning & Turnover"`, `"Platform Fees"`, `"Professional Services"`, `"Advertising"`, `"Travel / Mileage"`, `"Depreciation"`, `"Other"`

## Reading Current State

```python
wb = openpyxl.load_workbook('finances/kengs-landing-finance-tracker.xlsx')

# Count bookings
ws = wb['Bookings']
booking_count = 0
for r in range(2, 102):
    if ws.cell(row=r, column=1).value is not None:
        booking_count += 1

# Count expenses
ws2 = wb['Expenses']
expense_count = 0
for r in range(2, 202):
    if ws2.cell(row=r, column=1).value is not None:
        expense_count += 1

# Note: Monthly Summary and ROI values are formulas — openpyxl cannot evaluate them.
# To report calculated values, sum the raw data from Bookings/Expenses directly.
```

## Regenerating the Workbook

If formulas break or the structure needs updating:

```bash
cd /Users/ekeng/IdeaProjects/kengs-landing
python3 finances/generate-tracker.py
```

The generator script:
- Reads existing data from the current workbook (preserves all bookings and expenses)
- Rebuilds all sheets with correct formulas
- Re-applies formatting, dropdowns, and styling
- Safe to run repeatedly — data is never lost

## Gotchas Learned the Hard Way

1. **SUMPRODUCT with `IF(ISNUMBER(...))` causes `#VALUE!` in Excel.** Always use `SUMIFS`/`COUNTIFS` for cross-sheet aggregation. The array formula pattern that works in Google Sheets fails in Excel
2. **openpyxl cannot evaluate formulas.** When reading the Monthly Summary or ROI sheets, you get formula strings, not computed values. To report totals to the user, sum the raw data from Bookings/Expenses columns directly via Python
3. **The Expense Month column (B) is always a formula.** Never write to it. The `=TEXT(A{row},"MMM YYYY")` formula auto-derives from the date in column A
4. **Month text must match exactly** between Bookings column A and Monthly Summary column A. The format is `"MMM YYYY"` — three-letter month, space, four-digit year (e.g., `"Apr 2026"`)
5. **Use absolute cell references** (`$A$2:$A$101`) in SUMIFS ranges so formulas don't shift when rows are inserted
6. **Find next empty row before inserting** — never hardcode row numbers. Data grows over time
7. **Commit after updates** — this workbook is tracked in git. After modifying data, remind the user to commit and push

## Budget vs Actual Sheet

The **Budget vs Actual** tab (purple) has two sections:

### Expense Budget (rows 5-18)
- **Column A**: Category (synced — same 13 Schedule E categories as Expenses dropdown)
- **Column B**: Annual Budget — **user enters this** (or agent sets via openpyxl)
- **Column C**: Monthly Budget — auto: `=B/12`
- **Column D**: YTD Actual — auto: `=SUMIFS` from Expenses by category
- **Column E**: YTD Variance — auto: `=Budget - Actual` (positive = under budget)
- **Column F**: % Used — auto: `=Actual / Budget`
- **Row 18**: Totals

### Revenue Target (rows 22-23)
- **Row 22**: Gross Revenue target — user sets Annual Target in B22
- **Row 23**: Net Profit target — user sets Annual Target in B23
- YTD Actual pulls from Monthly Summary automatically

### Setting a budget via code
```python
ws = wb['Budget vs Actual']
# Cleaning budget: $3,600/year ($300/month)
ws.cell(row=11, column=2, value=3600)  # row 11 = Cleaning & Turnover

# Category row mapping (rows 5-17):
# 5=Mortgage Interest, 6=Property Taxes, 7=Insurance,
# 8=Repairs & Maintenance, 9=Supplies, 10=Utilities,
# 11=Cleaning & Turnover, 12=Platform Fees, 13=Professional Services,
# 14=Advertising, 15=Travel / Mileage, 16=Depreciation, 17=Other
```

Budget amounts are preserved when regenerating the workbook — the generator reads existing values before rebuilding.
