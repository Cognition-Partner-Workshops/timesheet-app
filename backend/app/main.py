from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import auth, users, interviews, questions, feedback, code, dashboard, panels
from app.seed import seed_database

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="InterviewHub API",
    description="A comprehensive interview management platform API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(interviews.router)
app.include_router(questions.router)
app.include_router(feedback.router)
app.include_router(code.router)
app.include_router(dashboard.router)
app.include_router(panels.router)


@app.on_event("startup")
def startup():
    seed_database()


@app.get("/")
def root():
    return {"message": "Welcome to InterviewHub API", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}
