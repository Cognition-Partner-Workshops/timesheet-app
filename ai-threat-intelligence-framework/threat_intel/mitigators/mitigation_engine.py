"""Automated mitigation recommendation engine powered by LLM analysis."""

from __future__ import annotations

import json
from typing import Any

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from threat_intel.models.domain import (
    MitigationRecommendation,
    Vulnerability,
    VulnerabilityType,
)
from threat_intel.utils.logging import get_logger

logger = get_logger(__name__)

MITIGATION_SYSTEM_PROMPT = """You are an expert cybersecurity remediation specialist. Given a \
vulnerability report, provide detailed, actionable mitigation recommendations.

For each vulnerability, provide:
1. title: A concise remediation title
2. description: Step-by-step remediation instructions
3. suggested_fix: Corrected code snippet (if code-level fix applies)
4. references: URLs to relevant OWASP guides, CWE entries, or security best practices
5. priority: Integer 1-5 (1 = most urgent)
6. estimated_effort: One of: "trivial", "small", "medium", "large", "extensive"

Respond ONLY with valid JSON:
{
  "mitigations": [
    {
      "title": "...",
      "description": "...",
      "suggested_fix": "...",
      "references": [],
      "priority": 1,
      "estimated_effort": "small"
    }
  ]
}

Focus on practical, implementable fixes. Reference industry standards (OWASP, NIST, CWE) \
where applicable."""


VULNERABILITY_KNOWLEDGE_BASE: dict[VulnerabilityType, dict[str, Any]] = {
    VulnerabilityType.SQL_INJECTION: {
        "owasp": "https://owasp.org/www-community/attacks/SQL_Injection",
        "cwe": "https://cwe.mitre.org/data/definitions/89.html",
        "quick_fix": "Use parameterized queries or ORM methods instead of string concatenation.",
        "priority": 1,
    },
    VulnerabilityType.XSS: {
        "owasp": "https://owasp.org/www-community/attacks/xss/",
        "cwe": "https://cwe.mitre.org/data/definitions/79.html",
        "quick_fix": "Sanitize user input and use context-aware output encoding.",
        "priority": 1,
    },
    VulnerabilityType.COMMAND_INJECTION: {
        "owasp": "https://owasp.org/www-community/attacks/Command_Injection",
        "cwe": "https://cwe.mitre.org/data/definitions/78.html",
        "quick_fix": "Avoid shell=True; use subprocess with argument lists and validate input.",
        "priority": 1,
    },
    VulnerabilityType.PATH_TRAVERSAL: {
        "owasp": "https://owasp.org/www-community/attacks/Path_Traversal",
        "cwe": "https://cwe.mitre.org/data/definitions/22.html",
        "quick_fix": "Validate and canonicalize file paths; restrict to allowed directories.",
        "priority": 2,
    },
    VulnerabilityType.INSECURE_DESERIALIZATION: {
        "owasp": (
            "https://owasp.org/www-project-web-security-testing-guide/latest/"
            "4-Web_Application_Security_Testing/07-Input_Validation_Testing/"
            "17-Testing_for_HTTP_Incoming_Requests"
        ),
        "cwe": "https://cwe.mitre.org/data/definitions/502.html",
        "quick_fix": "Avoid deserializing untrusted data; use safe alternatives like JSON.",
        "priority": 1,
    },
    VulnerabilityType.BROKEN_AUTH: {
        "owasp": "https://owasp.org/www-project-top-ten/2017/A2_2017-Broken_Authentication",
        "cwe": "https://cwe.mitre.org/data/definitions/287.html",
        "quick_fix": (
            "Implement multi-factor authentication, "
            "strong password policies, and session management."
        ),
        "priority": 1,
    },
    VulnerabilityType.SENSITIVE_DATA_EXPOSURE: {
        "owasp": "https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure",
        "cwe": "https://cwe.mitre.org/data/definitions/200.html",
        "quick_fix": "Encrypt sensitive data at rest and in transit; avoid logging secrets.",
        "priority": 2,
    },
    VulnerabilityType.SSRF: {
        "owasp": "https://owasp.org/www-community/attacks/Server_Side_Request_Forgery",
        "cwe": "https://cwe.mitre.org/data/definitions/918.html",
        "quick_fix": "Validate and allowlist destination URLs; block internal network access.",
        "priority": 1,
    },
    VulnerabilityType.CSRF: {
        "owasp": "https://owasp.org/www-community/attacks/csrf",
        "cwe": "https://cwe.mitre.org/data/definitions/352.html",
        "quick_fix": "Use anti-CSRF tokens and SameSite cookie attribute.",
        "priority": 2,
    },
    VulnerabilityType.CRYPTOGRAPHIC_FAILURE: {
        "owasp": "https://owasp.org/Top10/A02_2021-Cryptographic_Failures/",
        "cwe": "https://cwe.mitre.org/data/definitions/327.html",
        "quick_fix": "Use strong, modern algorithms (AES-256, SHA-256+); avoid MD5/SHA-1.",
        "priority": 2,
    },
}


