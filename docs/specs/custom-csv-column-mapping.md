# Custom CSV Column Mapping

> **Status:** Concept — not yet scoped for implementation  
> **Origin:** SAGE Keng, session 2026-04-21  
> **Priority:** P2 — strong product differentiator

## Problem

Different banks, credit cards, and platforms export CSVs with different column layouts. Today, the app has hardcoded parsers for Chase, Amex, and Airbnb formats. When a user uploads a CSV from an unsupported source, it either fails or misparses.

## Proposed Solution

**Interactive column mapping wizard** — when the system doesn't recognize a CSV format:

1. User uploads a CSV
2. System displays the first 3-5 rows in a preview table
3. For each column, user maps it to a known field:
   - **Date** (transaction date)
   - **Amount** (transaction amount)
   - **Description** / **Merchant**
   - **Category** (source category, if present)
   - **Skip** (ignore this column)
4. User names this CSV format (e.g., "Wells Fargo Checking")
5. System stores the mapping in a `csv_format_templates` table
6. On future uploads, the system auto-detects the format (by header match) and applies the saved mapping — user just confirms

## Key Design Questions

- **Auto-detection:** Match on exact header row? Fuzzy match?
- **Amount sign convention:** Some banks use negative for debits, some use a separate debit/credit column. Need to handle both.
- **Date format:** Auto-detect from sample data (MM/DD/YYYY vs YYYY-MM-DD vs DD/MM/YYYY)?
- **Scope:** Per-user templates? Per-workspace? Shareable community templates?

## Data Model Sketch

```
csv_format_templates:
  id            UUID PK
  workspace_id  UUID FK → workspaces
  name          TEXT          -- "Wells Fargo Checking"
  header_fingerprint TEXT     -- hash or exact header row for auto-matching
  column_map    JSONB         -- { "Date": 0, "Amount": 3, "Merchant": 1, ... }
  amount_sign   TEXT          -- "negative_is_debit" | "separate_columns" | "always_positive"
  date_format   TEXT          -- "MM/DD/YYYY" | "YYYY-MM-DD" | auto
  created_at    TIMESTAMPTZ
```

## Product Value

This is the feature that makes the app usable by **any STR host**, not just Eric. Most competing tools either only support specific banks or require manual data entry. A self-service mapping wizard + saved templates = zero-config for repeat imports.

## Related

- Current hardcoded parsers: `backend/expense-import/parse.ts` (detectColumns, splitCsvRows)
- Existing column detection: searches for common header names (date, amount, description, merchant, category)
- Airbnb parser: `backend/booking-ingest/airbnb-parser.ts`
