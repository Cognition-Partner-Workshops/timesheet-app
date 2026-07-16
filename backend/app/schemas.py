from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# User schemas
class UserBase(BaseModel):
    email: str
    full_name: str
    role: str = "candidate"
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


# Question schemas
class QuestionBase(BaseModel):
    title: str
    description: str
    difficulty: str = "medium"
    category: str
    tags: Optional[str] = None
    sample_input: Optional[str] = None
    sample_output: Optional[str] = None
    solution: Optional[str] = None
    time_limit_minutes: int = 30


class QuestionCreate(QuestionBase):
    pass


class QuestionResponse(QuestionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class QuestionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[str] = None
    sample_input: Optional[str] = None
    sample_output: Optional[str] = None
    solution: Optional[str] = None
    time_limit_minutes: Optional[int] = None


# Interview schemas
class InterviewBase(BaseModel):
    title: str
    description: Optional[str] = None
    interviewer_id: int
    candidate_id: int
    scheduled_at: datetime
    duration_minutes: int = 60
    meeting_link: Optional[str] = None
    notes: Optional[str] = None
    panel_id: Optional[int] = None


class InterviewCreate(InterviewBase):
    question_ids: Optional[List[int]] = None


class InterviewResponse(InterviewBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    interviewer: Optional[UserResponse] = None
    candidate: Optional[UserResponse] = None
    interview_questions: Optional[list] = None

    class Config:
        from_attributes = True


class InterviewUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    status: Optional[str] = None
    meeting_link: Optional[str] = None
    notes: Optional[str] = None


# Feedback schemas
class FeedbackBase(BaseModel):
    interview_id: int
    reviewer_id: int
    technical_score: Optional[float] = None
    communication_score: Optional[float] = None
    problem_solving_score: Optional[float] = None
    overall_score: Optional[float] = None
    strengths: Optional[str] = None
    weaknesses: Optional[str] = None
    comments: Optional[str] = None
    recommendation: Optional[str] = None


class FeedbackCreate(FeedbackBase):
    pass


class FeedbackResponse(FeedbackBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Code submission schemas
class CodeSubmissionBase(BaseModel):
    interview_id: int
    question_id: Optional[int] = None
    language: str = "python"
    code: str


class CodeSubmissionCreate(CodeSubmissionBase):
    pass


class CodeSubmissionResponse(CodeSubmissionBase):
    id: int
    output: Optional[str] = None
    submitted_at: datetime

    class Config:
        from_attributes = True


# Auth schemas
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


# Panel schemas
class PanelMemberBase(BaseModel):
    user_id: int
    role_in_panel: str = "member"


class PanelMemberResponse(PanelMemberBase):
    id: int
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class PanelBase(BaseModel):
    name: str
    description: Optional[str] = None


class PanelCreate(PanelBase):
    member_ids: Optional[List[int]] = None


class PanelResponse(PanelBase):
    id: int
    created_at: datetime
    members: Optional[List[PanelMemberResponse]] = None

    class Config:
        from_attributes = True


class PanelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    member_ids: Optional[List[int]] = None


# Dashboard stats
class DashboardStats(BaseModel):
    total_interviews: int
    upcoming_interviews: int
    completed_interviews: int
    total_candidates: int
    total_questions: int
    average_score: Optional[float] = None
