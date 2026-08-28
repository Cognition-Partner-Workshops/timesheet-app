"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class AppConfig:
    pg_host: str
    pg_port: int
    pg_database: str
    pg_user: str
    pg_password: str
    excel_path: str
    fernet_key: str
    name_hash_salt: str
    store_raw_pii: bool
    reference_date: Optional[str]
    sarah_name: str
    sarah_email: str
    jenny_name: str
    jenny_email: str
    raj_name: str
    raj_email: str

    @property
    def db_config(self) -> dict:
        return {
            "host": self.pg_host,
            "port": self.pg_port,
            "dbname": self.pg_database,
            "user": self.pg_user,
            "password": self.pg_password,
        }


def get_config() -> AppConfig:
    return AppConfig(
        pg_host=os.getenv("PGHOST", "<PG_HOST>"),
        pg_port=int(os.getenv("PGPORT", "5432")),
        pg_database=os.getenv("PGDATABASE", "<PG_DATABASE>"),
        pg_user=os.getenv("PGUSER", "<PG_USER>"),
        pg_password=os.getenv("PGPASSWORD", "<PG_PASSWORD>"),
        excel_path=os.getenv("EXCEL_PATH", "./InSync_Hackathon_APAC_India_MENA_WFP_Dataset_500(2).xlsx"),
        fernet_key=os.getenv("FERNET_KEY", ""),
        name_hash_salt=os.getenv("NAME_HASH_SALT", ""),
        store_raw_pii=os.getenv("STORE_RAW_PII", "false").lower() == "true",
        reference_date=os.getenv("REFERENCE_DATE") or None,
        sarah_name=os.getenv("SARAH_NAME", "Sarah Planner"),
        sarah_email=os.getenv("SARAH_EMAIL", "sarah.planner@example.com"),
        jenny_name=os.getenv("JENNY_NAME", "Jenny Client Manager"),
        jenny_email=os.getenv("JENNY_EMAIL", "jenny.client@example.com"),
        raj_name=os.getenv("RAJ_NAME", "Raj Delivery Manager"),
        raj_email=os.getenv("RAJ_EMAIL", "raj.delivery@example.com"),
    )
