import os
from datetime import datetime

import pandas as pd
import streamlit as st

from finance_dashboard.categorization import (
    CATEGORY_RULES,
    DEFAULT_CATEGORY,
    apply_manual_categories,
    categorize_transactions,
    category_expense_summary,
)
from finance_dashboard.data_ingestion import ingest_uploaded_file, parse_chase_text
from finance_dashboard.fire_engine import (
    annual_contributions,
    annual_expense_from_transactions,
    annual_income_with_optional_promotion,
    estimate_fire_year,
    fire_target,
    project_portfolio_growth,
    roth_ira_limit_for_year,
)
from finance_dashboard.models import RentalProperty
from finance_dashboard.networth import net_worth, real_estate_summary, total_estimated_equity
from finance_dashboard.sample_data import baseline_profile, sample_expense_transactions
from finance_dashboard.visualizations import (
    cashflow_waterfall_chart,
    expense_donut_chart,
    net_worth_projection_chart,
)


st.set_page_config(page_title="Personal FIRE Dashboard", layout="wide")

st.title("Personal Financial Planning Dashboard")
st.caption("Local-first Streamlit app for budgeting, net worth tracking, real estate analysis, and FIRE modeling.")

required_pin = os.getenv("FIRE_DASHBOARD_PIN", "").strip()
if required_pin:
    with st.sidebar:
        st.subheader("Security")
        entered_pin = st.text_input("Enter local dashboard PIN", type="password")
    if entered_pin != required_pin:
        st.warning("PIN required to unlock dashboard.")
        st.stop()

profile = baseline_profile()

with st.sidebar:
    st.header("Core Assumptions")

    reserve_rate = st.slider("Real estate reserve rate (%)", 0.0, 30.0, 10.0, 0.5) / 100.0
    cagr = st.slider("Investment return CAGR (%)", 0.0, 15.0, 7.0, 0.1) / 100.0
    inflation_rate = st.slider("Inflation estimate (%)", 0.0, 8.0, 2.5, 0.1) / 100.0
    tax_rate = st.slider("Effective tax estimate (%)", 0.0, 45.0, 24.0, 0.5) / 100.0
    swr = st.slider("Safe withdrawal rate (%)", 2.0, 6.0, 4.0, 0.1) / 100.0

    include_equity = st.toggle("Include home equity in net worth", value=False)
    promotion_enabled = st.toggle("Model promotion bump", value=True)
    promotion_bump = st.slider("Promotion bump (%)", 0.0, 25.0, 10.0, 0.5) / 100.0
    promotion_month = st.slider("Promotion effective month", 1, 12, 6)

    target_children = st.slider("Children count (529 planning)", 2, 4, 4)

st.subheader("Income, Assets, and Rental Inputs")
left, mid, right = st.columns(3)

with left:
    base_salary = st.number_input("Primary base salary ($/year)", value=float(profile.base_salary), step=1000.0)
    secondary_income_monthly = st.number_input(
        "Secondary income ($/month)", value=float(profile.secondary_income_monthly), step=100.0
    )

with mid:
    liquid_assets = st.number_input("Baseline liquid assets ($)", value=float(profile.liquid_assets), step=1000.0)
    liabilities = st.number_input("Liabilities ($)", value=float(profile.liabilities), step=1000.0)

with right:
    starting_portfolio = st.number_input(
        "Starting FIRE portfolio ($)",
        value=float(profile.liquid_assets),
        step=1000.0,
        help="Usually your liquid investable assets.",
    )

st.markdown("### Real Estate Portfolio")
property_cols = st.columns(3)
properties = []
for idx, prop in enumerate(profile.properties):
    with property_cols[idx]:
        st.markdown(f"**{prop.name}**")
        mortgage = st.number_input(
            f"{prop.name} Mortgage ($/mo)",
            value=float(prop.monthly_mortgage),
            step=50.0,
            key=f"mortgage_{idx}",
        )
        rent = st.number_input(
            f"{prop.name} Rent ($/mo)",
            value=float(prop.monthly_rent),
            step=50.0,
            key=f"rent_{idx}",
        )
        equity = st.number_input(
            f"{prop.name} Est. Equity ($)",
            value=0.0,
            step=5000.0,
            key=f"equity_{idx}",
        )
        properties.append(
            RentalProperty(
                name=prop.name,
                monthly_mortgage=float(mortgage),
                monthly_rent=float(rent),
                owned_outright=prop.owned_outright,
                estimated_equity=float(equity),
            )
        )

