"""FastAPI application factory."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from threat_intel import __version__
from threat_intel.api.dependencies import init_services
from threat_intel.api.routes import router
from threat_intel.utils.db import close_database, init_database
from threat_intel.utils.logging import configure_logging, get_logger

logger = get_logger(__name__)


def create_app(
    database_url: str = "sqlite+aiosqlite:///./data/threat_intel.db",
    openai_api_key: str = "",
    openai_model: str = "gpt-4",
    nvd_api_key: str | None = None,
    github_token: str | None = None,
    cors_origins: list[str] | None = None,
    api_prefix: str = "/api/v1",
    log_level: str = "INFO",
) -> FastAPI:
    """Create and configure the FastAPI application."""
    configure_logging(log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        logger.info("starting_application", version=__version__)
        await init_database(database_url)
        init_services(
            openai_api_key=openai_api_key,
            openai_model=openai_model,
            nvd_api_key=nvd_api_key,
            github_token=github_token,
        )
        yield
        await close_database()
        logger.info("application_shutdown")

    app = FastAPI(
        title="AI Threat Intelligence Framework",
        description=(
            "AI-Driven Threat Intelligence Framework for Real-Time Cyber Defense "
            "Against Vulnerabilities. Uses LLMs to detect, predict, and mitigate "
            "software vulnerabilities."
        ),
        version=__version__,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    origins = cors_origins or ["http://localhost:3000"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router, prefix=api_prefix)

    return app
