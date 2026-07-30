from unittest.mock import patch

from fastapi.testclient import TestClient

from src.app import app


def test_health_check():
    with patch("src.database.pymysql"):
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "OK"
        assert "timestamp" in body
