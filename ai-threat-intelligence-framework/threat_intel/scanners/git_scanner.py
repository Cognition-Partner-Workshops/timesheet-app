"""Git-aware scanner for analyzing diffs and recent commits."""

from __future__ import annotations

import tempfile
from datetime import datetime, timezone

import git

from threat_intel.analyzers.llm_analyzer import LLMAnalyzer
from threat_intel.models.domain import (
    CodeSnippet,
    ScanResult,
    ScanStatus,
)
from threat_intel.preprocessors.code_preprocessor import CodePreprocessor
from threat_intel.utils.language_detection import detect_language, is_supported_file
from threat_intel.utils.logging import get_logger

logger = get_logger(__name__)


class GitScanner:
    """Scans git repository changes (diffs, commits) for vulnerabilities."""

    def __init__(
        self,
        analyzer: LLMAnalyzer,
        preprocessor: CodePreprocessor | None = None,
        supported_extensions: list[str] | None = None,
    ) -> None:
        self._analyzer = analyzer
        self._preprocessor = preprocessor or CodePreprocessor()
        self._supported_extensions = supported_extensions or [
            ".py", ".js", ".ts", ".java", ".c", ".cpp", ".go", ".rs",
        ]

    async def scan_uncommitted_changes(self, repo_path: str) -> ScanResult:
        """Scan uncommitted (staged + unstaged) changes in a repository."""
        scan = ScanResult(target=repo_path, status=ScanStatus.IN_PROGRESS)
        scan.started_at = datetime.now(timezone.utc)

        try:
            repo = git.Repo(repo_path)
            diff_index = repo.index.diff(None)
            staged_diff = repo.index.diff("HEAD")

            snippets = self._extract_diff_snippets(repo, diff_index)
            snippets.extend(self._extract_diff_snippets(repo, staged_diff))

            scan.files_scanned = len({s.file_path for s in snippets})

            if snippets:
                vulns, mitigations = await self._analyzer.analyze_snippets(snippets)
                scan.vulnerabilities = vulns
                scan.mitigations = mitigations

            scan.status = ScanStatus.COMPLETED
        except git.InvalidGitRepositoryError:
            scan.status = ScanStatus.FAILED
            scan.error_message = f"Not a valid git repository: {repo_path}"
        except Exception as exc:
            scan.status = ScanStatus.FAILED
            scan.error_message = str(exc)
            logger.error("git_scan_failed", error=str(exc))

        scan.completed_at = datetime.now(timezone.utc)
        if scan.started_at:
            scan.duration_seconds = (scan.completed_at - scan.started_at).total_seconds()
        return scan

    async def scan_commit_range(
        self,
        repo_path: str,
        from_commit: str,
        to_commit: str = "HEAD",
    ) -> ScanResult:
        """Scan changes between two commits."""
        scan = ScanResult(
            target=f"{repo_path} ({from_commit}..{to_commit})",
            status=ScanStatus.IN_PROGRESS,
        )
        scan.started_at = datetime.now(timezone.utc)

        try:
            repo = git.Repo(repo_path)
            commit_from = repo.commit(from_commit)
            commit_to = repo.commit(to_commit)
            diff_index = commit_from.diff(commit_to)

            snippets = self._extract_diff_snippets(repo, diff_index)
            scan.files_scanned = len({s.file_path for s in snippets})

            if snippets:
                vulns, mitigations = await self._analyzer.analyze_snippets(snippets)
                scan.vulnerabilities = vulns
                scan.mitigations = mitigations

            scan.status = ScanStatus.COMPLETED
        except Exception as exc:
            scan.status = ScanStatus.FAILED
            scan.error_message = str(exc)
            logger.error("commit_range_scan_failed", error=str(exc))

        scan.completed_at = datetime.now(timezone.utc)
        if scan.started_at:
            scan.duration_seconds = (scan.completed_at - scan.started_at).total_seconds()
        return scan

    async def scan_remote_repo(self, repo_url: str, branch: str = "main") -> ScanResult:
        """Clone and scan a remote repository."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            logger.info("cloning_repo", url=repo_url, branch=branch)
            try:
                git.Repo.clone_from(repo_url, tmp_dir, branch=branch, depth=1)
            except git.GitCommandError as exc:
                return ScanResult(
                    target=repo_url,
                    status=ScanStatus.FAILED,
                    error_message=f"Clone failed: {exc}",
                )

            from threat_intel.scanners.repo_scanner import RepoScanner

            repo_scanner = RepoScanner(
                analyzer=self._analyzer,
                preprocessor=self._preprocessor,
            )
            return await repo_scanner.scan_directory(tmp_dir)

    def _extract_diff_snippets(
        self,
        repo: git.Repo,
        diff_index: git.DiffIndex,  # type: ignore[type-arg]
    ) -> list[CodeSnippet]:
        """Extract code snippets from a git diff."""
        snippets: list[CodeSnippet] = []

        for diff_item in diff_index:
            file_path = diff_item.b_path or diff_item.a_path
            if not file_path:
                continue

            if not is_supported_file(file_path, self._supported_extensions):
                continue

            language = detect_language(file_path)

            if diff_item.b_blob is not None:
                try:
                    content = diff_item.b_blob.data_stream.read().decode("utf-8", errors="replace")
                    processed = self._preprocessor.preprocess_code_string(
                        content, file_path, language
                    )
                    snippets.extend(processed)
                except Exception as exc:
                    logger.warning("diff_extract_error", file=file_path, error=str(exc))

        return snippets
