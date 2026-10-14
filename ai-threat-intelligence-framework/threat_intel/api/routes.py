"""FastAPI route definitions for the threat intelligence API."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status

from threat_intel import __version__
from threat_intel.api.dependencies import (
    get_git_scanner,
    get_mitigation_engine,
    get_nvd_collector,
    get_repo_scanner,
)
from threat_intel.api.schemas import (
    CVEResponse,
    CVESearchRequest,
    ErrorResponse,
    HealthResponse,
    MitigationResponse,
    ReportResponse,
    ScanCodeRequest,
    ScanDirectoryRequest,
    ScanGitRepoRequest,
    ScanResultResponse,
    VulnerabilityResponse,
)
from threat_intel.models.domain import ScanResult, ThreatIntelReport

router = APIRouter()


def _scan_to_response(scan: ScanResult) -> ScanResultResponse:
    """Convert a domain ScanResult to API response."""
    return ScanResultResponse(
        id=scan.id,
        status=scan.status.value,
        target=scan.target,
        language=scan.language.value if scan.language else None,
        files_scanned=scan.files_scanned,
        vulnerability_count=scan.vulnerability_count,
        critical_count=scan.critical_count,
        high_count=scan.high_count,
        vulnerabilities=[
            VulnerabilityResponse(
                id=v.id,
                vulnerability_type=v.vulnerability_type,
                severity=v.severity,
                confidence=v.confidence,
                title=v.title,
                description=v.description,
                file_path=v.file_path,
                line_start=v.line_start,
                line_end=v.line_end,
                cve_id=v.cve_id,
                cwe_ids=v.cwe_ids,
                detected_at=v.detected_at,
            )
            for v in scan.vulnerabilities
        ],
        mitigations=[
            MitigationResponse(
                id=m.id,
                vulnerability_id=m.vulnerability_id,
                title=m.title,
                description=m.description,
                suggested_fix=m.suggested_fix,
                references=m.references,
                priority=m.priority,
                estimated_effort=m.estimated_effort,
                created_at=m.created_at,
            )
            for m in scan.mitigations
        ],
        started_at=scan.started_at,
        completed_at=scan.completed_at,
        duration_seconds=scan.duration_seconds,
        error_message=scan.error_message,
    )


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        version=__version__,
        timestamp=datetime.now(timezone.utc),
    )


@router.post(
    "/scan/code",
    response_model=ScanResultResponse,
    responses={500: {"model": ErrorResponse}},
)
async def scan_code(request: ScanCodeRequest) -> ScanResultResponse:
    """Scan a code snippet for vulnerabilities."""
    scanner = get_repo_scanner()
    try:
        result = await scanner.scan_code_string(
            code=request.code,
            language=request.language,
            file_path=request.file_path,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scan failed: {exc}",
        ) from exc
    return _scan_to_response(result)


@router.post(
    "/scan/directory",
    response_model=ScanResultResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def scan_directory(request: ScanDirectoryRequest) -> ScanResultResponse:
    """Scan a local directory for vulnerabilities."""
    scanner = get_repo_scanner()
    try:
        result = await scanner.scan_directory(request.path)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Directory scan failed: {exc}",
        ) from exc
    return _scan_to_response(result)


@router.post(
    "/scan/git",
    response_model=ScanResultResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def scan_git_repo(request: ScanGitRepoRequest) -> ScanResultResponse:
    """Scan a git repository or commit range for vulnerabilities."""
    git_scanner = get_git_scanner()

    try:
        if request.repo_url:
            result = await git_scanner.scan_remote_repo(
                repo_url=request.repo_url,
                branch=request.branch,
            )
        elif request.repo_path and request.from_commit:
            result = await git_scanner.scan_commit_range(
                repo_path=request.repo_path,
                from_commit=request.from_commit,
                to_commit=request.to_commit or "HEAD",
            )
        elif request.repo_path:
            result = await git_scanner.scan_uncommitted_changes(request.repo_path)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide either repo_url or repo_path.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Git scan failed: {exc}",
        ) from exc

    return _scan_to_response(result)


@router.post(
    "/cve/search",
    response_model=list[CVEResponse],
    responses={500: {"model": ErrorResponse}},
)
async def search_cves(request: CVESearchRequest) -> list[CVEResponse]:
    """Search NVD for CVE records."""
    collector = get_nvd_collector()
    try:
        if request.cve_id:
            record = await collector.fetch_single_cve(request.cve_id)
            records = [record] if record else []
        else:
            records = await collector.fetch_cves(keyword=request.keyword)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CVE search failed: {exc}",
        ) from exc

    return [
        CVEResponse(
            cve_id=r.cve_id,
            description=r.description,
            severity=r.severity,
            cvss_score=r.cvss_score,
            cwe_ids=r.cwe_ids,
            affected_products=r.affected_products,
            references=r.references,
            published_date=r.published_date,
            exploit_available=r.exploit_available,
        )
        for r in records
    ]


@router.get(
    "/cve/{cve_id}",
    response_model=CVEResponse,
    responses={404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def get_cve(cve_id: str) -> CVEResponse:
    """Look up a specific CVE by ID."""
    collector = get_nvd_collector()
    try:
        record = await collector.fetch_single_cve(cve_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CVE lookup failed: {exc}",
        ) from exc

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CVE {cve_id} not found.",
        )

    return CVEResponse(
        cve_id=record.cve_id,
        description=record.description,
        severity=record.severity,
        cvss_score=record.cvss_score,
        cwe_ids=record.cwe_ids,
        affected_products=record.affected_products,
        references=record.references,
        published_date=record.published_date,
        exploit_available=record.exploit_available,
    )


@router.post(
    "/mitigate",
    response_model=list[MitigationResponse],
    responses={500: {"model": ErrorResponse}},
)
async def generate_mitigations(scan_request: ScanCodeRequest) -> list[MitigationResponse]:
    """Scan code and generate mitigation recommendations."""
    scanner = get_repo_scanner()
    engine = get_mitigation_engine()

    try:
        scan_result = await scanner.scan_code_string(
            code=scan_request.code,
            language=scan_request.language,
            file_path=scan_request.file_path,
        )

        if not scan_result.vulnerabilities:
            return []

        mitigations = await engine.generate_mitigations(scan_result.vulnerabilities)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Mitigation generation failed: {exc}",
        ) from exc

    return [
        MitigationResponse(
            id=m.id,
            vulnerability_id=m.vulnerability_id,
            title=m.title,
            description=m.description,
            suggested_fix=m.suggested_fix,
            references=m.references,
            priority=m.priority,
            estimated_effort=m.estimated_effort,
            created_at=m.created_at,
        )
        for m in mitigations
    ]


@router.get(
    "/report",
    response_model=ReportResponse,
    responses={500: {"model": ErrorResponse}},
)
async def get_report() -> ReportResponse:
    """Generate a summary threat intelligence report (placeholder for aggregation)."""
    report = ThreatIntelReport(title="Threat Intelligence Summary Report")
    report.compute_summary()
    return ReportResponse(
        id=report.id,
        title=report.title,
        total_vulnerabilities=report.total_vulnerabilities,
        severity_breakdown=report.severity_breakdown,
        top_vulnerability_types=report.top_vulnerability_types,
        generated_at=report.generated_at,
    )
