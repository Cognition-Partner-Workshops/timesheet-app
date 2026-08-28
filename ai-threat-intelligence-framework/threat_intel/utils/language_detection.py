"""Detect programming language from file extensions."""

from __future__ import annotations

from pathlib import Path

from threat_intel.models.domain import EXTENSION_TO_LANGUAGE, Language


def detect_language(file_path: str) -> Language:
    """Detect the programming language from a file path's extension."""
    suffix = Path(file_path).suffix.lower()
    return EXTENSION_TO_LANGUAGE.get(suffix, Language.UNKNOWN)


def is_supported_file(file_path: str, supported_extensions: list[str]) -> bool:
    """Check if a file extension is in the supported set."""
    suffix = Path(file_path).suffix.lower()
    return suffix in supported_extensions
