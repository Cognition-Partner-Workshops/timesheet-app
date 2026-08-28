"""Real-time repository scanner that orchestrates code analysis."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from threat_intel.analyzers.llm_analyzer import LLMAnalyzer
from threat_intel.models.domain import (
    Language,
    MitigationRecommendation,
    ScanResult,
    ScanStatus,
    Vulnerability,
)
from threat_intel.preprocessors.code_preprocessor import CodePreprocessor
from threat_intel.utils.language_detection import detect_language, is_supported_file
from threat_intel.utils.logging import get_logger

logger = get_logger(__name__)

DEFAULT_IGNORE_DIRS = frozenset({
    ".git", ".svn", ".hg", "node_modules", "__pycache__", ".tox",
    ".mypy_cache", ".pytest_cache", "venv", ".venv", "env",
    "dist", "build", ".next", ".nuxt", "vendor", "target",
    "bin", "obj", ".idea", ".vscode",
})

DEFAULT_IGNORE_FILES = frozenset({
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "Pipfile.lock", "poetry.lock", "Cargo.lock",
    "go.sum", "composer.lock", "Gemfile.lock",
})


class RepoScanner:
    """Scans repositories or directories for vulnerabilities using LLM analysis."""

    def __init__(
        self,
        analyzer: LLMAnalyzer,
        preprocessor: CodePreprocessor | None = None,
        batch_size: int = 50,
        supported_extensions: list[str] | None = None,
        ignore_dirs: frozenset[str] | None = None,
        ignore_files: frozenset[str] | None = None,
    ) -> None:
        self._analyzer = analyzer
        self._preprocessor = preprocessor or CodePreprocessor()
        self._batch_size = batch_size
        self._supported_extensions = supported_extensions or [
            ".py", ".js", ".ts", ".java", ".c", ".cpp", ".go", ".rs",
            ".rb", ".php", ".cs", ".swift", ".kt",
        ]
        self._ignore_dirs = ignore_dirs or DEFAULT_IGNORE_DIRS
        self._ignore_files = ignore_files or DEFAULT_IGNORE_FILES

    async def scan_directory(self, directory: str) -> ScanResult:
        """Scan all supported files in a directory tree."""
        scan = ScanResult(target=directory, status=ScanStatus.IN_PROGRESS)
        scan.started_at = datetime.now(timezone.utc)

        logger.info("scan_started", target=directory)

        try:
            files = self._discover_files(directory)
            scan.files_scanned = len(files)
            logger.info("files_discovered", count=len(files))

            all_vulns, all_mitigations = await self._analyze_files(files)
            scan.vulnerabilities = all_vulns
            scan.mitigations = all_mitigations
            scan.status = ScanStatus.COMPLETED
        except Exception as exc:
            scan.status = ScanStatus.FAILED
            scan.error_message = str(exc)
            logger.error("scan_failed", error=str(exc))

        scan.completed_at = datetime.now(timezone.utc)
        if scan.started_at:
            scan.duration_seconds = (scan.completed_at - scan.started_at).total_seconds()

        logger.info(
            "scan_completed",
            status=scan.status.value,
            files=scan.files_scanned,
            vulnerabilities=scan.vulnerability_count,
            duration=scan.duration_seconds,
        )
        return scan

    async def scan_file(self, file_path: str) -> ScanResult:
        """Scan a single file for vulnerabilities."""
        scan = ScanResult(target=file_path, status=ScanStatus.IN_PROGRESS)
        scan.started_at = datetime.now(timezone.utc)
        scan.language = detect_language(file_path)

        try:
            snippets = self._preprocessor.preprocess_file(file_path)
            if not snippets:
                scan.status = ScanStatus.COMPLETED
                scan.files_scanned = 0
                return scan

            scan.files_scanned = 1
            vulns, mitigations = await self._analyzer.analyze_snippets(snippets)
            scan.vulnerabilities = vulns
            scan.mitigations = mitigations
            scan.status = ScanStatus.COMPLETED
        except Exception as exc:
            scan.status = ScanStatus.FAILED
            scan.error_message = str(exc)
            logger.error("file_scan_failed", file=file_path, error=str(exc))

        scan.completed_at = datetime.now(timezone.utc)
        if scan.started_at:
            scan.duration_seconds = (scan.completed_at - scan.started_at).total_seconds()
        return scan

    async def scan_code_string(
        self,
        code: str,
        language: Language = Language.UNKNOWN,
        file_path: str = "<inline>",
    ) -> ScanResult:
        """Scan a raw code string for vulnerabilities."""
        scan = ScanResult(target=file_path, status=ScanStatus.IN_PROGRESS, language=language)
        scan.started_at = datetime.now(timezone.utc)

        try:
            snippets = self._preprocessor.preprocess_code_string(code, file_path, language)
            scan.files_scanned = 1
            vulns, mitigations = await self._analyzer.analyze_snippets(snippets)
            scan.vulnerabilities = vulns
            scan.mitigations = mitigations
            scan.status = ScanStatus.COMPLETED
        except Exception as exc:
            scan.status = ScanStatus.FAILED
            scan.error_message = str(exc)

        scan.completed_at = datetime.now(timezone.utc)
        if scan.started_at:
            scan.duration_seconds = (scan.completed_at - scan.started_at).total_seconds()
        return scan

    def _discover_files(self, directory: str) -> list[str]:
        """Recursively discover source files, respecting ignore rules."""
        root = Path(directory)
        if not root.is_dir():
            logger.warning("directory_not_found", path=directory)
            return []

        files: list[str] = []
        for path in root.rglob("*"):
            if not path.is_file():
                continue

            relative_parts = path.relative_to(root).parts
            if any(part in self._ignore_dirs for part in relative_parts):
                continue

            if path.name in self._ignore_files:
                continue

            if is_supported_file(str(path), self._supported_extensions):
                files.append(str(path))

        return sorted(files)

    async def _analyze_files(
        self, files: list[str]
    ) -> tuple[list[Vulnerability], list[MitigationRecommendation]]:
        """Analyze files in batches to manage LLM rate limits."""
        all_vulns: list[Vulnerability] = []
        all_mitigations: list[MitigationRecommendation] = []

        for batch_start in range(0, len(files), self._batch_size):
            batch = files[batch_start : batch_start + self._batch_size]
            batch_num = batch_start // self._batch_size + 1
            logger.info(
                "processing_batch",
                batch=batch_num,
                files_in_batch=len(batch),
            )

            for file_path in batch:
                snippets = self._preprocessor.preprocess_file(file_path)
                if not snippets:
                    continue

                try:
                    vulns, mitigations = await self._analyzer.analyze_snippets(snippets)
                    all_vulns.extend(vulns)
                    all_mitigations.extend(mitigations)
                except Exception as exc:
                    logger.error("file_analysis_error", file=file_path, error=str(exc))

        return all_vulns, all_mitigations
