"""Pydantic request/response schemas for the REST API."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from threat_intel.models.domain import Language, Severity, VulnerabilityType


class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str
    timestamp: datetime


class ScanCodeRequest(BaseModel):
    """Request to scan a code snippet."""

    code: str = Field(..., min_length=1, max_length=100_000)
    language: Language = Language.UNKNOWN
    file_path: str = "<inline>"


class ScanDirectoryRequest(BaseModel):
    """Request to scan a local directory."""

    path: str = Field(..., min_length=1)


class ScanGitRepoRequest(BaseModel):
    """Request to scan a git repository."""

    repo_url: str | None = None
    repo_path: str | None = None
    branch: str = "main"
    from_commit: str | None = None
    to_commit: str | None = None


class VulnerabilityResponse(BaseModel):
    """API response for a single vulnerability."""

    id: UUID
    vulnerability_type: VulnerabilityType
    severity: Severity
    confidence: float
    title: str
    description: str
    file_path: str | None = None
    line_start: int | None = None
    line_end: int | None = None
    cve_id: str | None = None
    cwe_ids: list[str] = Field(default_factory=list)
    detected_at: datetime


class MitigationResponse(BaseModel):
    """API response for a mitigation recommendation."""

    id: UUID
    vulnerability_id: UUID
    title: str
    description: str
    suggested_fix: str | None = None
    references: list[str] = Field(default_factory=list)
    priority: int
    estimated_effort: str | None = None
    created_at: datetime


class ScanResultResponse(BaseModel):
    """API response for a scan result."""

    id: UUID
    status: str
    target: str
    language: str | None = None
    files_scanned: int
    vulnerability_count: int
    critical_count: int
    high_count: int
    vulnerabilities: list[VulnerabilityResponse] = Field(default_factory=list)
    mitigations: list[MitigationResponse] = Field(default_factory=list)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_seconds: float | None = None
    error_message: str | None = None


class CVESearchRequest(BaseModel):
    """Request to search for CVE records."""

    keyword: str | None = None
    cve_id: str | None = None
    severity: str | None = None


class CVEResponse(BaseModel):
    """API response for a CVE record."""

    cve_id: str
    description: str
    severity: Severity
    cvss_score: float | None = None
    cwe_ids: list[str] = Field(default_factory=list)
    affected_products: list[str] = Field(default_factory=list)
    references: list[str] = Field(default_factory=list)
    published_date: datetime | None = None
    exploit_available: bool = False


class ReportResponse(BaseModel):
    """Aggregated threat intelligence report response."""

    id: UUID
    title: str
    total_vulnerabilities: int
    severity_breakdown: dict[str, int]
    top_vulnerability_types: list[dict[str, int]]
    scan_results: list[ScanResultResponse] = Field(default_factory=list)
    generated_at: datetime


class ErrorResponse(BaseModel):
    """Standard error response."""

    detail: str
    error_code: str | None = None
