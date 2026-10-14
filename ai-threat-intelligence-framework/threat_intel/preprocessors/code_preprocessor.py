"""Preprocessing pipeline for source code before LLM analysis."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from threat_intel.models.domain import CodeSnippet, Language
from threat_intel.utils.language_detection import detect_language, is_supported_file
from threat_intel.utils.logging import get_logger

logger = get_logger(__name__)


@dataclass
class PreprocessingConfig:
    """Configuration for the code preprocessing pipeline."""

    max_file_size_kb: int = 500
    max_snippet_lines: int = 200
    overlap_lines: int = 20
    strip_comments: bool = False
    normalize_whitespace: bool = True
    supported_extensions: list[str] = field(
        default_factory=lambda: [
            ".py", ".js", ".ts", ".java", ".c", ".cpp", ".go", ".rs",
            ".rb", ".php", ".cs", ".swift", ".kt",
        ]
    )


COMMENT_PATTERNS: dict[Language, list[re.Pattern[str]]] = {
    Language.PYTHON: [
        re.compile(r'"""[\s\S]*?"""', re.MULTILINE),
        re.compile(r"'''[\s\S]*?'''", re.MULTILINE),
        re.compile(r"#.*$", re.MULTILINE),
    ],
    Language.JAVASCRIPT: [
        re.compile(r"/\*[\s\S]*?\*/", re.MULTILINE),
        re.compile(r"//.*$", re.MULTILINE),
    ],
    Language.JAVA: [
        re.compile(r"/\*[\s\S]*?\*/", re.MULTILINE),
        re.compile(r"//.*$", re.MULTILINE),
    ],
    Language.C: [
        re.compile(r"/\*[\s\S]*?\*/", re.MULTILINE),
        re.compile(r"//.*$", re.MULTILINE),
    ],
    Language.GO: [
        re.compile(r"/\*[\s\S]*?\*/", re.MULTILINE),
        re.compile(r"//.*$", re.MULTILINE),
    ],
}


class CodePreprocessor:
    """Prepares source code for LLM-based vulnerability analysis."""

    def __init__(self, config: PreprocessingConfig | None = None) -> None:
        self._config = config or PreprocessingConfig()

    def preprocess_file(self, file_path: str) -> list[CodeSnippet]:
        """Read and preprocess a single source file into analyzable snippets."""
        path = Path(file_path)

        if not path.is_file():
            logger.warning("file_not_found", path=file_path)
            return []

        if not is_supported_file(file_path, self._config.supported_extensions):
            logger.debug("unsupported_file_type", path=file_path)
            return []

        file_size_kb = path.stat().st_size / 1024
        if file_size_kb > self._config.max_file_size_kb:
            logger.warning("file_too_large", path=file_path, size_kb=file_size_kb)
            return []

        try:
            content = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            logger.error("file_read_error", path=file_path, error=str(exc))
            return []

        language = detect_language(file_path)
        processed = self._apply_transforms(content, language)
        return self._split_into_snippets(processed, file_path, language)

    def preprocess_code_string(
        self,
        code: str,
        file_path: str = "<inline>",
        language: Language = Language.UNKNOWN,
    ) -> list[CodeSnippet]:
        """Preprocess a raw code string into analyzable snippets."""
        processed = self._apply_transforms(code, language)
        return self._split_into_snippets(processed, file_path, language)

    def _apply_transforms(self, content: str, language: Language) -> str:
        """Apply configured transformations to the source code."""
        result = content

        if self._config.strip_comments:
            result = self._remove_comments(result, language)

        if self._config.normalize_whitespace:
            result = self._normalize_whitespace(result)

        return result

    def _remove_comments(self, content: str, language: Language) -> str:
        """Remove comments based on language-specific patterns."""
        patterns = COMMENT_PATTERNS.get(language, [])
        # Fall back to C-style comments for languages sharing the same syntax
        if not patterns and language in (Language.CPP, Language.RUST, Language.CSHARP,
                                         Language.KOTLIN, Language.SWIFT, Language.PHP):
            patterns = COMMENT_PATTERNS.get(Language.C, [])

        for pattern in patterns:
            content = pattern.sub("", content)
        return content

    @staticmethod
    def _normalize_whitespace(content: str) -> str:
        """Normalize trailing whitespace and collapse excessive blank lines."""
        lines = content.splitlines()
        cleaned = [line.rstrip() for line in lines]
        result_lines: list[str] = []
        blank_count = 0
        for line in cleaned:
            if not line:
                blank_count += 1
                if blank_count <= 2:
                    result_lines.append(line)
            else:
                blank_count = 0
                result_lines.append(line)
        return "\n".join(result_lines)

    def _split_into_snippets(
        self, content: str, file_path: str, language: Language
    ) -> list[CodeSnippet]:
        """Split content into overlapping snippets for chunk-based analysis."""
        lines = content.splitlines()
        total_lines = len(lines)
        max_lines = self._config.max_snippet_lines
        overlap = self._config.overlap_lines

        if total_lines <= max_lines:
            return [
                CodeSnippet(
                    file_path=file_path,
                    content=content,
                    language=language,
                    start_line=1,
                    end_line=total_lines,
                )
            ]

        snippets: list[CodeSnippet] = []
        start = 0
        step = max(1, max_lines - overlap)

        while start < total_lines:
            end = min(start + max_lines, total_lines)
            chunk = "\n".join(lines[start:end])
            snippets.append(
                CodeSnippet(
                    file_path=file_path,
                    content=chunk,
                    language=language,
                    start_line=start + 1,
                    end_line=end,
                )
            )
            if end >= total_lines:
                break
            start += step

        logger.info("code_split", file=file_path, snippets=len(snippets))
        return snippets


class VulnerabilityDataPreprocessor:
    """Preprocesses historical vulnerability data for model training context."""

    @staticmethod
    def normalize_cve_description(description: str) -> str:
        """Clean and normalize a CVE description."""
        result = re.sub(r"\s+", " ", description).strip()
        return re.sub(r"https?://\S+", "[URL]", result)

    @staticmethod
    def extract_vulnerability_patterns(code: str, language: Language) -> dict[str, bool]:
        """Extract boolean indicators of common vulnerability patterns."""
        patterns: dict[str, list[str]] = {
            "uses_eval": [r"\beval\s*\(", r"\bexec\s*\("],
            "uses_raw_sql": [
                r"execute\s*\(\s*[\"'].*%",
                r"cursor\.execute\s*\(\s*f[\"']",
                r"\.raw\s*\(",
            ],
            "uses_shell": [
                r"\bos\.system\s*\(",
                r"\bsubprocess\.(call|run|Popen)\s*\(",
                r"child_process",
            ],
            "uses_unsafe_deserialization": [
                r"\bpickle\.loads?\s*\(",
                r"\byaml\.load\s*\(",
                r"\bunserialize\s*\(",
            ],
            "hardcoded_secrets": [
                r"(password|secret|api_key|token)\s*=\s*[\"'][^\"']+[\"']",
            ],
            "uses_http_without_tls": [r"http://(?!localhost|127\.0\.0\.1)"],
            "missing_input_validation": [
                r"request\.(GET|POST|params|query)\[",
                r"req\.(body|params|query)\.",
            ],
        }

        results: dict[str, bool] = {}
        for indicator, regexes in patterns.items():
            results[indicator] = any(re.search(r, code) for r in regexes)
        return results
