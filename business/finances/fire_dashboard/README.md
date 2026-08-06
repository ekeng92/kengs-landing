# Personal Financial Planning Dashboard (Local)

A local-first Streamlit dashboard for budgeting, net worth tracking, rental property analysis, and FIRE timeline modeling.

## File Structure

```text
fire_dashboard/
  app.py
  requirements.txt
  README.md
  finance_dashboard/
    __init__.py
    models.py
    sample_data.py
    data_ingestion.py
    categorization.py
    networth.py
    fire_engine.py
    visualizations.py
```

## What It Covers

- Chase CSV/TXT ingestion and transaction parsing
- Rule-based expense categorization with manual category correction for unmapped items
- Net worth ledger with optional home equity inclusion
- Real estate cashflow ledger including adjustable reserve rates
- FIRE target engine using the 4% rule and real estate offset logic
- 10, 15, 20, 25-year growth projections with adjustable CAGR
- 529 scaling impact from 2 to 4 children
- Interactive charts for projection, expense mix, and cashflow waterfall

## Run Locally

1. Create a virtual environment and activate it.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Optional local PIN lock:

```bash
export FIRE_DASHBOARD_PIN="your-pin-here"
```

4. Start the dashboard:

```bash
streamlit run app.py
```

5. Open the local URL shown by Streamlit (typically `http://localhost:8501`).

## Chase Text Format Example

The text parser expects lines similar to:

```text
07/01 Grocery Store -124.52
07/02 Netflix -19.99
07/03 Payroll 3200.00
```

If your export format differs, use CSV upload.
