"""Unit tests: LLM provider resolution by LLM_PROVIDER (env-only switching)."""
from __future__ import annotations

from app import config, llm


def _fresh_service() -> llm.LLMService:
    return llm.LLMService()


def test_mock_provider_returns_none_for_deterministic_fallback():
    provider = llm.MockProvider()
    assert provider.available() is True
    assert provider.chat([{"role": "user", "content": "hi"}]) is None


def test_resolve_gemini_when_key_present(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(config, "GEMINI_API_KEY", "test-key")
    assert _fresh_service().provider_name == "gemini"


def test_resolve_openai_when_key_present(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "openai")
    monkeypatch.setattr(config, "OPENAI_API_KEY", "test-key")
    assert _fresh_service().provider_name == "openai"


def test_provider_swap_is_env_only(monkeypatch):
    """Switching Gemini -> OpenAI requires only an environment change."""
    monkeypatch.setattr(config, "GEMINI_API_KEY", "g")
    monkeypatch.setattr(config, "OPENAI_API_KEY", "o")

    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    assert _fresh_service().provider_name == "gemini"

    monkeypatch.setattr(config, "LLM_PROVIDER", "openai")
    assert _fresh_service().provider_name == "openai"


def test_falls_back_to_mock_without_key(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(config, "GEMINI_API_KEY", "")
    svc = _fresh_service()
    assert svc.provider_name == "mock"
    assert svc.enabled() is False
    # Safe degradation: no key -> deterministic (None) result.
    assert svc.chat([{"role": "user", "content": "hi"}]) is None


def test_unknown_provider_falls_back_to_mock(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "does-not-exist")
    assert _fresh_service().provider_name == "mock"


def test_ai_enabled_reflects_provider_and_key(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "mock")
    assert config.ai_enabled() is False
    monkeypatch.setattr(config, "LLM_PROVIDER", "openai")
    monkeypatch.setattr(config, "OPENAI_API_KEY", "k")
    assert config.ai_enabled() is True
