"""Unit tests for domain models."""


from threat_intel.models.domain import (
    CodeSnippet,
    CVERecord,
    Language,
    MitigationRecommendation,
    ScanResult,
    ScanStatus,
    Severity,
    ThreatIntelReport,
    Vulnerability,
    VulnerabilityType,
)


class TestCodeSnippet:
    def test_line_count_single_line(self) -> None:
        snippet = CodeSnippet(file_path="test.py", content="print('hello')")
        assert snippet.line_count() == 1

    def test_line_count_multi_line(self) -> None:
        snippet = CodeSnippet(file_path="test.py", content="line1\nline2\nline3")
        assert snippet.line_count() == 3

    def test_default_language(self) -> None:
        snippet = CodeSnippet(file_path="test.py", content="x = 1")
        assert snippet.language == Language.UNKNOWN

    def test_with_explicit_language(self) -> None:
        snippet = CodeSnippet(
            file_path="test.py", content="x = 1", language=Language.PYTHON
        )
        assert snippet.language == Language.PYTHON


class TestVulnerability:
    def test_creation(self) -> None:
        vuln = Vulnerability(
            vulnerability_type=VulnerabilityType.SQL_INJECTION,
            severity=Severity.HIGH,
            confidence=0.95,
            title="SQL Injection in user query",
            description="User input directly concatenated into SQL query.",
        )
        assert vuln.vulnerability_type == VulnerabilityType.SQL_INJECTION
        assert vuln.severity == Severity.HIGH
        assert vuln.confidence == 0.95
        assert vuln.id is not None
        assert vuln.detected_at is not None

    def test_optional_fields(self) -> None:
        vuln = Vulnerability(
            vulnerability_type=VulnerabilityType.XSS,
            severity=Severity.MEDIUM,
            confidence=0.8,
            title="Reflected XSS",
            description="Unescaped user input in response.",
            file_path="app.js",
            line_start=42,
            line_end=45,
            cve_id="CVE-2024-1234",
            cwe_ids=["CWE-79"],
        )
        assert vuln.file_path == "app.js"
        assert vuln.line_start == 42
        assert vuln.cve_id == "CVE-2024-1234"
        assert "CWE-79" in vuln.cwe_ids

    def test_confidence_bounds(self) -> None:
        vuln = Vulnerability(
            vulnerability_type=VulnerabilityType.OTHER,
            severity=Severity.LOW,
            confidence=0.0,
            title="Test",
            description="Test",
        )
        assert vuln.confidence == 0.0

        vuln2 = Vulnerability(
            vulnerability_type=VulnerabilityType.OTHER,
            severity=Severity.LOW,
            confidence=1.0,
            title="Test",
            description="Test",
        )
        assert vuln2.confidence == 1.0


class TestMitigationRecommendation:
    def test_creation(self) -> None:
        vuln = Vulnerability(
            vulnerability_type=VulnerabilityType.SQL_INJECTION,
            severity=Severity.HIGH,
            confidence=0.9,
            title="SQLi",
            description="SQL injection found.",
        )
        mitigation = MitigationRecommendation(
            vulnerability_id=vuln.id,
            title="Use parameterized queries",
            description="Replace string concatenation with parameterized queries.",
            suggested_fix="cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))",
            references=["https://owasp.org/sql-injection"],
            priority=1,
            estimated_effort="small",
        )
        assert mitigation.vulnerability_id == vuln.id
        assert mitigation.priority == 1
        assert mitigation.estimated_effort == "small"


class TestScanResult:
    def test_empty_scan(self) -> None:
        scan = ScanResult(target="/test/dir")
        assert scan.status == ScanStatus.PENDING
        assert scan.vulnerability_count == 0
        assert scan.critical_count == 0
        assert scan.high_count == 0

    def test_with_vulnerabilities(self) -> None:
        vulns = [
            Vulnerability(
                vulnerability_type=VulnerabilityType.SQL_INJECTION,
                severity=Severity.CRITICAL,
                confidence=0.9,
                title="Critical SQLi",
                description="Critical SQL injection.",
            ),
            Vulnerability(
                vulnerability_type=VulnerabilityType.XSS,
                severity=Severity.HIGH,
                confidence=0.8,
                title="High XSS",
                description="Cross-site scripting.",
            ),
            Vulnerability(
                vulnerability_type=VulnerabilityType.CSRF,
                severity=Severity.MEDIUM,
                confidence=0.7,
                title="Medium CSRF",
                description="CSRF vulnerability.",
            ),
        ]
        scan = ScanResult(
            target="/test/dir",
            status=ScanStatus.COMPLETED,
            vulnerabilities=vulns,
            files_scanned=10,
        )
        assert scan.vulnerability_count == 3
        assert scan.critical_count == 1
        assert scan.high_count == 1


class TestCVERecord:
    def test_creation(self) -> None:
        record = CVERecord(
            cve_id="CVE-2024-1234",
            description="A critical vulnerability in example software.",
            severity=Severity.CRITICAL,
            cvss_score=9.8,
            cwe_ids=["CWE-89"],
            affected_products=["example-software"],
        )
        assert record.cve_id == "CVE-2024-1234"
        assert record.cvss_score == 9.8
        assert record.severity == Severity.CRITICAL

    def test_optional_defaults(self) -> None:
        record = CVERecord(
            cve_id="CVE-2024-5678",
            description="A low severity issue.",
            severity=Severity.LOW,
        )
        assert record.cvss_score is None
        assert record.exploit_available is False
        assert record.cwe_ids == []


class TestThreatIntelReport:
    def test_empty_report(self) -> None:
        report = ThreatIntelReport(title="Test Report")
        report.compute_summary()
        assert report.total_vulnerabilities == 0
        assert report.severity_breakdown == {}
        assert report.top_vulnerability_types == []

    def test_report_with_scan_results(self) -> None:
        vulns = [
            Vulnerability(
                vulnerability_type=VulnerabilityType.SQL_INJECTION,
                severity=Severity.CRITICAL,
                confidence=0.9,
                title="SQLi",
                description="SQL injection.",
            ),
            Vulnerability(
                vulnerability_type=VulnerabilityType.SQL_INJECTION,
                severity=Severity.HIGH,
                confidence=0.8,
                title="SQLi 2",
                description="Another SQL injection.",
            ),
            Vulnerability(
                vulnerability_type=VulnerabilityType.XSS,
                severity=Severity.MEDIUM,
                confidence=0.7,
                title="XSS",
                description="Cross-site scripting.",
            ),
        ]
        scan = ScanResult(
            target="/test",
            status=ScanStatus.COMPLETED,
            vulnerabilities=vulns,
        )
        report = ThreatIntelReport(title="Test Report", scan_results=[scan])
        report.compute_summary()

        assert report.total_vulnerabilities == 3
        assert report.severity_breakdown["critical"] == 1
        assert report.severity_breakdown["high"] == 1
        assert report.severity_breakdown["medium"] == 1
        assert len(report.top_vulnerability_types) == 2
