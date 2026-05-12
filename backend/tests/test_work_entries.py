from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from src.app import app


def _make_mocks():
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return conn, cursor


def _patches(conn):
    return patch("src.routes.work_entries.get_connection", return_value=conn), \
           patch("src.dependencies.get_connection", return_value=conn)


class TestGetWorkEntries:
    def test_returns_entries(self):
        conn, cursor = _make_mocks()
        entries = [{"id": 1, "client_id": 1, "hours": 8, "description": "Work",
                    "date": "2024-01-01", "created_at": "2024-01-01",
                    "updated_at": "2024-01-01", "client_name": "Client A"}]
        cursor.fetchone.return_value = {"email": "test@example.com"}
        cursor.fetchall.return_value = entries

        p1, p2 = _patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/work-entries", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 200
            assert resp.json()["workEntries"] == entries

    def test_filter_by_client(self):
        conn, cursor = _make_mocks()
        cursor.fetchone.return_value = {"email": "test@example.com"}
        cursor.fetchall.return_value = []

        p1, p2 = _patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/work-entries?clientId=1", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 200


class TestGetWorkEntry:
    def test_returns_entry(self):
        conn, cursor = _make_mocks()
        entry = {"id": 1, "client_id": 1, "hours": 8, "description": "Work",
                 "date": "2024-01-01", "created_at": "2024-01-01",
                 "updated_at": "2024-01-01", "client_name": "Client A"}
        cursor.fetchone.return_value = entry

        p1, p2 = _patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/work-entries/1", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 200

    def test_not_found(self):
        conn, cursor = _make_mocks()
        results = [{"email": "test@example.com"}, None]
        cursor.fetchone.side_effect = results

        p1, p2 = _patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/work-entries/999", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 404


class TestCreateWorkEntry:
    def test_create_success(self):
        conn, cursor = _make_mocks()
        cursor.lastrowid = 1
        created = {"id": 1, "client_id": 1, "hours": 8, "description": "Work",
                   "date": "2024-01-01", "created_at": "2024-01-01",
                   "updated_at": "2024-01-01", "client_name": "Client A"}
        call_count = [0]

        def side_effect(*a):
            call_count[0] += 1
            if call_count[0] == 1:
                return {"email": "test@example.com"}
            if call_count[0] == 2:
                return {"id": 1}
            return created

        cursor.fetchone.side_effect = side_effect

        p1, p2 = _patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(
                "/api/work-entries",
                json={"clientId": 1, "hours": 8, "description": "Work", "date": "2024-01-01"},
                headers={"x-user-email": "test@example.com"},
            )
            assert resp.status_code == 201
            assert resp.json()["message"] == "Work entry created successfully"

    def test_create_invalid_client(self):
        conn, cursor = _make_mocks()
        results = [{"email": "test@example.com"}, None]
        cursor.fetchone.side_effect = results

        p1, p2 = _patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(
                "/api/work-entries",
                json={"clientId": 999, "hours": 8, "date": "2024-01-01"},
                headers={"x-user-email": "test@example.com"},
            )
            assert resp.status_code == 400


class TestDeleteWorkEntry:
    def test_delete_success(self):
        conn, cursor = _make_mocks()
        call_count = [0]

        def side_effect(*a):
            call_count[0] += 1
            if call_count[0] == 1:
                return {"email": "test@example.com"}
            return {"id": 1}

        cursor.fetchone.side_effect = side_effect

        p1, p2 = _patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.delete("/api/work-entries/1", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 200
            assert resp.json()["message"] == "Work entry deleted successfully"

    def test_delete_not_found(self):
        conn, cursor = _make_mocks()
        results = [{"email": "test@example.com"}, None]
        cursor.fetchone.side_effect = results

        p1, p2 = _patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.delete("/api/work-entries/999", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 404
