"""Core domain models for vulnerability intelligence."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class VulnerabilityType(str, Enum):
    SQL_INJECTION = "sql_injection"
    XSS = "xss"
    BUFFER_OVERFLOW = "buffer_overflow"
    PATH_TRAVERSAL = "path_traversal"
    COMMAND_INJECTION = "command_injection"
    INSECURE_DESERIALIZATION = "insecure_deserialization"
    BROKEN_AUTH = "broken_auth"
    SENSITIVE_DATA_EXPOSURE = "sensitive_data_exposure"
    XXE = "xxe"
    BROKEN_ACCESS_CONTROL = "broken_access_control"
    SECURITY_MISCONFIGURATION = "security_misconfiguration"
    CSRF = "csrf"
    SSRF = "ssrf"
    RACE_CONDITION = "race_condition"
    CRYPTOGRAPHIC_FAILURE = "cryptographic_failure"
    CODE_INJECTION = "code_injection"
    OTHER = "other"


class ScanStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class Language(str, Enum):
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    JAVA = "java"
    C = "c"
    CPP = "cpp"
    GO = "go"
    RUST = "rust"
    RUBY = "ruby"
    PHP = "php"
    CSHARP = "csharp"
    SWIFT = "swift"
    KOTLIN = "kotlin"
    UNKNOWN = "unknown"


EXTENSION_TO_LANGUAGE: dict[str, Language] = {
    ".py": Language.PYTHON,
    ".js": Language.JAVASCRIPT,
    ".ts": Language.TYPESCRIPT,
    ".java": Language.JAVA,
    ".c": Language.C,
    ".cpp": Language.CPP,
    ".go": Language.GO,
    ".rs": Language.RUST,
    ".rb": Language.RUBY,
    ".php": Language.PHP,
    ".cs": Language.CSHARP,
    ".swift": Language.SWIFT,
    ".kt": Language.KOTLIN,
}


class CodeSnippet(BaseModel):
    """A code fragment to be analyzed for vulnerabilities."""

    file_path: str
    content: str
    language: Language = Language.UNKNOWN
    start_line: int = 1
    end_line: int | None = None

    def line_count(self) -> int:
        return self.content.count("\n") + 1


class Vulnerability(BaseModel):
    """A detected or known vulnerability."""

    id: UUID = Field(default_factory=uuid4)
    vulnerability_type: VulnerabilityType
    severity: Severity
    confidence: float = Field(ge=0.0, le=1.0)
    title: str
    description: str
    file_path: str | None = None
    line_start: int | None = None
    line_end: int | None = None
    cve_id: str | None = None
    cwe_ids: list[str] = Field(default_factory=list)
    affected_code: str | None = None
    detected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_encoders = {UUID: str, datetime: lambda v: v.isoformat()}


class MitigationRecommendation(BaseModel):
    """A recommended fix or mitigation for a vulnerability."""

    id: UUID = Field(default_factory=uuid4)
    vulnerability_id: UUID
    title: str
    description: str
    suggested_fix: str | None = None
    references: list[str] = Field(default_factory=list)
    priority: int = Field(ge=1, le=5, default=3)
    estimated_effort: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ScanResult(BaseModel):
    """Result of scanning a code artifact."""

    id: UUID = Field(default_factory=uuid4)
    status: ScanStatus = ScanStatus.PENDING
    target: str
    language: Language = Language.UNKNOWN
    files_scanned: int = 0
    vulnerabilities: list[Vulnerability] = Field(default_factory=list)
    mitigations: list[MitigationRecommendation] = Field(default_factory=list)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_seconds: float | None = None
    error_message: str | None = None

    @property
    def vulnerability_count(self) -> int:
        return len(self.vulnerabilities)

    @property
    def critical_count(self) -> int:
        return sum(1 for v in self.vulnerabilities if v.severity == Severity.CRITICAL)

    @property
    def high_count(self) -> int:
        return sum(1 for v in self.vulnerabilities if v.severity == Severity.HIGH)


class CVERecord(BaseModel):
    """A CVE vulnerability record from external sources."""

    cve_id: str
    description: str
    severity: Severity
    cvss_score: float | None = Field(default=None, ge=0.0, le=10.0)
    cwe_ids: list[str] = Field(default_factory=list)
    affected_products: list[str] = Field(default_factory=list)
    references: list[str] = Field(default_factory=list)
    published_date: datetime | None = None
    last_modified_date: datetime | None = None
    exploit_available: bool = False


class ThreatIntelReport(BaseModel):
    """Aggregated threat intelligence report."""

    id: UUID = Field(default_factory=uuid4)
    title: str
    scan_results: list[ScanResult] = Field(default_factory=list)
    total_vulnerabilities: int = 0
    severity_breakdown: dict[str, int] = Field(default_factory=dict)
    top_vulnerability_types: list[dict[str, int]] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def compute_summary(self) -> None:
        all_vulns = [v for sr in self.scan_results for v in sr.vulnerabilities]
        self.total_vulnerabilities = len(all_vulns)
        severity_counts: dict[str, int] = {}
        type_counts: dict[str, int] = {}
        for v in all_vulns:
            severity_counts[v.severity.value] = severity_counts.get(v.severity.value, 0) + 1
            type_counts[v.vulnerability_type.value] = (
                type_counts.get(v.vulnerability_type.value, 0) + 1
            )
        self.severity_breakdown = severity_counts
        self.top_vulnerability_types = [
            {k: v} for k, v in sorted(type_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ]
