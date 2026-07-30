from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.config import FRONTEND_URL
from src.database import initialize_database
from src.routes import auth, clients, reports, work_entries


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "x-user-email"],
)

app.include_router(auth.router)
app.include_router(clients.router)
app.include_router(work_entries.router)
app.include_router(reports.router)


@app.get("/health")
def health():
    return {"status": "OK", "timestamp": datetime.now(tz=timezone.utc).isoformat()}


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=400, content={"error": "Validation error"})
