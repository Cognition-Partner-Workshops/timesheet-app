"""Collector for GitHub Security Advisory data via GraphQL API."""

from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from threat_intel.models.domain import CVERecord, Severity
from threat_intel.utils.logging import get_logger

logger = get_logger(__name__)

ADVISORY_QUERY = """
query($first: Int!, $after: String, $severity: SecurityAdvisorySeverity) {
  securityAdvisories(
    first: $first, after: $after, severity: $severity,
    orderBy: {field: PUBLISHED_AT, direction: DESC}
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      ghsaId
      summary
      description
      severity
      publishedAt
      updatedAt
      identifiers {
        type
        value
      }
      cwes(first: 10) {
        nodes {
          cweId
          name
        }
      }
      vulnerabilities(first: 10) {
        nodes {
          package {
            ecosystem
            name
          }
          vulnerableVersionRange
        }
      }
      references {
        url
      }
    }
  }
}
"""

SEVERITY_MAP: dict[str, Severity] = {
    "CRITICAL": Severity.CRITICAL,
    "HIGH": Severity.HIGH,
    "MODERATE": Severity.MEDIUM,
    "LOW": Severity.LOW,
}


class GitHubAdvisoryCollector:
    """Fetches security advisories from GitHub's GraphQL API."""

    def __init__(
        self,
        token: str | None = None,
        api_url: str = "https://api.github.com/graphql",
        timeout: float = 30.0,
    ) -> None:
        self._token = token
        self._api_url = api_url
        self._timeout = timeout

    def _build_headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return headers

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
    async def fetch_advisories(
        self,
        severity: str | None = None,
        first: int = 50,
        after: str | None = None,
    ) -> tuple[list[CVERecord], str | None]:
        """
        Fetch GitHub security advisories.

        Returns a tuple of (records, next_cursor).
        next_cursor is None when there are no more pages.
        """
        variables: dict[str, Any] = {"first": first}
        if severity:
            variables["severity"] = severity.upper()
        if after:
            variables["after"] = after

        payload = {"query": ADVISORY_QUERY, "variables": variables}

        logger.info("fetching_github_advisories", severity=severity, first=first)

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                self._api_url,
                json=payload,
                headers=self._build_headers(),
            )
            response.raise_for_status()

        data = response.json()
        return self._parse_response(data)

    def _parse_response(
        self, data: dict[str, Any]
    ) -> tuple[list[CVERecord], str | None]:
        advisories_data = data.get("data", {}).get("securityAdvisories", {})
        page_info = advisories_data.get("pageInfo", {})
        next_cursor = page_info.get("endCursor") if page_info.get("hasNextPage") else None
        nodes = advisories_data.get("nodes", [])

        records: list[CVERecord] = []
        for node in nodes:
            identifiers = node.get("identifiers", [])
            cve_id = next(
                (i["value"] for i in identifiers if i.get("type") == "CVE"),
                node.get("ghsaId", ""),
            )

            severity_str = node.get("severity", "LOW")
            severity = SEVERITY_MAP.get(severity_str, Severity.LOW)

            cwe_nodes = node.get("cwes", {}).get("nodes", [])
            cwe_ids = [cwe["cweId"] for cwe in cwe_nodes if cwe.get("cweId")]

            vuln_nodes = node.get("vulnerabilities", {}).get("nodes", [])
            affected = [
                f"{v['package']['ecosystem']}/{v['package']['name']}"
                for v in vuln_nodes
                if v.get("package")
            ]

            references = [r["url"] for r in node.get("references", []) if r.get("url")]

            published = node.get("publishedAt")
            updated = node.get("updatedAt")

            record = CVERecord(
                cve_id=cve_id,
                description=node.get("description", node.get("summary", "")),
                severity=severity,
                cwe_ids=cwe_ids,
                affected_products=affected,
                references=references,
                published_date=(
                    datetime.fromisoformat(published.replace("Z", "+00:00")) if published else None
                ),
                last_modified_date=(
                    datetime.fromisoformat(updated.replace("Z", "+00:00")) if updated else None
                ),
            )
            records.append(record)

        logger.info("github_advisories_fetched", count=len(records))
        return records, next_cursor

    async def fetch_all_advisories(
        self,
        severity: str | None = None,
        max_pages: int = 10,
    ) -> list[CVERecord]:
        """Paginate through all advisories up to max_pages."""
        all_records: list[CVERecord] = []
        cursor: str | None = None

        for page in range(max_pages):
            records, cursor = await self.fetch_advisories(
                severity=severity, after=cursor
            )
            all_records.extend(records)
            logger.info("page_fetched", page=page + 1, total_so_far=len(all_records))
            if cursor is None:
                break

        return all_records
