"""Main orchestration for the Excel to PostgreSQL import pipeline."""

from __future__ import annotations

import logging
import sys
import traceback
from pathlib import Path

from src.config import get_config
from src.db import connect_db, execute_sql_file, fetch_map
from src.loaders.allocations import upsert_allocations
from src.loaders.audit import insert_import_audit_event
from src.loaders.capacity import upsert_employee_capacity
from src.loaders.employees import upsert_employees
from src.loaders.evidence import upsert_employee_evidence
from src.loaders.projects import upsert_projects
from src.loaders.proposals import upsert_imported_ewa
from src.loaders.roles import upsert_project_roles
from src.loaders.skills import upsert_employee_skills
from src.loaders.source_records import preserve_unmapped_sheets
from src.loaders.users import upsert_default_project_stakeholders, upsert_users
from src.loaders.workbook import load_workbook

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SQL_DIR = PROJECT_ROOT / "sql"


def create_schema(conn):
    execute_sql_file(conn, SQL_DIR / "01_schema.sql")


def create_indexes(conn):
    execute_sql_file(conn, SQL_DIR / "02_indexes.sql")


def analyze_tables(conn):
    execute_sql_file(conn, SQL_DIR / "03_analyze.sql")


def import_all(conn, config):
    sheets = load_workbook(config.excel_path)

    # Preserve reference/configuration sheets so no source information is lost.
    preserve_unmapped_sheets(conn, sheets, config)

    # Seed app users first. Stakeholders are assigned after projects exist.
    upsert_users(conn, config)

    # Project demand.
    upsert_projects(conn, sheets, config)
    project_map = fetch_map(conn, "projects", "project_code", "project_id")
    upsert_default_project_stakeholders(conn)

    # Employee supply.
    upsert_employees(conn, sheets, config)
    employee_map = fetch_map(conn, "employees", "employee_code", "employee_id")
    upsert_employee_skills(conn, sheets, employee_map, config)
    upsert_employee_capacity(conn, sheets, employee_map, config)

    # Role demand.
    upsert_project_roles(conn, sheets, project_map, config)
    role_map = fetch_map(conn, "project_roles", "role_code", "role_id")

    # Booking history and evidence.
    upsert_allocations(conn, sheets, employee_map, project_map, config)
    upsert_employee_evidence(conn, sheets, employee_map, project_map, role_map, config)

    # Existing EWA rows become imported proposal/candidate/review workflow records.
    upsert_imported_ewa(conn, sheets, employee_map, project_map, role_map, config)

    insert_import_audit_event(conn, config)


def main():
    config = get_config()
    conn = None

    try:
        conn = connect_db(config)
        conn.autocommit = False

        logger.info("Creating schema")
        create_schema(conn)

        logger.info("Starting workbook import")
        import_all(conn, config)

        logger.info("Creating indexes")
        create_indexes(conn)

        logger.info("Analyzing tables")
        analyze_tables(conn)

        conn.commit()
        logger.info("Import committed successfully")

    except Exception as exc:
        logger.error("Import failed: %s", exc)
        logger.error(traceback.format_exc())
        if conn:
            conn.rollback()
            logger.info("Transaction rolled back")
        sys.exit(1)

    finally:
        if conn:
            conn.close()
            logger.info("Database connection closed")


if __name__ == "__main__":
    main()
