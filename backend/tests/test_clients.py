from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from src.app import app


def _make_mocks():
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return conn, cursor


def _client_with_patches(conn):
    return patch("src.routes.clients.get_connection", return_value=conn), \
           patch("src.dependencies.get_connection", return_value=conn)


class TestGetClients:
    def test_returns_clients(self):
        conn, cursor = _make_mocks()
        mock_clients = [
            {"id": 1, "name": "Client A", "description": "Desc", "department": None,
             "email": None, "created_at": "2024-01-01", "updated_at": "2024-01-01"},
        ]
        call_count = [0]

        def fetchone_side(*a):
            call_count[0] += 1
            return {"email": "test@example.com"}

        def fetchall_side(*a):
            return mock_clients

        cursor.fetchone.side_effect = fetchone_side
        cursor.fetchall.side_effect = fetchall_side

        p1, p2 = _client_with_patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/clients", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 200
            assert resp.json()["clients"] == mock_clients

    def test_returns_empty_list(self):
        conn, cursor = _make_mocks()
        cursor.fetchone.return_value = {"email": "test@example.com"}
        cursor.fetchall.return_value = []

        p1, p2 = _client_with_patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/clients", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 200
            assert resp.json()["clients"] == []


class TestGetClient:
    def test_returns_client(self):
        conn, cursor = _make_mocks()
        mock_client = {"id": 1, "name": "Client A", "description": "Desc",
                       "department": None, "email": None,
                       "created_at": "2024-01-01", "updated_at": "2024-01-01"}
        cursor.fetchone.return_value = mock_client

        p1, p2 = _client_with_patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/clients/1", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 200

    def test_not_found(self):
        conn, cursor = _make_mocks()
        results = [{"email": "test@example.com"}, None]
        cursor.fetchone.side_effect = results

        p1, p2 = _client_with_patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/clients/999", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 404


class TestCreateClient:
    def test_create_success(self):
        conn, cursor = _make_mocks()
        created = {"id": 1, "name": "New", "description": None, "department": None,
                   "email": None, "created_at": "2024-01-01", "updated_at": "2024-01-01"}
        cursor.fetchone.return_value = {"email": "test@example.com"}
        cursor.lastrowid = 1

        orig_fetchone = cursor.fetchone.side_effect
        call_count = [0]

        def side_effect(*a):
            call_count[0] += 1
            if call_count[0] <= 1:
                return {"email": "test@example.com"}
            return created

        cursor.fetchone.side_effect = side_effect

        p1, p2 = _client_with_patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(
                "/api/clients",
                json={"name": "New"},
                headers={"x-user-email": "test@example.com"},
            )
            assert resp.status_code == 201
            assert resp.json()["message"] == "Client created successfully"

    def test_create_missing_name(self):
        conn, cursor = _make_mocks()
        cursor.fetchone.return_value = {"email": "test@example.com"}

        p1, p2 = _client_with_patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(
                "/api/clients",
                json={},
                headers={"x-user-email": "test@example.com"},
            )
            assert resp.status_code == 400


class TestDeleteClient:
    def test_delete_success(self):
        conn, cursor = _make_mocks()
        call_count = [0]

        def side_effect(*a):
            call_count[0] += 1
            if call_count[0] == 1:
                return {"email": "test@example.com"}
            return {"id": 1}

        cursor.fetchone.side_effect = side_effect

        p1, p2 = _client_with_patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.delete("/api/clients/1", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 200
            assert resp.json()["message"] == "Client deleted successfully"

    def test_delete_not_found(self):
        conn, cursor = _make_mocks()
        results = [{"email": "test@example.com"}, None]
        cursor.fetchone.side_effect = results

        p1, p2 = _client_with_patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.delete("/api/clients/999", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 404
