"""Collector for NIST National Vulnerability Database (NVD) CVE data."""

from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from threat_intel.models.domain import CVERecord, Severity
from threat_intel.utils.logging import get_logger

logger = get_logger(__name__)


def _parse_severity(cvss_score: float | None) -> Severity:
    if cvss_score is None:
        return Severity.INFO
    if cvss_score >= 9.0:
        return Severity.CRITICAL
    if cvss_score >= 7.0:
        return Severity.HIGH
    if cvss_score >= 4.0:
        return Severity.MEDIUM
    if cvss_score >= 0.1:
        return Severity.LOW
    return Severity.INFO


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def _extract_cvss_score(metrics: dict[str, Any]) -> float | None:
    """Extract the best available CVSS score from NVD metrics."""
    for version_key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
        metric_list = metrics.get(version_key, [])
        if metric_list:
            cvss_data = metric_list[0].get("cvssData", {})
            score = cvss_data.get("baseScore")
            if score is not None:
                return float(score)
    return None


class NVDCollector:
    """Fetches CVE records from the NIST NVD REST API v2.0."""

    def __init__(
        self,
        base_url: str = "https://services.nvd.nist.gov/rest/json/cves/2.0",
        api_key: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        self._base_url = base_url
        self._api_key = api_key
        self._timeout = timeout

    def _build_headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"Accept": "application/json"}
        if self._api_key:
            headers["apiKey"] = self._api_key
        return headers

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
    async def fetch_cves(
        self,
        keyword: str | None = None,
        cve_id: str | None = None,
        start_index: int = 0,
        results_per_page: int = 50,
    ) -> list[CVERecord]:
        """Fetch CVE records from NVD with optional keyword or CVE ID filter."""
        params: dict[str, Any] = {
            "startIndex": start_index,
            "resultsPerPage": results_per_page,
        }
        if keyword:
            params["keywordSearch"] = keyword
        if cve_id:
            params["cveId"] = cve_id

        logger.info("fetching_cves", params=params)

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                self._base_url,
                params=params,
                headers=self._build_headers(),
            )
            response.raise_for_status()

        data = response.json()
        return self._parse_response(data)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
    async def fetch_cves_by_date_range(
        self,
        pub_start_date: str,
        pub_end_date: str,
        results_per_page: int = 100,
    ) -> list[CVERecord]:
        """Fetch CVEs published within a date range (ISO 8601 format)."""
        params: dict[str, Any] = {
            "pubStartDate": pub_start_date,
            "pubEndDate": pub_end_date,
            "resultsPerPage": results_per_page,
        }

        logger.info("fetching_cves_by_date", start=pub_start_date, end=pub_end_date)

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                self._base_url,
                params=params,
                headers=self._build_headers(),
            )
            response.raise_for_status()

        data = response.json()
        return self._parse_response(data)

    def _parse_response(self, data: dict[str, Any]) -> list[CVERecord]:
        records: list[CVERecord] = []
        for item in data.get("vulnerabilities", []):
            cve_data = item.get("cve", {})
            cve_id = cve_data.get("id", "")
            descriptions = cve_data.get("descriptions", [])
            description = next(
                (d["value"] for d in descriptions if d.get("lang") == "en"),
                descriptions[0]["value"] if descriptions else "",
            )

            metrics = cve_data.get("metrics", {})
            cvss_score = _extract_cvss_score(metrics)
            severity = _parse_severity(cvss_score)

            weaknesses = cve_data.get("weaknesses", [])
            cwe_ids: list[str] = []
            for w in weaknesses:
                for desc in w.get("description", []):
                    val = desc.get("value", "")
                    if val.startswith("CWE-"):
                        cwe_ids.append(val)

            references = [
                ref.get("url", "") for ref in cve_data.get("references", []) if ref.get("url")
            ]

            record = CVERecord(
                cve_id=cve_id,
                description=description,
                severity=severity,
                cvss_score=cvss_score,
                cwe_ids=cwe_ids,
                references=references,
                published_date=_parse_datetime(cve_data.get("published")),
                last_modified_date=_parse_datetime(cve_data.get("lastModified")),
            )
            records.append(record)

        logger.info("cves_fetched", count=len(records))
        return records

    async def fetch_single_cve(self, cve_id: str) -> CVERecord | None:
        """Fetch a single CVE by ID."""
        records = await self.fetch_cves(cve_id=cve_id)
        return records[0] if records else None
