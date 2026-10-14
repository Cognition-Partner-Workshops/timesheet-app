"""Unit tests for language detection utilities."""

from threat_intel.models.domain import Language
from threat_intel.utils.language_detection import detect_language, is_supported_file


class TestDetectLanguage:
    def test_python(self) -> None:
        assert detect_language("main.py") == Language.PYTHON

    def test_javascript(self) -> None:
        assert detect_language("app.js") == Language.JAVASCRIPT

    def test_typescript(self) -> None:
        assert detect_language("component.ts") == Language.TYPESCRIPT

    def test_java(self) -> None:
        assert detect_language("Main.java") == Language.JAVA

    def test_c(self) -> None:
        assert detect_language("utils.c") == Language.C

    def test_cpp(self) -> None:
        assert detect_language("engine.cpp") == Language.CPP

    def test_go(self) -> None:
        assert detect_language("server.go") == Language.GO

    def test_rust(self) -> None:
        assert detect_language("lib.rs") == Language.RUST

    def test_ruby(self) -> None:
        assert detect_language("app.rb") == Language.RUBY

    def test_php(self) -> None:
        assert detect_language("index.php") == Language.PHP

    def test_csharp(self) -> None:
        assert detect_language("Program.cs") == Language.CSHARP

    def test_unknown_extension(self) -> None:
        assert detect_language("readme.md") == Language.UNKNOWN

    def test_no_extension(self) -> None:
        assert detect_language("Makefile") == Language.UNKNOWN

    def test_nested_path(self) -> None:
        assert detect_language("/home/user/project/src/main.py") == Language.PYTHON

    def test_case_insensitive(self) -> None:
        assert detect_language("Test.PY") == Language.PYTHON


class TestIsSupportedFile:
    def test_supported(self) -> None:
        extensions = [".py", ".js", ".ts"]
        assert is_supported_file("test.py", extensions) is True
        assert is_supported_file("app.js", extensions) is True

    def test_unsupported(self) -> None:
        extensions = [".py", ".js"]
        assert is_supported_file("readme.md", extensions) is False
        assert is_supported_file("data.csv", extensions) is False

    def test_empty_extensions(self) -> None:
        assert is_supported_file("test.py", []) is False
