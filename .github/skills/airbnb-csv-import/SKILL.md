---
name: airbnb-csv-import
description: 'Import Airbnb transaction CSV exports into the Keng''s Landing finance tracker. Parses reservation rows, deduplicates against existing bookings, enriches stub entries with full detail. Use when the user says "import airbnb", "update finances from airbnb", "import airbnb csv", or drops an Airbnb CSV file.'
metadata:
  version: 1.0.0
---

# Airbnb CSV Import Skill

Import Airbnb earnings CSV exports into the finance tracker Excel workbook.

## How It Works

1. User exports CSV from Airbnb (Transaction History page → Export)
2. CSV lands in `~/Downloads/` as `airbnb*.csv`
3. Import script auto-detects the newest matching file, or accepts an explicit path
4. Script parses Reservation rows, deduplicates, and writes to the Bookings sheet

## Running the Import

```bash
cd /Users/ekeng/IdeaProjects/kengs-landing

# Auto-detect newest airbnb CSV in ~/Downloads/
python3 finances/import-airbnb-csv.py

# Or specify a path explicitly
python3 finances/import-airbnb-csv.py /path/to/airbnb_export.csv
```

## What the Script Does

### Parsing
- Reads the CSV and extracts only `Type == "Reservation"` rows (ignores Payout summary rows)
- Maps Airbnb columns → Bookings sheet columns:

| Airbnb CSV Column | Bookings Column | Notes |
|---|---|---|
| Start date | A: Month | Converted to "MMM YYYY" |
| (hardcoded) | B: Platform | Always "Airbnb" |
| Guest | C: Guest Name | |
| Start date | D: Check-In | YYYY-MM-DD date |
| End date | E: Check-Out | YYYY-MM-DD date |
| Nights | F: Nights | |
| (calculated) | G: Nightly Rate | (Gross - Cleaning - Pet) / Nights |
| Cleaning fee | H: Cleaning Fee | |
| Gross earnings | I: Gross Revenue | |
| Service fee | J: Platform Fees | |
| Amount | K: Net Payout | What hits the bank |
| Confirmation code + extras | L: Notes | "Airbnb HMXXXXXXXX" + pet fee, tax if present |

### Deduplication (3 layers)
1. **Confirmation code match** — If a booking's confirmation code (e.g., `HM4MWDKA2D`) already exists in any Notes cell, skip it
2. **Stub enrichment** — If a row has the same net payout amount and month but no guest name (a "stub" from manual entry), overwrite it with full detail from the CSV
3. **New entry** — If neither match, append as a new row

### Output
The script reports what it did:
```
Found 3 reservation(s) in CSV
Existing tracker: 0 confirmation code(s), 3 stub(s), next empty row: 6
  ENRICH row 5: HM4MWDKA2D — Dalyce Sellers ($408.18)
  ENRICH row 4: HMRWNBH82B — Kepi Garner Jr ($314.86)
  ADD row 6: HMXXXXXXXX — New Guest ($250.00)

Done! Added: 1, Enriched: 2, Skipped: 0
```

## After Import

1. Open the Excel workbook to spot-check new entries
2. Monthly Summary and other formula sheets auto-calculate from Bookings data
3. Commit the updated tracker:
   ```bash
   cd /Users/ekeng/IdeaProjects/kengs-landing
   git add finances/kengs-landing-finance-tracker.xlsx
   git commit -m "Import Airbnb bookings"
   git push
   ```

## Airbnb CSV Export Steps (for reference)

The user performs these steps in the browser — they cannot be automated:
1. Go to Airbnb → Earnings → Transaction History (or Gross Earnings page)
2. Set the date filter for the desired period
3. Click Export / Download CSV
4. File saves to `~/Downloads/` as `airbnb_*.csv` or similar

The pre-signed S3 download URL that Airbnb generates expires in 90 minutes and requires active session authentication. There is no stable API endpoint to automate this step.

## Gotchas

- The CSV contains both `Payout` and `Reservation` rows — only Reservation rows have booking details. Payout rows are summary lines for bank transfers
- `Amount` column on Reservation rows = the net payout amount (what flows to the bank), which equals Gross minus Service Fee minus Tax
- Pet fees and cleaning fees are included in Gross Earnings but broken out separately in the CSV
- If the same CSV is imported twice, all entries will be skipped (dedup by confirmation code)
- The Month column uses the check-in Start Date, not the payout date — this matches how revenue should be recognized
