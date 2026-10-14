"""Application settings using pydantic-settings for validation and environment loading."""

from __future__ import annotations

from enum import Enum
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class LLMProvider(str, Enum):
    OPENAI = "openai"
    AZURE_OPENAI = "azure_openai"
    LOCAL = "local"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="THREAT_INTEL_",
        case_sensitive=False,
    )

    # General
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False
    log_level: str = "INFO"
    project_name: str = "AI Threat Intelligence Framework"

    # API
    api_host: str = "0.0.0.0"  # noqa: S104
    api_port: int = 8000
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/threat_intel.db"

    # LLM Configuration
    llm_provider: LLMProvider = LLMProvider.OPENAI
    openai_api_key: SecretStr = SecretStr("")
    openai_model: str = "gpt-4"
    openai_temperature: float = 0.1
    openai_max_tokens: int = 4096

    # Azure OpenAI (optional)
    azure_openai_endpoint: str = ""
    azure_openai_api_key: SecretStr = SecretStr("")
    azure_openai_deployment: str = ""
    azure_openai_api_version: str = "2024-02-01"

    # NVD API
    nvd_api_key: str | None = None
    nvd_base_url: str = "https://services.nvd.nist.gov/rest/json/cves/2.0"

    # GitHub Advisory API
    github_token: str | None = None
    github_advisory_url: str = "https://api.github.com/graphql"

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # Scanner
    scan_batch_size: int = 50
    scan_max_file_size_kb: int = 500
    scan_supported_extensions: list[str] = Field(
        default_factory=lambda: [
            ".py", ".js", ".ts", ".java", ".c", ".cpp", ".go", ".rs",
            ".rb", ".php", ".cs", ".swift", ".kt",
        ]
    )

    # Paths
    data_dir: Path = Path("data")
    raw_data_dir: Path = Path("data/raw")
    processed_data_dir: Path = Path("data/processed")

    # Rate Limiting
    rate_limit_requests: int = 100
    rate_limit_window_seconds: int = 60


def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
