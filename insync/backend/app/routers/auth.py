"""Authentication & sign-up endpoints (username/password, 3 roles)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from .. import auth
from ..auth import ROLE_LABELS, VALID_ROLES
from ..rbac import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignUpRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)
    role: str


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


@router.get("/roles")
def list_roles() -> list[dict]:
    """Roles available on the sign-up page."""
    return [{"value": value, "label": label} for value, label in ROLE_LABELS.items()]


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(req: SignUpRequest) -> AuthResponse:
    if req.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail="Please choose a valid role.")
    try:
        user = auth.get_store().create(req.full_name, str(req.email), req.password, req.role)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return AuthResponse(token=auth.issue_token(user), user=user.public())


@router.post("/signin", response_model=AuthResponse)
def signin(req: SignInRequest) -> AuthResponse:
    user = auth.get_store().get_by_email(str(req.email))
    if not user or not auth.verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return AuthResponse(token=auth.issue_token(user), user=user.public())


@router.get("/me")
def me(user: auth.User = Depends(get_current_user)) -> dict:
    return user.public()
