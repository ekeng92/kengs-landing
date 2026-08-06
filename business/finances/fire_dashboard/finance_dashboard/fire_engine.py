from datetime import datetime
from typing import Dict, List, Tuple

import pandas as pd


ROTH_IRA_LIMITS = {
    2024: 7000,
    2025: 7000,
    2026: 7000,
}


def roth_ira_limit_for_year(year: int) -> float:
    if year in ROTH_IRA_LIMITS:
        return float(ROTH_IRA_LIMITS[year])
    latest_year = max(ROTH_IRA_LIMITS.keys())
    return float(ROTH_IRA_LIMITS[latest_year])


def annual_income_with_optional_promotion(
    base_salary: float,
    promotion_enabled: bool,
    promotion_bump_pct: float,
    promotion_in_month: int,
) -> float:
    if not promotion_enabled:
        return base_salary

    month = max(1, min(12, promotion_in_month))
    pre_months = month - 1
    post_months = 12 - pre_months

    promoted_salary = base_salary * (1.0 + promotion_bump_pct)
    annualized = (base_salary * pre_months / 12.0) + (promoted_salary * post_months / 12.0)
    return annualized


def annual_contributions(
    annual_salary: float,
    children_count: int,
    roth_limit: float,
    employee_401k_rate: float = 0.06,
    employer_match_rate: float = 0.03,
    monthly_529_per_child: float = 50.0,
) -> Dict[str, float]:
    employee_401k = annual_salary * employee_401k_rate
    employer_match = annual_salary * employer_match_rate
    roth_total = roth_limit * 2.0
    annual_529 = children_count * monthly_529_per_child * 12.0

    return {
        "employee_401k": employee_401k,
        "employer_401k_match": employer_match,
        "roth_total": roth_total,
        "annual_529": annual_529,
        "retirement_total": employee_401k + employer_match + roth_total,
        "all_including_529": employee_401k + employer_match + roth_total + annual_529,
    }


def annual_expense_from_transactions(expense_transactions: pd.DataFrame) -> float:
    if expense_transactions.empty:
        return 0.0

    tx = expense_transactions.copy()
    tx["month"] = tx["date"].dt.to_period("M")
    monthly_expenses = (
        tx[tx["amount"] < 0]
        .groupby("month")["amount"]
        .sum()
        .abs()
    )

    if monthly_expenses.empty:
        return 0.0

    return float(monthly_expenses.mean() * 12.0)


def fire_target(
    annual_expenses: float,
    annual_net_rental_cashflow: float,
    safe_withdrawal_rate: float = 0.04,
) -> Tuple[float, float]:
    required_draw = max(annual_expenses - annual_net_rental_cashflow, 0.0)
    fire_number = required_draw / safe_withdrawal_rate if safe_withdrawal_rate > 0 else float("inf")
    return required_draw, fire_number


def project_portfolio_growth(
    start_portfolio: float,
    annual_contribution: float,
    cagr: float,
    years: int = 25,
) -> pd.DataFrame:
    records: List[Dict[str, float]] = []
    value = start_portfolio
    current_year = datetime.today().year

    records.append({"year": current_year, "year_offset": 0, "portfolio": value})

    for i in range(1, years + 1):
        value = (value * (1.0 + cagr)) + annual_contribution
        records.append({"year": current_year + i, "year_offset": i, "portfolio": value})

    return pd.DataFrame(records)


def estimate_fire_year(projection: pd.DataFrame, fire_number: float) -> int | None:
    if projection.empty or fire_number <= 0:
        return None

    crossed = projection[projection["portfolio"] >= fire_number]
    if crossed.empty:
        return None

    return int(crossed.iloc[0]["year"])
