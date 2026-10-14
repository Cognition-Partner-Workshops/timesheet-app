"""Integration tests for the FastAPI API endpoints."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from threat_intel.api.app import create_app


@pytest.fixture
def app():
    """Create a test application instance."""
    return create_app(
        database_url="sqlite+aiosqlite:///:memory:",
        openai_api_key="test-key",
        openai_model="gpt-4",
        log_level="DEBUG",
    )


@pytest.fixture
async def client(app):
    """Create an async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_check(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
        assert "timestamp" in data


class TestScanCodeEndpoint:
    @pytest.mark.asyncio
    async def test_scan_code_empty_body(self, client: AsyncClient) -> None:
        response = await client.post("/api/v1/scan/code", json={})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_scan_code_valid_request(self, client: AsyncClient) -> None:
        from threat_intel.models.domain import ScanResult, ScanStatus

        mock_scanner = AsyncMock()
        mock_scanner.scan_code_string = AsyncMock(
            return_value=ScanResult(
                target="<inline>",
                status=ScanStatus.COMPLETED,
                files_scanned=1,
            )
        )

        with patch(
            "threat_intel.api.routes.get_repo_scanner",
            return_value=mock_scanner,
        ):
            response = await client.post(
                "/api/v1/scan/code",
                json={
                    "code": "x = eval(input())",
                    "language": "python",
                    "file_path": "test.py",
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "completed"
            assert data["files_scanned"] == 1


class TestScanDirectoryEndpoint:
    @pytest.mark.asyncio
    async def test_scan_directory_empty_path(self, client: AsyncClient) -> None:
        response = await client.post("/api/v1/scan/directory", json={})
        assert response.status_code == 422


class TestScanGitEndpoint:
    @pytest.mark.asyncio
    async def test_scan_git_no_params(self, client: AsyncClient) -> None:
        mock_git_scanner = AsyncMock()
        with patch(
            "threat_intel.api.routes.get_git_scanner",
            return_value=mock_git_scanner,
        ):
            response = await client.post("/api/v1/scan/git", json={})
            assert response.status_code == 400


class TestCVEEndpoints:
    @pytest.mark.asyncio
    async def test_cve_not_found(self, client: AsyncClient) -> None:
        mock_collector = AsyncMock()
        mock_collector.fetch_single_cve = AsyncMock(return_value=None)

        with patch(
            "threat_intel.api.routes.get_nvd_collector",
            return_value=mock_collector,
        ):
            response = await client.get("/api/v1/cve/CVE-9999-0000")
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_search_cves(self, client: AsyncClient) -> None:
        mock_collector = AsyncMock()
        mock_collector.fetch_cves = AsyncMock(return_value=[])

        with patch(
            "threat_intel.api.routes.get_nvd_collector",
            return_value=mock_collector,
        ):
            response = await client.post(
                "/api/v1/cve/search",
                json={"keyword": "test"},
            )
            assert response.status_code == 200
            assert response.json() == []


class TestMitigateEndpoint:
    @pytest.mark.asyncio
    async def test_mitigate_no_vulnerabilities(self, client: AsyncClient) -> None:
        from threat_intel.models.domain import ScanResult, ScanStatus

        mock_scanner = AsyncMock()
        mock_scanner.scan_code_string = AsyncMock(
            return_value=ScanResult(
                target="<inline>",
                status=ScanStatus.COMPLETED,
                files_scanned=1,
            )
        )

        with (
            patch(
                "threat_intel.api.routes.get_repo_scanner",
                return_value=mock_scanner,
            ),
            patch("threat_intel.api.routes.get_mitigation_engine"),
        ):
            response = await client.post(
                "/api/v1/mitigate",
                json={"code": "x = 1", "language": "python"},
            )
            assert response.status_code == 200
            assert response.json() == []


class TestReportEndpoint:
    @pytest.mark.asyncio
    async def test_get_report(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/report")
        assert response.status_code == 200
        data = response.json()
        assert "title" in data
        assert data["total_vulnerabilities"] == 0
