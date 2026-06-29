"""PostgreSQL helpers used by the import pipeline."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor, execute_values

from src.config import AppConfig

logger = logging.getLogger(__name__)


def connect_db(config: AppConfig):
    logger.info("Connecting to PostgreSQL database %s on %s:%s", config.pg_database, config.pg_host, config.pg_port)
    return psycopg2.connect(**config.db_config)


# DDL/migration scripts that ship with the loader. Only these vetted,
# version-controlled files may be executed by ``execute_sql_file`` — the
# function never runs arbitrary or user-supplied SQL.
_SQL_DIR = (Path(__file__).resolve().parent.parent / "sql").resolve()
_ALLOWED_SQL_FILES = frozenset(
    {
        "01_schema.sql",
        "02_indexes.sql",
        "03_analyze.sql",
        "04_rag_schema.sql",
    }
)


def execute_sql_file(conn, sql_path: Path):
    """Run one of the bundled DDL files.

    The path is validated against a fixed allowlist of files inside the
    loader's ``sql/`` directory, so the executed statements are always
    trusted, repo-controlled migration scripts and never user input.
    """
    resolved = Path(sql_path).resolve()
    if resolved.parent != _SQL_DIR or resolved.name not in _ALLOWED_SQL_FILES:
        raise ValueError(f"Refusing to execute non-allowlisted SQL file: {sql_path}")

    logger.info("Executing SQL file: %s", resolved.name)
    sql_text = resolved.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(sql_text)  # NOSONAR S3649 - trusted bundled DDL, path allowlisted above


def bulk_insert(conn, sql: str, rows: List[Tuple], label: str, page_size: int = 1000):
    if not rows:
        logger.info("%s: no rows to load", label)
        return

    logger.info("%s: loading %d rows", label, len(rows))
    with conn.cursor() as cur:
        execute_values(cur, sql, rows, page_size=page_size)


def fetch_map(conn, table: str, key_col: str, id_col: str) -> Dict[str, str]:
    # Compose identifiers safely so they are quoted/escaped by psycopg2 rather
    # than interpolated into the SQL string.
    query = sql.SQL("SELECT {key}, {id} FROM {table}").format(
        key=sql.Identifier(key_col),
        id=sql.Identifier(id_col),
        table=sql.Identifier(table),
    )
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query)
        rows = cur.fetchall()

    return {str(row[key_col]): str(row[id_col]) for row in rows if row[key_col] is not None}


def fetch_one(conn, sql: str, params: tuple = ()): 
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def fetch_all(conn, sql: str, params: tuple = ()): 
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        return cur.fetchall()
