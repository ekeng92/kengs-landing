from dataclasses import dataclass
from typing import List


@dataclass
class RentalProperty:
    name: str
    monthly_mortgage: float
    monthly_rent: float
    owned_outright: bool = False
    estimated_equity: float = 0.0


@dataclass
class FinancialProfile:
    base_salary: float
    secondary_income_monthly: float
    liquid_assets: float
    liabilities: float
    properties: List[RentalProperty]
