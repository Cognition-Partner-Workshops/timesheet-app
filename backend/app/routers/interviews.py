from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime

from app.database import get_db
from app.models import Interview, InterviewQuestion, User
from app.schemas import InterviewCreate, InterviewResponse, InterviewUpdate

router = APIRouter(prefix="/api/interviews", tags=["Interviews"])


@router.get("/", response_model=List[InterviewResponse])
def get_interviews(
    status: str = None,
    interviewer_id: int = None,
    candidate_id: int = None,
    db: Session = Depends(get_db),
):
    query = db.query(Interview).options(
        joinedload(Interview.interviewer),
        joinedload(Interview.candidate),
    )
    if status:
        query = query.filter(Interview.status == status)
    if interviewer_id:
        query = query.filter(Interview.interviewer_id == interviewer_id)
    if candidate_id:
        query = query.filter(Interview.candidate_id == candidate_id)
    return query.order_by(Interview.scheduled_at.desc()).all()


@router.get("/{interview_id}", response_model=InterviewResponse)
def get_interview(interview_id: int, db: Session = Depends(get_db)):
    interview = (
        db.query(Interview)
        .options(
            joinedload(Interview.interviewer),
            joinedload(Interview.candidate),
            joinedload(Interview.interview_questions),
        )
        .filter(Interview.id == interview_id)
        .first()
    )
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview


@router.post("/", response_model=InterviewResponse)
def create_interview(data: InterviewCreate, db: Session = Depends(get_db)):
    interviewer = db.query(User).filter(User.id == data.interviewer_id).first()
    if not interviewer:
        raise HTTPException(status_code=404, detail="Interviewer not found")

    candidate = db.query(User).filter(User.id == data.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    interview = Interview(
        title=data.title,
        description=data.description,
        interviewer_id=data.interviewer_id,
        candidate_id=data.candidate_id,
        scheduled_at=data.scheduled_at,
        duration_minutes=data.duration_minutes,
        meeting_link=data.meeting_link,
        notes=data.notes,
        panel_id=data.panel_id,
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)

    if data.question_ids:
        for i, qid in enumerate(data.question_ids):
            iq = InterviewQuestion(
                interview_id=interview.id, question_id=qid, order=i
            )
            db.add(iq)
        db.commit()

    return (
        db.query(Interview)
        .options(joinedload(Interview.interviewer), joinedload(Interview.candidate))
        .filter(Interview.id == interview.id)
        .first()
    )


@router.put("/{interview_id}", response_model=InterviewResponse)
def update_interview(
    interview_id: int, data: InterviewUpdate, db: Session = Depends(get_db)
):
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(interview, field, value)
    interview.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(interview)
    return interview


@router.delete("/{interview_id}")
def delete_interview(interview_id: int, db: Session = Depends(get_db)):
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    db.delete(interview)
    db.commit()
    return {"message": "Interview deleted successfully"}
