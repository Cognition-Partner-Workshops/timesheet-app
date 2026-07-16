from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import Feedback
from app.schemas import FeedbackCreate, FeedbackResponse

router = APIRouter(prefix="/api/feedback", tags=["Feedback"])


@router.get("/", response_model=List[FeedbackResponse])
def get_feedbacks(interview_id: int = None, db: Session = Depends(get_db)):
    query = db.query(Feedback)
    if interview_id:
        query = query.filter(Feedback.interview_id == interview_id)
    return query.order_by(Feedback.created_at.desc()).all()


@router.get("/{feedback_id}", response_model=FeedbackResponse)
def get_feedback(feedback_id: int, db: Session = Depends(get_db)):
    feedback = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return feedback


@router.post("/", response_model=FeedbackResponse)
def create_feedback(data: FeedbackCreate, db: Session = Depends(get_db)):
    feedback = Feedback(**data.model_dump())
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


@router.delete("/{feedback_id}")
def delete_feedback(feedback_id: int, db: Session = Depends(get_db)):
    feedback = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    db.delete(feedback)
    db.commit()
    return {"message": "Feedback deleted successfully"}