class MitigationEngine:
    """Generates detailed mitigation recommendations for detected vulnerabilities."""

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4",
        temperature: float = 0.2,
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

    async def generate_mitigations(
        self, vulnerabilities: list[Vulnerability]
    ) -> list[MitigationRecommendation]:
        """Generate mitigation recommendations for a list of vulnerabilities."""
        if not vulnerabilities:
            return []

        mitigations: list[MitigationRecommendation] = []
        for vuln in vulnerabilities:
            mitigation = await self._generate_for_vulnerability(vuln)
            mitigations.extend(mitigation)

        logger.info("mitigations_generated", count=len(mitigations))
        return mitigations

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
    async def _generate_for_vulnerability(
        self, vuln: Vulnerability
    ) -> list[MitigationRecommendation]:
        """Generate LLM-powered mitigations for a single vulnerability."""
        kb_entry = VULNERABILITY_KNOWLEDGE_BASE.get(vuln.vulnerability_type, {})

        user_prompt = self._build_prompt(vuln, kb_entry)

        logger.info(
            "generating_mitigation",
            vuln_type=vuln.vulnerability_type.value,
            severity=vuln.severity.value,
        )

        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": MITIGATION_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=self._temperature,
            max_tokens=self._max_tokens,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content or "{}"
        return self._parse_response(content, vuln, kb_entry)

    @staticmethod
    def _build_prompt(vuln: Vulnerability, kb_entry: dict[str, Any]) -> str:
        """Build the mitigation request prompt."""
        parts = [
            "Generate a detailed mitigation recommendation for the following vulnerability:",
            "",
            f"Type: {vuln.vulnerability_type.value}",
            f"Severity: {vuln.severity.value}",
            f"Title: {vuln.title}",
            f"Description: {vuln.description}",
        ]

        if vuln.file_path:
            parts.append(f"File: {vuln.file_path}")
        if vuln.line_start:
            parts.append(f"Line: {vuln.line_start}")
        if vuln.cwe_ids:
            parts.append(f"CWE IDs: {', '.join(vuln.cwe_ids)}")
        if vuln.affected_code:
            parts.extend(["", "Affected code:", "```", vuln.affected_code[:2000], "```"])
        if kb_entry:
            parts.extend([
                "",
                "Reference knowledge:",
                f"Quick fix guidance: {kb_entry.get('quick_fix', 'N/A')}",
                f"OWASP reference: {kb_entry.get('owasp', 'N/A')}",
                f"CWE reference: {kb_entry.get('cwe', 'N/A')}",
            ])

        return "\n".join(parts)

    def _parse_response(
        self,
        content: str,
        vuln: Vulnerability,
        kb_entry: dict[str, Any],
    ) -> list[MitigationRecommendation]:
        """Parse the LLM response into MitigationRecommendation objects."""
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            logger.error("invalid_mitigation_json", content=content[:200])
            return [self._fallback_mitigation(vuln, kb_entry)]

        mitigations: list[MitigationRecommendation] = []
        for item in data.get("mitigations", []):
            priority = item.get("priority", kb_entry.get("priority", 3))
            if not isinstance(priority, int) or priority < 1 or priority > 5:
                priority = 3

            references = item.get("references", [])
            if kb_entry.get("owasp"):
                references = list({*references, kb_entry["owasp"]})
            if kb_entry.get("cwe"):
                references = list({*references, kb_entry["cwe"]})

            mitigations.append(
                MitigationRecommendation(
                    vulnerability_id=vuln.id,
                    title=str(item.get("title", f"Fix {vuln.vulnerability_type.value}")),
                    description=str(item.get("description", "")),
                    suggested_fix=item.get("suggested_fix"),
                    references=references,
                    priority=priority,
                    estimated_effort=item.get("estimated_effort"),
                )
            )

        if not mitigations:
            mitigations.append(self._fallback_mitigation(vuln, kb_entry))

        return mitigations

    @staticmethod
    def _fallback_mitigation(
        vuln: Vulnerability, kb_entry: dict[str, Any]
    ) -> MitigationRecommendation:
        """Generate a basic mitigation from the knowledge base when LLM fails."""
        references = []
        if kb_entry.get("owasp"):
            references.append(kb_entry["owasp"])
        if kb_entry.get("cwe"):
            references.append(kb_entry["cwe"])

        return MitigationRecommendation(
            vulnerability_id=vuln.id,
            title=f"Remediate {vuln.vulnerability_type.value.replace('_', ' ').title()}",
            description=kb_entry.get(
                "quick_fix",
                f"Review and fix the {vuln.vulnerability_type.value} vulnerability "
                f"in {vuln.file_path or 'the affected code'}.",
            ),
            references=references,
            priority=kb_entry.get("priority", 3),
        )
