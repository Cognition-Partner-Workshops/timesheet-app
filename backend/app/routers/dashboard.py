from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Interview, User, Question, Feedback
from app.schemas import DashboardStats

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_interviews = db.query(Interview).count()
    upcoming = (
        db.query(Interview).filter(Interview.status == "scheduled").count()
    )
    completed = (
        db.query(Interview).filter(Interview.status == "completed").count()
    )
    total_candidates = (
        db.query(User).filter(User.role == "candidate").count()
    )
    total_questions = db.query(Question).count()

    avg_score = db.query(func.avg(Feedback.overall_score)).scalar()

    return DashboardStats(
        total_interviews=total_interviews,
        upcoming_interviews=upcoming,
        completed_interviews=completed,
        total_candidates=total_candidates,
        total_questions=total_questions,
        average_score=round(avg_score, 2) if avg_score else None,
    )
