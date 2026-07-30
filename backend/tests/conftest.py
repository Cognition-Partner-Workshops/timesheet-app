from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.app import app


@pytest.fixture
def mock_conn():
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return conn, cursor


@pytest.fixture
def client(mock_conn):
    conn, cursor = mock_conn

    # Auth middleware: user exists
    def get_side_effect(query, params=None):
        pass

    cursor.fetchone.return_value = {"email": "test@example.com"}

    with patch("src.database.pymysql") as mock_pymysql, \
         patch("src.dependencies.get_connection") as mock_dep_conn:
        mock_pymysql.connect.return_value = conn
        mock_dep_conn.return_value = conn
        yield TestClient(app, raise_server_exceptions=False), cursor, conn


@pytest.fixture
def unauthed_client(mock_conn):
    conn, cursor = mock_conn
    with patch("src.database.pymysql") as mock_pymysql:
        mock_pymysql.connect.return_value = conn
        yield TestClient(app, raise_server_exceptions=False), cursor, conn
