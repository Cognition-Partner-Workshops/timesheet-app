"""PostgreSQL helpers used by the import pipeline."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

from src.config import AppConfig

logger = logging.getLogger(__name__)


def connect_db(config: AppConfig):
    logger.info("Connecting to PostgreSQL database %s on %s:%s", config.pg_database, config.pg_host, config.pg_port)
    return psycopg2.connect(**config.db_config)


def execute_sql_file(conn, sql_path: Path):
    logger.info("Executing SQL file: %s", sql_path)
    sql = sql_path.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(sql)


def bulk_insert(conn, sql: str, rows: List[Tuple], label: str, page_size: int = 1000):
    if not rows:
        logger.info("%s: no rows to load", label)
        return

    logger.info("%s: loading %d rows", label, len(rows))
    with conn.cursor() as cur:
        execute_values(cur, sql, rows, page_size=page_size)


def fetch_map(conn, table: str, key_col: str, id_col: str) -> Dict[str, str]:
    sql = f"SELECT {key_col}, {id_col} FROM {table}"
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql)
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
