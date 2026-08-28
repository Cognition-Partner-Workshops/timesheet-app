"""Unit tests for the LLM analyzer (parsing logic, no API calls)."""

import json

from threat_intel.analyzers.llm_analyzer import VALID_SEVERITIES, VALID_VULN_TYPES, LLMAnalyzer
from threat_intel.models.domain import CodeSnippet, Language, Severity, VulnerabilityType


class TestLLMAnalyzerParsing:
    """Test LLM response parsing without making actual API calls."""

    def _make_analyzer(self) -> LLMAnalyzer:
        return LLMAnalyzer(api_key="test-key")

    def _make_snippet(self) -> CodeSnippet:
        return CodeSnippet(
            file_path="test.py",
            content="cursor.execute(f'SELECT * FROM users WHERE id={uid}')",
            language=Language.PYTHON,
            start_line=1,
            end_line=1,
        )

    def test_parse_valid_response(self) -> None:
        analyzer = self._make_analyzer()
        snippet = self._make_snippet()
        content = json.dumps({
            "vulnerabilities": [
                {
                    "vulnerability_type": "sql_injection",
                    "severity": "high",
                    "confidence": 0.95,
                    "title": "SQL Injection via f-string",
                    "description": "User input directly interpolated into SQL query.",
                    "line_start": 1,
                    "line_end": 1,
                    "cwe_ids": ["CWE-89"],
                    "mitigation_title": "Use parameterized queries",
                    "mitigation_description": "Replace f-string with parameterized query.",
                    "suggested_fix": "cursor.execute('SELECT * FROM users WHERE id=?', (uid,))",
                    "references": ["https://owasp.org/sql-injection"],
                }
            ]
        })

        vulns, mitigations = analyzer._parse_response(content, snippet)
        assert len(vulns) == 1
        assert vulns[0].vulnerability_type == VulnerabilityType.SQL_INJECTION
        assert vulns[0].severity == Severity.HIGH
        assert vulns[0].confidence == 0.95
        assert len(mitigations) == 1
        assert mitigations[0].title == "Use parameterized queries"

    def test_parse_empty_vulnerabilities(self) -> None:
        analyzer = self._make_analyzer()
        snippet = self._make_snippet()
        content = json.dumps({"vulnerabilities": []})
        vulns, mitigations = analyzer._parse_response(content, snippet)
        assert vulns == []
        assert mitigations == []

    def test_parse_invalid_json(self) -> None:
        analyzer = self._make_analyzer()
        snippet = self._make_snippet()
        vulns, mitigations = analyzer._parse_response("not valid json", snippet)
        assert vulns == []
        assert mitigations == []

    def test_parse_unknown_vuln_type_defaults_to_other(self) -> None:
        analyzer = self._make_analyzer()
        snippet = self._make_snippet()
        content = json.dumps({
            "vulnerabilities": [
                {
                    "vulnerability_type": "unknown_type_xyz",
                    "severity": "medium",
                    "confidence": 0.5,
                    "title": "Unknown issue",
                    "description": "Something weird.",
                }
            ]
        })
        vulns, _ = analyzer._parse_response(content, snippet)
        assert len(vulns) == 1
        assert vulns[0].vulnerability_type == VulnerabilityType.OTHER

    def test_parse_invalid_severity_defaults_to_info(self) -> None:
        analyzer = self._make_analyzer()
        snippet = self._make_snippet()
        content = json.dumps({
            "vulnerabilities": [
                {
                    "vulnerability_type": "xss",
                    "severity": "super_critical",
                    "confidence": 0.5,
                    "title": "XSS",
                    "description": "XSS found.",
                }
            ]
        })
        vulns, _ = analyzer._parse_response(content, snippet)
        assert len(vulns) == 1
        assert vulns[0].severity == Severity.INFO

    def test_parse_confidence_clamped(self) -> None:
        analyzer = self._make_analyzer()
        snippet = self._make_snippet()
        content = json.dumps({
            "vulnerabilities": [
                {
                    "vulnerability_type": "xss",
                    "severity": "high",
                    "confidence": 1.5,
                    "title": "XSS",
                    "description": "XSS found.",
                }
            ]
        })
        vulns, _ = analyzer._parse_response(content, snippet)
        assert vulns[0].confidence == 1.0

    def test_parse_without_mitigation_fields(self) -> None:
        analyzer = self._make_analyzer()
        snippet = self._make_snippet()
        content = json.dumps({
            "vulnerabilities": [
                {
                    "vulnerability_type": "xss",
                    "severity": "high",
                    "confidence": 0.8,
                    "title": "XSS",
                    "description": "XSS found.",
                }
            ]
        })
        vulns, mitigations = analyzer._parse_response(content, snippet)
        assert len(vulns) == 1
        assert len(mitigations) == 0

    def test_build_user_prompt(self) -> None:
        snippet = self._make_snippet()
        prompt = LLMAnalyzer._build_user_prompt(snippet)
        assert "python" in prompt
        assert "test.py" in prompt
        assert "cursor.execute" in prompt

    def test_valid_vuln_types_complete(self) -> None:
        for vtype in VulnerabilityType:
            assert vtype.value in VALID_VULN_TYPES

    def test_valid_severities_complete(self) -> None:
        for severity in Severity:
            assert severity.value in VALID_SEVERITIES
