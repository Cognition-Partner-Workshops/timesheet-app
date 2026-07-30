from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from src.app import app


class TestLogin:
    def test_login_existing_user(self):
        conn = MagicMock()
        cursor = MagicMock()
        conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
        conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        cursor.fetchone.return_value = {
            "email": "existing@example.com",
            "created_at": "2024-01-01 00:00:00",
        }

        with patch("src.routes.auth.get_connection", return_value=conn):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/auth/login", json={"email": "existing@example.com"})
            assert resp.status_code == 200
            assert resp.json()["message"] == "Login successful"
            assert resp.json()["user"]["email"] == "existing@example.com"

    def test_login_new_user(self):
        conn = MagicMock()
        cursor = MagicMock()
        conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
        conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        cursor.fetchone.return_value = None

        with patch("src.routes.auth.get_connection", return_value=conn):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/auth/login", json={"email": "new@example.com"})
            assert resp.status_code == 200
            assert resp.json()["message"] == "User created and logged in successfully"
            assert resp.json()["user"]["email"] == "new@example.com"

    def test_login_invalid_email(self):
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/auth/login", json={"email": "invalid"})
        assert resp.status_code == 400

    def test_login_missing_email(self):
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/auth/login", json={})
        assert resp.status_code == 400


class TestGetMe:
    def test_get_me_success(self):
        conn = MagicMock()
        cursor = MagicMock()
        conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
        conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        cursor.fetchone.return_value = {
            "email": "test@example.com",
            "created_at": "2024-01-01 00:00:00",
        }

        with patch("src.routes.auth.get_connection", return_value=conn), \
             patch("src.dependencies.get_connection", return_value=conn):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/auth/me", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 200
            assert resp.json()["user"]["email"] == "test@example.com"

    def test_get_me_no_header(self):
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401
