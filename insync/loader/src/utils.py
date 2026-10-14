"""Shared parsing and normalization helpers."""

from __future__ import annotations

import math
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional

import numpy as np
import pandas as pd


def is_blank(value: Any) -> bool:
    if value is None:
        return True
    try:
        if pd.isna(value):
            return True
    except Exception:
        pass
    if isinstance(value, str) and value.strip() == "":
        return True
    return False


def clean_text(value: Any) -> Optional[str]:
    if is_blank(value):
        return None
    return str(value).strip()


def to_float(value: Any, default: Optional[float] = None) -> Optional[float]:
    if is_blank(value):
        return default
    try:
        return float(value)
    except Exception:
        return default


def to_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    if is_blank(value):
        return default
    try:
        return int(float(value))
    except Exception:
        return default


def to_bool(value: Any, default: bool = False) -> bool:
    if is_blank(value):
        return default
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    return text in {"yes", "y", "true", "1", "allowed", "can", "t"}


def to_date(value: Any) -> Optional[date]:
    if is_blank(value):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        return pd.to_datetime(value).date()
    except Exception:
        return None


def json_safe(value: Any) -> Any:
    if is_blank(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        if math.isnan(float(value)):
            return None
        return float(value)
    if isinstance(value, np.bool_):
        return bool(value)
    return value


def make_employee_token(employee_code: str) -> str:
    code = clean_text(employee_code)
    if not code:
        return "CUNKNOWN"
    digits = "".join(ch for ch in code if ch.isdigit())
    if digits:
        return f"C{digits.zfill(4)}"
    return f"C{abs(hash(code)) % 100000:05d}"


def parse_skill_array(value: Any) -> List[str]:
    if is_blank(value):
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if not is_blank(v)]

    text = str(value)
    parts = []
    for chunk in text.replace(",", ";").split(";"):
        item = chunk.strip()
        if item:
            parts.append(item)
    return list(dict.fromkeys(parts))


def join_non_empty(parts: Iterable[Any], separator: str = " | ") -> Optional[str]:
    cleaned = [str(p).strip() for p in parts if not is_blank(p)]
    if not cleaned:
        return None
    return separator.join(cleaned)


def df_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    if df is None or df.empty:
        return []
    return df.replace({np.nan: None}).to_dict(orient="records")


def get_sheet(sheets: Dict[str, pd.DataFrame], name: str) -> pd.DataFrame:
    return sheets.get(name, pd.DataFrame())
