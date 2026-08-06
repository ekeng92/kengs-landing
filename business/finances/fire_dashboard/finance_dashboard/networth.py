from typing import Dict, List

from .models import RentalProperty


def real_estate_summary(properties: List[RentalProperty], reserve_pct: float) -> Dict[str, float]:
    gross_rent = sum(p.monthly_rent for p in properties)
    mortgage_total = sum(p.monthly_mortgage for p in properties)
    reserve = gross_rent * reserve_pct
    net_cashflow = gross_rent - mortgage_total - reserve

    return {
        "gross_rent_monthly": gross_rent,
        "mortgage_monthly": mortgage_total,
        "reserve_monthly": reserve,
        "net_cashflow_monthly": net_cashflow,
    }


def total_estimated_equity(properties: List[RentalProperty]) -> float:
    return sum(p.estimated_equity for p in properties)


def net_worth(
    liquid_assets: float,
    liabilities: float,
    include_equity: bool,
    estimated_equity: float,
) -> float:
    base = liquid_assets - liabilities
    return base + estimated_equity if include_equity else base
