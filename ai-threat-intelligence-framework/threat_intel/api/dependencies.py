"""FastAPI dependency injection for shared resources."""

from __future__ import annotations

from threat_intel.analyzers.llm_analyzer import LLMAnalyzer
from threat_intel.collectors.github_advisory_collector import GitHubAdvisoryCollector
from threat_intel.collectors.nvd_collector import NVDCollector
from threat_intel.mitigators.mitigation_engine import MitigationEngine
from threat_intel.preprocessors.code_preprocessor import CodePreprocessor, PreprocessingConfig
from threat_intel.scanners.git_scanner import GitScanner
from threat_intel.scanners.repo_scanner import RepoScanner

_analyzer: LLMAnalyzer | None = None
_mitigation_engine: MitigationEngine | None = None
_preprocessor: CodePreprocessor | None = None
_repo_scanner: RepoScanner | None = None
_git_scanner: GitScanner | None = None
_nvd_collector: NVDCollector | None = None
_github_collector: GitHubAdvisoryCollector | None = None


def init_services(
    openai_api_key: str,
    openai_model: str = "gpt-4",
    nvd_api_key: str | None = None,
    github_token: str | None = None,
    scan_batch_size: int = 50,
    scan_max_file_size_kb: int = 500,
    scan_supported_extensions: list[str] | None = None,
) -> None:
    """Initialize all service singletons."""
    global _analyzer, _mitigation_engine, _preprocessor  # noqa: PLW0603
    global _repo_scanner, _git_scanner, _nvd_collector, _github_collector  # noqa: PLW0603

    _analyzer = LLMAnalyzer(api_key=openai_api_key, model=openai_model)
    _mitigation_engine = MitigationEngine(api_key=openai_api_key, model=openai_model)

    extensions = scan_supported_extensions or [
        ".py", ".js", ".ts", ".java", ".c", ".cpp", ".go", ".rs",
        ".rb", ".php", ".cs", ".swift", ".kt",
    ]

    _preprocessor = CodePreprocessor(
        PreprocessingConfig(
            max_file_size_kb=scan_max_file_size_kb,
            supported_extensions=extensions,
        )
    )

    _repo_scanner = RepoScanner(
        analyzer=_analyzer,
        preprocessor=_preprocessor,
        batch_size=scan_batch_size,
        supported_extensions=extensions,
    )

    _git_scanner = GitScanner(
        analyzer=_analyzer,
        preprocessor=_preprocessor,
        supported_extensions=extensions,
    )

    _nvd_collector = NVDCollector(api_key=nvd_api_key)
    _github_collector = GitHubAdvisoryCollector(token=github_token)


def get_analyzer() -> LLMAnalyzer:
    if _analyzer is None:
        msg = "Services not initialized. Call init_services() first."
        raise RuntimeError(msg)
    return _analyzer


def get_mitigation_engine() -> MitigationEngine:
    if _mitigation_engine is None:
        msg = "Services not initialized. Call init_services() first."
        raise RuntimeError(msg)
    return _mitigation_engine


def get_preprocessor() -> CodePreprocessor:
    if _preprocessor is None:
        msg = "Services not initialized. Call init_services() first."
        raise RuntimeError(msg)
    return _preprocessor


def get_repo_scanner() -> RepoScanner:
    if _repo_scanner is None:
        msg = "Services not initialized. Call init_services() first."
        raise RuntimeError(msg)
    return _repo_scanner


def get_git_scanner() -> GitScanner:
    if _git_scanner is None:
        msg = "Services not initialized. Call init_services() first."
        raise RuntimeError(msg)
    return _git_scanner


def get_nvd_collector() -> NVDCollector:
    if _nvd_collector is None:
        msg = "Services not initialized. Call init_services() first."
        raise RuntimeError(msg)
    return _nvd_collector


def get_github_collector() -> GitHubAdvisoryCollector:
    if _github_collector is None:
        msg = "Services not initialized. Call init_services() first."
        raise RuntimeError(msg)
    return _github_collector
