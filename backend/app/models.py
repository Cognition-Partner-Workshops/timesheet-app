from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Enum, Float, Boolean
)
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    INTERVIEWER = "interviewer"
    CANDIDATE = "candidate"


class InterviewStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class QuestionDifficulty(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default=UserRole.CANDIDATE)
    avatar_url = Column(String(500), nullable=True)
    phone = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    interviews_as_interviewer = relationship(
        "Interview", back_populates="interviewer", foreign_keys="Interview.interviewer_id"
    )
    interviews_as_candidate = relationship(
        "Interview", back_populates="candidate", foreign_keys="Interview.candidate_id"
    )
    feedbacks = relationship("Feedback", back_populates="reviewer")


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    interviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=60)
    status = Column(String(50), default=InterviewStatus.SCHEDULED)
    meeting_link = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    panel_id = Column(Integer, ForeignKey("panels.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    interviewer = relationship(
        "User", back_populates="interviews_as_interviewer", foreign_keys=[interviewer_id]
    )
    candidate = relationship(
        "User", back_populates="interviews_as_candidate", foreign_keys=[candidate_id]
    )
    panel = relationship("Panel", back_populates="interviews")
    interview_questions = relationship("InterviewQuestion", back_populates="interview")
    feedbacks = relationship("Feedback", back_populates="interview")
    code_submissions = relationship("CodeSubmission", back_populates="interview")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    difficulty = Column(String(50), default=QuestionDifficulty.MEDIUM)
    category = Column(String(100), nullable=False)
    tags = Column(String(500), nullable=True)
    sample_input = Column(Text, nullable=True)
    sample_output = Column(Text, nullable=True)
    solution = Column(Text, nullable=True)
    time_limit_minutes = Column(Integer, default=30)
    created_at = Column(DateTime, default=datetime.utcnow)

    interview_questions = relationship("InterviewQuestion", back_populates="question")


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    order = Column(Integer, default=0)

    interview = relationship("Interview", back_populates="interview_questions")
    question = relationship("Question", back_populates="interview_questions")


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    technical_score = Column(Float, nullable=True)
    communication_score = Column(Float, nullable=True)
    problem_solving_score = Column(Float, nullable=True)
    overall_score = Column(Float, nullable=True)
    strengths = Column(Text, nullable=True)
    weaknesses = Column(Text, nullable=True)
    comments = Column(Text, nullable=True)
    recommendation = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    interview = relationship("Interview", back_populates="feedbacks")
    reviewer = relationship("User", back_populates="feedbacks")


class CodeSubmission(Base):
    __tablename__ = "code_submissions"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=True)
    language = Column(String(50), default="python")
    code = Column(Text, nullable=False)
    output = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    interview = relationship("Interview", back_populates="code_submissions")


class Panel(Base):
    __tablename__ = "panels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    members = relationship("PanelMember", back_populates="panel", cascade="all, delete-orphan")
    interviews = relationship("Interview", back_populates="panel")


class PanelMember(Base):
    __tablename__ = "panel_members"

    id = Column(Integer, primary_key=True, index=True)
    panel_id = Column(Integer, ForeignKey("panels.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role_in_panel = Column(String(50), default="member")

    panel = relationship("Panel", back_populates="members")
    user = relationship("User")
