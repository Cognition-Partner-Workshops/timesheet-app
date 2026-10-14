"""Unit tests for the NVD collector."""



from threat_intel.collectors.nvd_collector import NVDCollector, _extract_cvss_score, _parse_severity
from threat_intel.models.domain import Severity


class TestParseSeverity:
    def test_critical(self) -> None:
        assert _parse_severity(9.5) == Severity.CRITICAL

    def test_high(self) -> None:
        assert _parse_severity(7.5) == Severity.HIGH

    def test_medium(self) -> None:
        assert _parse_severity(5.0) == Severity.MEDIUM

    def test_low(self) -> None:
        assert _parse_severity(2.0) == Severity.LOW

    def test_info(self) -> None:
        assert _parse_severity(0.0) == Severity.INFO

    def test_none(self) -> None:
        assert _parse_severity(None) == Severity.INFO


class TestExtractCvssScore:
    def test_v31(self) -> None:
        metrics = {
            "cvssMetricV31": [{"cvssData": {"baseScore": 9.8}}],
        }
        assert _extract_cvss_score(metrics) == 9.8

    def test_v30_fallback(self) -> None:
        metrics = {
            "cvssMetricV30": [{"cvssData": {"baseScore": 7.5}}],
        }
        assert _extract_cvss_score(metrics) == 7.5

    def test_v2_fallback(self) -> None:
        metrics = {
            "cvssMetricV2": [{"cvssData": {"baseScore": 5.0}}],
        }
        assert _extract_cvss_score(metrics) == 5.0

    def test_empty_metrics(self) -> None:
        assert _extract_cvss_score({}) is None

    def test_priority_order(self) -> None:
        metrics = {
            "cvssMetricV31": [{"cvssData": {"baseScore": 9.8}}],
            "cvssMetricV2": [{"cvssData": {"baseScore": 5.0}}],
        }
        assert _extract_cvss_score(metrics) == 9.8


class TestNVDCollector:
    def test_build_headers_without_key(self) -> None:
        collector = NVDCollector()
        headers = collector._build_headers()
        assert "apiKey" not in headers
        assert headers["Accept"] == "application/json"

    def test_build_headers_with_key(self) -> None:
        collector = NVDCollector(api_key="test-key")
        headers = collector._build_headers()
        assert headers["apiKey"] == "test-key"

    def test_parse_response_empty(self) -> None:
        collector = NVDCollector()
        records = collector._parse_response({"vulnerabilities": []})
        assert records == []

    def test_parse_response_with_cve(self) -> None:
        collector = NVDCollector()
        data = {
            "vulnerabilities": [
                {
                    "cve": {
                        "id": "CVE-2024-1234",
                        "descriptions": [
                            {"lang": "en", "value": "A test vulnerability."}
                        ],
                        "metrics": {
                            "cvssMetricV31": [
                                {"cvssData": {"baseScore": 9.8}}
                            ]
                        },
                        "weaknesses": [
                            {
                                "description": [
                                    {"value": "CWE-89"}
                                ]
                            }
                        ],
                        "references": [
                            {"url": "https://example.com/advisory"}
                        ],
                        "published": "2024-01-15T10:00:00Z",
                    }
                }
            ]
        }
        records = collector._parse_response(data)
        assert len(records) == 1
        assert records[0].cve_id == "CVE-2024-1234"
        assert records[0].severity == Severity.CRITICAL
        assert records[0].cvss_score == 9.8
        assert "CWE-89" in records[0].cwe_ids
        assert "https://example.com/advisory" in records[0].references
