"""Application configuration loaded from environment variables.

All settings have sensible defaults so the app runs out-of-the-box for a demo
without any manual configuration.
"""
from __future__ import annotations

import os
from datetime import date, datetime
from pathlib import Path

from dotenv import load_dotenv

# Load a local .env file if present (no-op in production / CI).
load_dotenv()

# Directory that contains the `app/` package (i.e. the backend root).
BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _resolve_data_file() -> Path:
    """Resolve the workforce workbook path relative to the backend root."""
    raw = os.getenv("INSYNC_DATA_FILE", "data/workforce_dataset.xlsx")
    path = Path(raw)
    if not path.is_absolute():
        path = BACKEND_ROOT / path
    return path


def _resolve_snapshot_date() -> date:
    """The 'today' used for every availability calculation.

    Pinned to the dataset snapshot by default so demos are reproducible.
    """
    raw = os.getenv("INSYNC_SNAPSHOT_DATE", "2026-06-22")
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        return date.today()


DATA_FILE: Path = _resolve_data_file()
SNAPSHOT_DATE: date = _resolve_snapshot_date()
FRONTEND_URL: str = os.getenv("INSYNC_FRONTEND_URL", "http://localhost:5173")

# AI provider selection: "mock" (default), "openai", or "azure".
AI_PROVIDER: str = (os.getenv("INSYNC_AI_PROVIDER", "mock") or "mock").lower()

OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

AZURE_OPENAI_API_KEY: str = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_ENDPOINT: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_DEPLOYMENT: str = os.getenv("AZURE_OPENAI_DEPLOYMENT", "")
AZURE_OPENAI_API_VERSION: str = os.getenv(
    "AZURE_OPENAI_API_VERSION", "2024-08-01-preview"
)


def ai_enabled() -> bool:
    """Return True when a real AI provider is configured and usable."""
    if AI_PROVIDER == "openai":
        return bool(OPENAI_API_KEY)
    if AI_PROVIDER == "azure":
        return bool(
            AZURE_OPENAI_API_KEY
            and AZURE_OPENAI_ENDPOINT
            and AZURE_OPENAI_DEPLOYMENT
        )
    return False
