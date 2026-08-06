import re
from typing import Dict

import pandas as pd


CATEGORY_RULES = {
    "Housing": [r"mortgage", r"rent", r"hoa", r"property tax"],
    "Food/Dining": [r"restaurant", r"cafe", r"dining", r"whole foods", r"trader joe", r"ubereats"],
    "Utilities": [r"utility", r"electric", r"water", r"internet", r"at&t", r"comcast", r"verizon"],
    "Entertainment/Subscriptions": [r"netflix", r"spotify", r"hulu", r"disney", r"prime", r"subscription"],
    "Insurance": [r"insurance", r"progressive", r"geico", r"state farm"],
    "Child Expenses": [r"daycare", r"school", r"kid", r"baby", r"child", r"529", r"tuition"],
}

DEFAULT_CATEGORY = "Uncategorized"


def categorize_transactions(transactions: pd.DataFrame) -> pd.DataFrame:
    df = transactions.copy()
    if df.empty:
        df["category"] = []
        df["matched_rule"] = []
        return df

    categories = []
    matched_rules = []

    for description in df["description"].astype(str):
        lower_desc = description.lower()
        assigned = DEFAULT_CATEGORY
        rule = ""

        for category, patterns in CATEGORY_RULES.items():
            found = next((p for p in patterns if re.search(p, lower_desc)), None)
            if found:
                assigned = category
                rule = found
                break

        categories.append(assigned)
        matched_rules.append(rule)

    df["category"] = categories
    df["matched_rule"] = matched_rules
    return df


def apply_manual_categories(transactions: pd.DataFrame, manual_map: Dict[str, str]) -> pd.DataFrame:
    if transactions.empty or not manual_map:
        return transactions

    df = transactions.copy()
    mask = df["description"].isin(manual_map.keys())
    df.loc[mask, "category"] = df.loc[mask, "description"].map(manual_map)
    return df


def category_expense_summary(transactions: pd.DataFrame) -> pd.DataFrame:
    if transactions.empty:
        return pd.DataFrame(columns=["category", "expense"])

    expenses = transactions[transactions["amount"] < 0].copy()
    if expenses.empty:
        return pd.DataFrame(columns=["category", "expense"])

    summary = (
        expenses.groupby("category", dropna=False)["amount"]
        .sum()
        .abs()
        .reset_index(name="expense")
        .sort_values("expense", ascending=False)
    )
    return summary
