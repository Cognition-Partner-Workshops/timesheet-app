"""Application configuration loaded from environment variables.

All settings have sensible defaults so the app runs out-of-the-box for a demo
without any manual configuration.
"""
from __future__ import annotations

import os
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load a local .env file if present (no-op in production / CI).
load_dotenv()

# Directory that contains the `app/` package (i.e. the backend root).
BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _resolve_snapshot_date() -> date:
    """The 'today' used for every availability calculation.

    Pinned to the dataset snapshot by default so demos are reproducible.
    """
    raw = os.getenv("INSYNC_SNAPSHOT_DATE", "2026-06-22")
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        return date.today()


SNAPSHOT_DATE: date = _resolve_snapshot_date()
FRONTEND_URL: str = os.getenv("INSYNC_FRONTEND_URL", "http://localhost:5173")

# --------------------------------------------------------------------------- #
# PostgreSQL + pgvector. The sole data source for the app (employees,         #
# opportunities, capacity, skills) and the chatbot retrieval layer. The Excel  #
# workbook is no longer used; if Postgres is unreachable the store is empty.   #
# --------------------------------------------------------------------------- #
PG_ENABLED: bool = (os.getenv("TB_PG_ENABLED", "true") or "true").lower() == "true"
PG_HOST: str = os.getenv("PGHOST", "localhost")
PG_PORT: int = int(os.getenv("PGPORT", "5432"))
PG_DATABASE: str = os.getenv("PGDATABASE", "insync_wfp")
PG_USER: str = os.getenv("PGUSER", "postgres")
PG_PASSWORD: str = os.getenv("PGPASSWORD", "postgres")

# Fernet key used by the loader to encrypt employee names at rest. When present
# the backend decrypts names for display; otherwise the masked token is shown.
FERNET_KEY: str = os.getenv("FERNET_KEY", "")

# Secret used to sign demo auth tokens. A random default is fine for a demo;
# set TB_AUTH_SECRET in the environment for anything longer-lived.
AUTH_SECRET: str = os.getenv("TB_AUTH_SECRET", "talentbridge-demo-secret-change-me")

# --------------------------------------------------------------------------- #
# LLM provider abstraction.                                                     #
#                                                                               #
# The provider is selected ONLY by the LLM_PROVIDER environment variable        #
# (gemini | openai | azure | mock). Switching providers is an environment       #
# change only — no business logic, prompt, retrieval or RBAC code changes.      #
# API keys come exclusively from environment variables; nothing is hardcoded.   #
#                                                                               #
# Dev default provider: gemini. Prod: openai. When the selected provider has    #
# no usable key the app degrades safely to the deterministic "mock" provider.   #
# --------------------------------------------------------------------------- #
# ``INSYNC_AI_PROVIDER`` is kept as a backwards-compatible alias for the older
# config name; ``LLM_PROVIDER`` takes precedence when both are set.
LLM_PROVIDER: str = (
    os.getenv("LLM_PROVIDER")
    or os.getenv("INSYNC_AI_PROVIDER")
    or "mock"
).lower()

# Back-compat alias used by older modules.
AI_PROVIDER: str = LLM_PROVIDER

GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

AZURE_OPENAI_API_KEY: str = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_ENDPOINT: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_DEPLOYMENT: str = os.getenv("AZURE_OPENAI_DEPLOYMENT", "")
AZURE_OPENAI_API_VERSION: str = os.getenv(
    "AZURE_OPENAI_API_VERSION", "2024-08-01-preview"
)


def provider_has_key(provider: Optional[str] = None) -> bool:
    """Return True when the given (or configured) provider has usable creds."""
    provider = (provider or LLM_PROVIDER).lower()
    if provider == "gemini":
        return bool(GEMINI_API_KEY)
    if provider == "openai":
        return bool(OPENAI_API_KEY)
    if provider == "azure":
        return bool(
            AZURE_OPENAI_API_KEY
            and AZURE_OPENAI_ENDPOINT
            and AZURE_OPENAI_DEPLOYMENT
        )
    return False  # "mock" or unknown -> deterministic mode


def ai_enabled() -> bool:
    """Return True when a real (non-mock) AI provider is configured and usable."""
    return LLM_PROVIDER != "mock" and provider_has_key(LLM_PROVIDER)
