"""SQLAlchemy database models for persisting vulnerability data."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class VulnerabilityRecord(Base):
    __tablename__ = "vulnerabilities"

    id = Column(String(36), primary_key=True, default=_new_uuid)
    vulnerability_type = Column(String(64), nullable=False, index=True)
    severity = Column(String(16), nullable=False, index=True)
    confidence = Column(Float, nullable=False, default=0.0)
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=False)
    file_path = Column(String(512), nullable=True)
    line_start = Column(Integer, nullable=True)
    line_end = Column(Integer, nullable=True)
    cve_id = Column(String(32), nullable=True, index=True)
    cwe_ids = Column(Text, nullable=True)
    affected_code = Column(Text, nullable=True)
    scan_result_id = Column(String(36), ForeignKey("scan_results.id"), nullable=True)
    detected_at = Column(DateTime, default=_utcnow, nullable=False)

    scan_result = relationship("ScanResultRecord", back_populates="vulnerabilities")
    mitigations = relationship(
        "MitigationRecord", back_populates="vulnerability", cascade="all, delete-orphan"
    )


class MitigationRecord(Base):
    __tablename__ = "mitigations"

    id = Column(String(36), primary_key=True, default=_new_uuid)
    vulnerability_id = Column(String(36), ForeignKey("vulnerabilities.id"), nullable=False)
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=False)
    suggested_fix = Column(Text, nullable=True)
    references = Column(Text, nullable=True)
    priority = Column(Integer, default=3)
    estimated_effort = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    vulnerability = relationship("VulnerabilityRecord", back_populates="mitigations")


class ScanResultRecord(Base):
    __tablename__ = "scan_results"

    id = Column(String(36), primary_key=True, default=_new_uuid)
    status = Column(String(16), nullable=False, default="pending")
    target = Column(String(512), nullable=False)
    language = Column(String(32), nullable=True)
    files_scanned = Column(Integer, default=0)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)

    vulnerabilities = relationship(
        "VulnerabilityRecord", back_populates="scan_result", cascade="all, delete-orphan"
    )


class CVECacheRecord(Base):
    __tablename__ = "cve_cache"

    cve_id = Column(String(32), primary_key=True)
    description = Column(Text, nullable=False)
    severity = Column(String(16), nullable=False)
    cvss_score = Column(Float, nullable=True)
    cwe_ids = Column(Text, nullable=True)
    affected_products = Column(Text, nullable=True)
    references = Column(Text, nullable=True)
    published_date = Column(DateTime, nullable=True)
    last_modified_date = Column(DateTime, nullable=True)
    exploit_available = Column(Boolean, default=False)
    fetched_at = Column(DateTime, default=_utcnow, nullable=False)