st.markdown("---")
st.subheader("Module 1: Data Ingestion and Expense Parser")
st.caption("Upload Chase CSV/TXT or paste raw transaction lines. Files are processed in memory and never persisted to disk.")

upload_col, paste_col = st.columns([1, 1])
with upload_col:
    uploaded = st.file_uploader("Upload Chase transactions", type=["csv", "txt"])

with paste_col:
    raw_text = st.text_area(
        "Paste Chase transaction text",
        placeholder="Example: 07/01 Grocery Store -124.52",
        height=130,
    )

use_sample = st.toggle("Use sample expense data when no file/text provided", value=True)

transactions = pd.DataFrame(columns=["date", "description", "amount"])
parse_error = None

if uploaded is not None:
    try:
        transactions = ingest_uploaded_file(uploaded)
    except Exception as exc:
        parse_error = str(exc)
elif raw_text.strip():
    try:
        transactions = parse_chase_text(raw_text)
    except Exception as exc:
        parse_error = str(exc)
elif use_sample:
    transactions = sample_expense_transactions()

if parse_error:
    st.error(f"Parser issue: {parse_error}")

categorized = categorize_transactions(transactions)

unmapped = categorized[categorized["category"] == DEFAULT_CATEGORY]["description"].dropna().unique().tolist()
manual_map = {}
if unmapped:
    st.markdown("#### Review Unmapped Transactions")
    st.caption("Assign a category for each unmapped description. Choices persist only in current session.")
    categories = list(CATEGORY_RULES.keys()) + [DEFAULT_CATEGORY]
    for description in unmapped:
        selected = st.selectbox(
            f"Category for: {description}",
            options=categories,
            key=f"manual_cat_{description}",
        )
        if selected != DEFAULT_CATEGORY:
            manual_map[description] = selected

categorized = apply_manual_categories(categorized, manual_map)

if not categorized.empty:
    st.dataframe(categorized, use_container_width=True, hide_index=True)

expense_summary = category_expense_summary(categorized)
annual_expenses = annual_expense_from_transactions(categorized)

st.markdown("---")
st.subheader("Module 2: Net Worth and Real Estate Ledger")

re_summary = real_estate_summary(properties, reserve_rate)
estimated_equity = total_estimated_equity(properties)
current_net_worth = net_worth(
    liquid_assets=liquid_assets,
    liabilities=liabilities,
    include_equity=include_equity,
    estimated_equity=estimated_equity,
)

ledger_cols = st.columns(4)
ledger_cols[0].metric("Gross Rental Income (Monthly)", f"${re_summary['gross_rent_monthly']:,.0f}")
ledger_cols[1].metric("Total Mortgages (Monthly)", f"${re_summary['mortgage_monthly']:,.0f}")
ledger_cols[2].metric("Reserve (Monthly)", f"${re_summary['reserve_monthly']:,.0f}")
ledger_cols[3].metric("Net Rental Cash Flow (Monthly)", f"${re_summary['net_cashflow_monthly']:,.0f}")

st.markdown("---")
st.subheader("Module 3: FIRE Timeline Engine and Predictive Modeling")

annual_salary = annual_income_with_optional_promotion(
    base_salary=base_salary,
    promotion_enabled=promotion_enabled,
    promotion_bump_pct=promotion_bump,
    promotion_in_month=promotion_month,
)

current_year = datetime.today().year
default_roth_limit = roth_ira_limit_for_year(current_year)
roth_limit = st.number_input(
    f"Roth IRA annual limit per person ({current_year})",
    value=float(default_roth_limit),
    step=100.0,
)

