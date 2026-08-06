from datetime import datetime, timedelta

import pandas as pd

from .models import FinancialProfile, RentalProperty


def baseline_profile() -> FinancialProfile:
    return FinancialProfile(
        base_salary=155000.0,
        secondary_income_monthly=1000.0,
        liquid_assets=300000.0,
        liabilities=0.0,
        properties=[
            RentalProperty(name="Property 1", monthly_mortgage=1100.0, monthly_rent=1850.0),
            RentalProperty(name="Property 2", monthly_mortgage=2500.0, monthly_rent=2800.0),
            RentalProperty(
                name="Property 3",
                monthly_mortgage=0.0,
                monthly_rent=1500.0,
                owned_outright=True,
            ),
        ],
    )


def sample_expense_transactions() -> pd.DataFrame:
    today = datetime.today().date().replace(day=1)
    records = []
    monthly_transactions = [
        ("Mortgage Payment", -3600),
        ("Whole Foods Market", -620),
        ("AT&T Internet", -95),
        ("Netflix", -24),
        ("Progressive Insurance", -320),
        ("Daycare Tuition", -900),
        ("Electric Utility", -230),
        ("Dining - Local Restaurant", -280),
        ("Amazon", -210),
    ]

    for month_back in range(0, 6):
        month_start = (today - timedelta(days=30 * month_back)).replace(day=1)
        for idx, (description, amount) in enumerate(monthly_transactions):
            records.append(
                {
                    "date": month_start + timedelta(days=idx + 1),
                    "description": description,
                    "amount": float(amount),
                }
            )

    return pd.DataFrame(records)
