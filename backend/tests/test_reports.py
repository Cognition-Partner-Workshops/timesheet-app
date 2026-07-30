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
    return patch("src.routes.reports.get_connection", return_value=conn), \
           patch("src.dependencies.get_connection", return_value=conn)


def _setup_report_data(cursor):
    client_data = {"id": 1, "name": "Client A"}
    entries = [
        {"id": 1, "hours": 8.0, "description": "Work day 1", "date": "2024-01-01",
         "created_at": "2024-01-01 10:00:00", "updated_at": "2024-01-01 10:00:00"},
        {"id": 2, "hours": 4.5, "description": "Work day 2", "date": "2024-01-02",
         "created_at": "2024-01-02 10:00:00", "updated_at": "2024-01-02 10:00:00"},
    ]

    call_count = [0]

    def fetchone_side(*a):
        call_count[0] += 1
        if call_count[0] == 1:
            return {"email": "test@example.com"}
        return client_data

    cursor.fetchone.side_effect = fetchone_side
    cursor.fetchall.return_value = entries
    return client_data, entries


class TestGetClientReport:
    def test_returns_report(self):
        conn, cursor = _make_mocks()
        client_data, entries = _setup_report_data(cursor)

        p1, p2 = _patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/reports/client/1", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 200
            body = resp.json()
            assert body["client"]["name"] == "Client A"
            assert abs(body["totalHours"] - 12.5) < 0.01
            assert body["entryCount"] == 2

    def test_client_not_found(self):
        conn, cursor = _make_mocks()
        results = [{"email": "test@example.com"}, None]
        cursor.fetchone.side_effect = results

        p1, p2 = _patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/reports/client/999", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 404


class TestExportCsv:
    def test_csv_export(self):
        conn, cursor = _make_mocks()
        _setup_report_data(cursor)

        p1, p2 = _patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/reports/export/csv/1", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 200
            assert "text/csv" in resp.headers["content-type"]
            assert "attachment" in resp.headers["content-disposition"]
            content = resp.text
            assert "Date" in content
            assert "Hours" in content


class TestExportPdf:
    def test_pdf_export(self):
        conn, cursor = _make_mocks()
        _setup_report_data(cursor)

        p1, p2 = _patches(conn)
        with p1, p2:
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/reports/export/pdf/1", headers={"x-user-email": "test@example.com"})
            assert resp.status_code == 200
            assert "application/pdf" in resp.headers["content-type"]
            assert resp.content[:4] == b"%PDF"
