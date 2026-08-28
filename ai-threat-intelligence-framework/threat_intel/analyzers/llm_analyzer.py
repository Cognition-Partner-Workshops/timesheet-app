"""LLM-based vulnerability analysis engine using OpenAI-compatible APIs."""

from __future__ import annotations

import json
from typing import Any

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from threat_intel.models.domain import (
    CodeSnippet,
    MitigationRecommendation,
    Severity,
    Vulnerability,
    VulnerabilityType,
)
from threat_intel.utils.logging import get_logger

logger = get_logger(__name__)

SYSTEM_PROMPT = """You are an expert cybersecurity analyst specializing in static code analysis \
and vulnerability detection. Your task is to analyze code snippets for security vulnerabilities.

For each vulnerability found, provide:
1. vulnerability_type: One of: sql_injection, xss, buffer_overflow, path_traversal, \
command_injection, insecure_deserialization, broken_auth, sensitive_data_exposure, xxe, \
broken_access_control, security_misconfiguration, csrf, ssrf, race_condition, \
cryptographic_failure, code_injection, other
2. severity: One of: critical, high, medium, low, info
3. confidence: A float between 0.0 and 1.0
4. title: A concise title for the vulnerability
5. description: A detailed description of the vulnerability and its impact
6. line_start: The starting line number (if identifiable)
7. line_end: The ending line number (if identifiable)
8. cwe_ids: Relevant CWE identifiers (e.g., ["CWE-89"])
9. mitigation_title: A concise title for the recommended fix
10. mitigation_description: Detailed mitigation steps
11. suggested_fix: The corrected code snippet (if applicable)
12. references: URLs to relevant security resources

Respond ONLY with valid JSON in this exact format:
{
  "vulnerabilities": [
    {
      "vulnerability_type": "...",
      "severity": "...",
      "confidence": 0.0,
      "title": "...",
      "description": "...",
      "line_start": null,
      "line_end": null,
      "cwe_ids": [],
      "mitigation_title": "...",
      "mitigation_description": "...",
      "suggested_fix": null,
      "references": []
    }
  ]
}

If no vulnerabilities are found, return: {"vulnerabilities": []}
Be thorough but avoid false positives. Only report genuine security concerns."""


VALID_VULN_TYPES = {v.value for v in VulnerabilityType}
VALID_SEVERITIES = {s.value for s in Severity}


class LLMAnalyzer:
    """Analyzes code snippets for vulnerabilities using an LLM."""

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4",
        temperature: float = 0.1,
        max_tokens: int = 4096,
        base_url: str | None = None,
    ) -> None:
        client_kwargs: dict[str, Any] = {"api_key": api_key}
        if base_url:
            client_kwargs["base_url"] = base_url
        self._client = AsyncOpenAI(**client_kwargs)
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
    async def analyze_snippet(
        self, snippet: CodeSnippet
    ) -> tuple[list[Vulnerability], list[MitigationRecommendation]]:
        """Analyze a single code snippet for vulnerabilities."""
        user_prompt = self._build_user_prompt(snippet)

        logger.info(
            "analyzing_snippet",
            file=snippet.file_path,
            language=snippet.language.value,
            lines=f"{snippet.start_line}-{snippet.end_line}",
        )

        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=self._temperature,
            max_tokens=self._max_tokens,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content or "{}"
        return self._parse_response(content, snippet)

    async def analyze_snippets(
        self, snippets: list[CodeSnippet]
    ) -> tuple[list[Vulnerability], list[MitigationRecommendation]]:
        """Analyze multiple code snippets sequentially."""
        all_vulns: list[Vulnerability] = []
        all_mitigations: list[MitigationRecommendation] = []

        for snippet in snippets:
            vulns, mitigations = await self.analyze_snippet(snippet)
            all_vulns.extend(vulns)
            all_mitigations.extend(mitigations)

        logger.info(
            "analysis_complete",
            snippets_analyzed=len(snippets),
            vulnerabilities_found=len(all_vulns),
        )
        return all_vulns, all_mitigations

    @staticmethod
    def _build_user_prompt(snippet: CodeSnippet) -> str:
        """Build the user prompt with code context."""
        parts = [
            f"Analyze the following {snippet.language.value} code for security vulnerabilities.",
            f"File: {snippet.file_path}",
            f"Lines: {snippet.start_line} to {snippet.end_line or 'end'}",
            "",
            "```",
            snippet.content,
            "```",
        ]
        return "\n".join(parts)

    def _parse_response(
        self, content: str, snippet: CodeSnippet
    ) -> tuple[list[Vulnerability], list[MitigationRecommendation]]:
        """Parse the LLM JSON response into domain objects."""
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            logger.error("invalid_json_response", content=content[:200])
            return [], []

        vulns: list[Vulnerability] = []
        mitigations: list[MitigationRecommendation] = []

        for item in data.get("vulnerabilities", []):
            vuln = self._parse_vulnerability(item, snippet)
            if vuln is None:
                continue
            vulns.append(vuln)

            mitigation = self._parse_mitigation(item, vuln)
            if mitigation is not None:
                mitigations.append(mitigation)

        return vulns, mitigations

    @staticmethod
    def _parse_vulnerability(
        item: dict[str, Any], snippet: CodeSnippet
    ) -> Vulnerability | None:
        """Parse a single vulnerability from the LLM response."""
        vuln_type_str = item.get("vulnerability_type", "other")
        if vuln_type_str not in VALID_VULN_TYPES:
            vuln_type_str = "other"

        severity_str = item.get("severity", "info")
        if severity_str not in VALID_SEVERITIES:
            severity_str = "info"

        confidence = item.get("confidence", 0.5)
        if not isinstance(confidence, (int, float)):
            confidence = 0.5
        confidence = max(0.0, min(1.0, float(confidence)))

        try:
            return Vulnerability(
                vulnerability_type=VulnerabilityType(vuln_type_str),
                severity=Severity(severity_str),
                confidence=confidence,
                title=str(item.get("title", "Unknown Vulnerability")),
                description=str(item.get("description", "")),
                file_path=snippet.file_path,
                line_start=item.get("line_start"),
                line_end=item.get("line_end"),
                cwe_ids=item.get("cwe_ids", []),
                affected_code=snippet.content,
            )
        except (ValueError, TypeError) as exc:
            logger.warning("vulnerability_parse_error", error=str(exc))
            return None

    @staticmethod
    def _parse_mitigation(
        item: dict[str, Any], vuln: Vulnerability
    ) -> MitigationRecommendation | None:
        """Parse a mitigation recommendation from the LLM response."""
        title = item.get("mitigation_title")
        description = item.get("mitigation_description")
        if not title or not description:
            return None

        return MitigationRecommendation(
            vulnerability_id=vuln.id,
            title=str(title),
            description=str(description),
            suggested_fix=item.get("suggested_fix"),
            references=item.get("references", []),
        )
