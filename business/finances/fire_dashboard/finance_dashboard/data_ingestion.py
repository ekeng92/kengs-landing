import io
import re
from datetime import datetime
from typing import Optional

import pandas as pd


DATE_CANDIDATES = [
    "%m/%d/%Y",
    "%m/%d/%y",
    "%m/%d",
    "%Y-%m-%d",
    "%b %d %Y",
    "%b %d, %Y",
]


def _parse_date(value: str) -> Optional[pd.Timestamp]:
    raw = str(value).strip()
    if not raw:
        return None

    for fmt in DATE_CANDIDATES:
        try:
            parsed = datetime.strptime(raw, fmt)
            if fmt == "%m/%d":
                parsed = parsed.replace(year=datetime.today().year)
            return pd.Timestamp(parsed.date())
        except ValueError:
            continue

    parsed = pd.to_datetime(raw, errors="coerce")
    return parsed if pd.notna(parsed) else None


def parse_currency(value: str) -> float:
    if value is None:
        return 0.0

    raw = str(value).strip()
    if raw == "":
        return 0.0

    negative = "(" in raw and ")" in raw
    cleaned = re.sub(r"[^0-9.\-]", "", raw)
    if cleaned in {"", "-"}:
        return 0.0

    amount = float(cleaned)
    return -abs(amount) if negative else amount


def normalize_transactions(df: pd.DataFrame) -> pd.DataFrame:
    work = df.copy()
    col_lookup = {c.lower().strip(): c for c in work.columns}

    date_col = next(
        (
            col_lookup[c]
            for c in ["date", "posting date", "transaction date", "posted date"]
            if c in col_lookup
        ),
        None,
    )
    description_col = next(
        (
            col_lookup[c]
            for c in ["description", "merchant", "details", "transaction description"]
            if c in col_lookup
        ),
        None,
    )

    amount_col = next(
        (
            col_lookup[c]
            for c in ["amount", "transaction amount", "value"]
            if c in col_lookup
        ),
        None,
    )

    debit_col = next((col_lookup[c] for c in ["debit", "withdrawal"] if c in col_lookup), None)
    credit_col = next((col_lookup[c] for c in ["credit", "deposit"] if c in col_lookup), None)

    if not date_col or not description_col:
        raise ValueError("Unable to identify date/description columns in uploaded data.")

    result = pd.DataFrame()
    result["date"] = work[date_col].apply(_parse_date)
    result["description"] = work[description_col].astype(str).str.strip()

    if amount_col:
        result["amount"] = work[amount_col].apply(parse_currency)
    elif debit_col or credit_col:
        debit = work[debit_col].apply(parse_currency) if debit_col else 0.0
        credit = work[credit_col].apply(parse_currency) if credit_col else 0.0
        result["amount"] = credit - debit
    else:
        raise ValueError("Unable to identify an amount column in uploaded data.")

    result = result.dropna(subset=["date", "description"])
    result["amount"] = pd.to_numeric(result["amount"], errors="coerce").fillna(0.0)
    return result.sort_values("date").reset_index(drop=True)


def parse_chase_text(raw_text: str) -> pd.DataFrame:
    rows = []
    line_pattern = re.compile(
        r"^(?P<date>[0-9]{1,2}[/-][0-9]{1,2}(?:[/-][0-9]{2,4})?)\s+(?P<description>.*?)\s+(?P<amount>[-$()0-9,\.]+)$"
    )

    for line in raw_text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue

        match = line_pattern.match(stripped)
        if not match:
            continue

        rows.append(
            {
                "date": _parse_date(match.group("date")),
                "description": match.group("description").strip(),
                "amount": parse_currency(match.group("amount")),
            }
        )

    if not rows:
        raise ValueError(
            "No transactions could be parsed from text. Use CSV upload if your text format differs."
        )

    return pd.DataFrame(rows).sort_values("date").reset_index(drop=True)


def ingest_uploaded_file(uploaded_file) -> pd.DataFrame:
    if uploaded_file is None:
        return pd.DataFrame(columns=["date", "description", "amount"])

    filename = uploaded_file.name.lower()
    payload = uploaded_file.getvalue()

    if filename.endswith(".txt"):
        return parse_chase_text(payload.decode("utf-8", errors="ignore"))

    if filename.endswith(".csv"):
        return normalize_transactions(pd.read_csv(io.BytesIO(payload)))

    raise ValueError("Unsupported file type. Please upload a .csv or .txt file.")
