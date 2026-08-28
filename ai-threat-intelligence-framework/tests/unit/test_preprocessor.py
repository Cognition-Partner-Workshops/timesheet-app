"""Unit tests for the code preprocessor."""

import tempfile

from threat_intel.models.domain import Language
from threat_intel.preprocessors.code_preprocessor import (
    CodePreprocessor,
    PreprocessingConfig,
    VulnerabilityDataPreprocessor,
)


class TestCodePreprocessor:
    def test_preprocess_code_string_single_chunk(self) -> None:
        preprocessor = CodePreprocessor()
        code = "x = 1\ny = 2\nz = x + y"
        snippets = preprocessor.preprocess_code_string(code, "test.py", Language.PYTHON)
        assert len(snippets) == 1
        assert snippets[0].language == Language.PYTHON
        assert snippets[0].file_path == "test.py"
        assert snippets[0].start_line == 1

    def test_preprocess_code_string_splitting(self) -> None:
        config = PreprocessingConfig(max_snippet_lines=5, overlap_lines=2)
        preprocessor = CodePreprocessor(config)
        code = "\n".join(f"line_{i}" for i in range(20))
        snippets = preprocessor.preprocess_code_string(code, "test.py", Language.PYTHON)
        assert len(snippets) > 1
        for snippet in snippets:
            assert snippet.line_count() <= 5

    def test_preprocess_file_nonexistent(self) -> None:
        preprocessor = CodePreprocessor()
        snippets = preprocessor.preprocess_file("/nonexistent/file.py")
        assert snippets == []

    def test_preprocess_file_unsupported_extension(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
            f.write(b"some text content")
            f.flush()
            preprocessor = CodePreprocessor()
            snippets = preprocessor.preprocess_file(f.name)
            assert snippets == []

    def test_preprocess_file_valid(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
            f.write("import os\nprint(os.getcwd())\n")
            f.flush()
            preprocessor = CodePreprocessor()
            snippets = preprocessor.preprocess_file(f.name)
            assert len(snippets) == 1
            assert snippets[0].language == Language.PYTHON

    def test_preprocess_file_too_large(self) -> None:
        config = PreprocessingConfig(max_file_size_kb=0)
        preprocessor = CodePreprocessor(config)
        with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
            f.write("x = 1\n")
            f.flush()
            snippets = preprocessor.preprocess_file(f.name)
            assert snippets == []

    def test_normalize_whitespace(self) -> None:
        content = "line1  \n\n\n\n\nline2\n"
        result = CodePreprocessor._normalize_whitespace(content)
        lines = result.split("\n")
        blank_runs = 0
        current_blank = 0
        for line in lines:
            if not line:
                current_blank += 1
            else:
                blank_runs = max(blank_runs, current_blank)
                current_blank = 0
        assert blank_runs <= 2

    def test_strip_comments_python(self) -> None:
        config = PreprocessingConfig(strip_comments=True)
        preprocessor = CodePreprocessor(config)
        code = '# this is a comment\nx = 1\n"""docstring"""\ny = 2'
        snippets = preprocessor.preprocess_code_string(code, "test.py", Language.PYTHON)
        assert len(snippets) == 1
        assert "# this is a comment" not in snippets[0].content

    def test_strip_comments_javascript(self) -> None:
        config = PreprocessingConfig(strip_comments=True)
        preprocessor = CodePreprocessor(config)
        code = "// single line\nconst x = 1;\n/* multi\nline */\nconst y = 2;"
        snippets = preprocessor.preprocess_code_string(code, "test.js", Language.JAVASCRIPT)
        assert len(snippets) == 1
        assert "// single line" not in snippets[0].content
        assert "multi" not in snippets[0].content


class TestVulnerabilityDataPreprocessor:
    def test_normalize_cve_description(self) -> None:
        desc = "A  vulnerability  in  https://example.com/api  allows  remote  code  execution."
        result = VulnerabilityDataPreprocessor.normalize_cve_description(desc)
        assert "  " not in result
        assert "[URL]" in result

    def test_extract_vulnerability_patterns_eval(self) -> None:
        code = "result = eval(user_input)"
        patterns = VulnerabilityDataPreprocessor.extract_vulnerability_patterns(
            code, Language.PYTHON
        )
        assert patterns["uses_eval"] is True
        assert patterns["uses_raw_sql"] is False

    def test_extract_vulnerability_patterns_sql(self) -> None:
        code = 'cursor.execute(f"SELECT * FROM users WHERE id={user_id}")'
        patterns = VulnerabilityDataPreprocessor.extract_vulnerability_patterns(
            code, Language.PYTHON
        )
        assert patterns["uses_raw_sql"] is True

    def test_extract_vulnerability_patterns_shell(self) -> None:
        code = "os.system('rm -rf ' + user_input)"
        patterns = VulnerabilityDataPreprocessor.extract_vulnerability_patterns(
            code, Language.PYTHON
        )
        assert patterns["uses_shell"] is True

    def test_extract_vulnerability_patterns_clean_code(self) -> None:
        code = "x = 1\ny = x + 2\nprint(y)"
        patterns = VulnerabilityDataPreprocessor.extract_vulnerability_patterns(
            code, Language.PYTHON
        )
        assert all(not v for v in patterns.values())

    def test_extract_hardcoded_secrets(self) -> None:
        code = 'password = "super_secret_123"'
        patterns = VulnerabilityDataPreprocessor.extract_vulnerability_patterns(
            code, Language.PYTHON
        )
        assert patterns["hardcoded_secrets"] is True

    def test_extract_http_without_tls(self) -> None:
        code = 'url = "http://api.example.com/data"'
        patterns = VulnerabilityDataPreprocessor.extract_vulnerability_patterns(
            code, Language.PYTHON
        )
        assert patterns["uses_http_without_tls"] is True

    def test_localhost_http_is_ok(self) -> None:
        code = 'url = "http://localhost:8080/api"'
        patterns = VulnerabilityDataPreprocessor.extract_vulnerability_patterns(
            code, Language.PYTHON
        )
        assert patterns["uses_http_without_tls"] is False
