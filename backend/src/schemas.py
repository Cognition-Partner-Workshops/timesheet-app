import re
from typing import Optional

from pydantic import BaseModel, field_validator


class LoginRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        pattern = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
        if not re.match(pattern, v):
            raise ValueError("Invalid email format")
        return v


class CreateClientRequest(BaseModel):
    name: str
    description: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 255:
            raise ValueError("Name must be 1-255 characters")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v != "":
            pattern = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
            if not re.match(pattern, v):
                raise ValueError("Invalid email format")
        return v or None


class UpdateClientRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v != "":
            pattern = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
            if not re.match(pattern, v):
                raise ValueError("Invalid email format")
        return v


class CreateWorkEntryRequest(BaseModel):
    clientId: int
    hours: float
    description: Optional[str] = None
    date: str

    @field_validator("hours")
    @classmethod
    def hours_positive(cls, v: float) -> float:
        if v <= 0 or v > 24:
            raise ValueError("Hours must be between 0 and 24")
        return round(v, 2)

    @field_validator("clientId")
    @classmethod
    def client_id_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("clientId must be a positive integer")
        return v


class UpdateWorkEntryRequest(BaseModel):
    clientId: Optional[int] = None
    hours: Optional[float] = None
    description: Optional[str] = None
    date: Optional[str] = None

    @field_validator("hours")
    @classmethod
    def hours_positive(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v <= 0 or v > 24):
            raise ValueError("Hours must be between 0 and 24")
        return round(v, 2) if v is not None else None
