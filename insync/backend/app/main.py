"""FastAPI application entrypoint for the InSync Workforce Planning Assistant."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, llm, rag
from .data_layer import get_store
from .routers import (
    auth,
    chat,
    dashboard,
    ewa,
    notifications,
    opportunities,
    people,
    recommend,
    workflow,
)

app = FastAPI(
    title="TalentBridge Workforce Planning Assistant",
    description=(
        "AI-assisted workforce planning: evidence-backed staffing "
        "recommendations from a deterministic scoring engine. "
        "AI surfaces evidence, people decide."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(dashboard.router)
app.include_router(people.router)
app.include_router(opportunities.router)
app.include_router(recommend.router)
app.include_router(ewa.router)
app.include_router(workflow.router)
app.include_router(notifications.router)


@app.on_event("startup")
def _warm_store() -> None:
    """Eagerly load the workbook, log the LLM provider, build local vectors."""
    get_store()
    # Log the resolved provider (never logs secrets).
    llm.log_provider_selection()
    # Build the local vector store from rag_documents so retrieval keeps working
    # as a fallback when pgvector is unavailable. No-op if Postgres is missing.
    try:
        if not rag.local_store_available():
            rag.build_local_store()
    except Exception:  # pragma: no cover - never block startup
        pass


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/meta", tags=["meta"])
def meta() -> dict:
    """Front-end bootstrap data: config flags, vocab and starter prompts."""
    store = get_store()
    return {
        "snapshot_date": store.snapshot_date.isoformat(),
        "ai_enabled": config.ai_enabled(),
        "ai_provider": config.AI_PROVIDER,
        "llm_provider": llm.get_service().provider_name,
        "retrieval_enabled": rag.retrieval_enabled(),
        "retrieval_backend": rag.active_backend(),
        "skills": store.skill_vocabulary(),
        "domains": sorted({e.get("primary_domain") for e in store.all_employees() if e.get("primary_domain")}),
        "regions": sorted({e.get("region") for e in store.all_employees() if e.get("region")}),
        "countries": sorted({e.get("country") for e in store.all_employees() if e.get("country")}),
        "grades": sorted({e.get("grade") for e in store.all_employees() if e.get("grade")}),
        "roles": sorted({e.get("role_archetype") for e in store.all_employees() if e.get("role_archetype")}),
        "availability_categories": sorted(
            {e.get("availability_category") for e in store.all_employees() if e.get("availability_category")}
        ),
        "starter_prompts": store.starter_prompt_list(),
    }