contrib = annual_contributions(
    annual_salary=annual_salary,
    children_count=target_children,
    roth_limit=roth_limit,
)

annual_household_income = annual_salary + (secondary_income_monthly * 12.0)
annual_after_tax_income = annual_household_income * (1.0 - tax_rate)
annual_net_rental_cashflow = re_summary["net_cashflow_monthly"] * 12.0

# 529 contributions are intentionally treated as non-retirement outflow, which slows FIRE.
annual_surplus_after_expenses = max(
    annual_after_tax_income + annual_net_rental_cashflow - annual_expenses - contrib["annual_529"],
    0.0,
)

annual_retirement_investing = (
    contrib["employee_401k"] + contrib["employer_401k_match"] + contrib["roth_total"] + annual_surplus_after_expenses
)

required_draw, fire_number = fire_target(
    annual_expenses=annual_expenses,
    annual_net_rental_cashflow=annual_net_rental_cashflow,
    safe_withdrawal_rate=swr,
)

projection = project_portfolio_growth(
    start_portfolio=starting_portfolio,
    annual_contribution=annual_retirement_investing,
    cagr=cagr,
    years=25,
)
fire_year = estimate_fire_year(projection, fire_number)

horizons = [10, 15, 20, 25]
horizon_values = {}
for h in horizons:
    row = projection[projection["year_offset"] == h]
    horizon_values[h] = float(row.iloc[0]["portfolio"]) if not row.empty else 0.0

st.markdown("---")
st.subheader("Module 4: Dashboard Metrics and Visualizations")

monthly_after_tax_income = (annual_after_tax_income + annual_net_rental_cashflow) / 12.0
monthly_expenses = annual_expenses / 12.0
monthly_529 = contrib["annual_529"] / 12.0
monthly_savings_rate = 0.0
if monthly_after_tax_income > 0:
    monthly_savings_rate = max((monthly_after_tax_income - monthly_expenses - monthly_529) / monthly_after_tax_income, 0.0)

m1, m2, m3 = st.columns(3)
m1.metric("Current Net Worth", f"${current_net_worth:,.0f}")
m2.metric("Monthly Net Savings Rate", f"{monthly_savings_rate * 100:,.1f}%")
m3.metric("Target FIRE Number", f"${fire_number:,.0f}")

if fire_year:
    st.success(f"Projected FIRE year: {fire_year}")
else:
    st.info("Projection does not reach FIRE target within 25 years under current assumptions.")

snap_cols = st.columns(4)
for idx, h in enumerate(horizons):
    snap_cols[idx].metric(f"{h}-Year Projection", f"${horizon_values[h]:,.0f}")

chart_col1, chart_col2 = st.columns(2)
with chart_col1:
    st.plotly_chart(net_worth_projection_chart(projection, fire_number), use_container_width=True)
with chart_col2:
    st.plotly_chart(expense_donut_chart(expense_summary), use_container_width=True)

st.plotly_chart(
    cashflow_waterfall_chart(
        annual_after_tax_income=annual_after_tax_income,
        annual_expenses=annual_expenses * (1.0 + inflation_rate),
        annual_529=contrib["annual_529"],
        annual_retirement_investing=annual_retirement_investing,
        annual_net_rental_cashflow=annual_net_rental_cashflow,
    ),
    use_container_width=True,
)

with st.expander("Calculation Notes"):
    st.markdown(
        "\n".join(
            [
                f"- Annual expense baseline from parsed transactions: ${annual_expenses:,.0f}.",
                f"- FIRE required portfolio draw: ${required_draw:,.0f} per year using SWR {swr * 100:.1f}%.",
                f"- 401(k) employee contribution at 6%: ${contrib['employee_401k']:,.0f}.",
                f"- 401(k) employer match at 3%: ${contrib['employer_401k_match']:,.0f}.",
                f"- Total Roth IRA contributions (2 adults): ${contrib['roth_total']:,.0f}.",
                f"- 529 total annual contribution for {target_children} children: ${contrib['annual_529']:,.0f}.",
            ]
        )
    )
