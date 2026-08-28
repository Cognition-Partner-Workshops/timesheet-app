"""Provider-independent LLM abstraction for the TalentBridge assistant.

Architecture (provider-independent by design):

    AIProvider   - the interface every provider implements: ``chat(messages,
                   temperature) -> str | None``.
    *Provider    - concrete adapters: GeminiProvider, OpenAIProvider,
                   AzureOpenAIProvider, MockProvider.
    LLMService   - orchestrator that resolves the active provider purely from
                   ``config.LLM_PROVIDER`` and delegates calls, failing safely
                   to deterministic (mock) mode on any provider error.

Switching providers is an environment change only (``LLM_PROVIDER=...``): no
business logic, prompt logic, retrieval logic or RBAC code changes. API keys
are read exclusively from environment variables (via ``config``); nothing is
hardcoded, and secrets are never logged.
"""
from __future__ import annotations

import logging
from typing import Optional, Protocol

import httpx

from . import config

logger = logging.getLogger(__name__)

# Message = {"role": "system"|"user"|"assistant", "content": str}
Message = dict


class AIProvider(Protocol):
    """Provider interface: turn a chat transcript into an assistant reply."""

    name: str

    def available(self) -> bool:
        """True when this provider has usable credentials configured."""
        ...

    def chat(self, messages: list[Message], temperature: float = 0.2) -> Optional[str]:
        """Return the assistant reply text, or None on any failure."""
        ...


class MockProvider:
    """Deterministic no-LLM provider.

    Returns ``None`` so callers transparently fall back to their own
    deterministic, evidence-grounded templates. This keeps the whole app
    functional with zero external dependencies or API keys.
    """

    name = "mock"

    def available(self) -> bool:
        return True

    def chat(self, messages: list[Message], temperature: float = 0.2) -> Optional[str]:
        return None


class OpenAIProvider:
    """OpenAI Chat Completions adapter."""

    name = "openai"

    def available(self) -> bool:
        return bool(config.OPENAI_API_KEY)

    def chat(self, messages: list[Message], temperature: float = 0.2) -> Optional[str]:
        if not self.available():
            return None
        try:
            resp = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {config.OPENAI_API_KEY}"},
                json={
                    "model": config.OPENAI_MODEL,
                    "messages": messages,
                    "temperature": temperature,
                },
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:  # noqa: BLE001 - any failure -> safe fallback
            logger.warning("OpenAI provider call failed: %s", exc)
            return None


class AzureOpenAIProvider:
    """Azure OpenAI Chat Completions adapter."""

    name = "azure"

    def available(self) -> bool:
        return bool(
            config.AZURE_OPENAI_API_KEY
            and config.AZURE_OPENAI_ENDPOINT
            and config.AZURE_OPENAI_DEPLOYMENT
        )

    def chat(self, messages: list[Message], temperature: float = 0.2) -> Optional[str]:
        if not self.available():
            return None
        try:
            url = (
                f"{config.AZURE_OPENAI_ENDPOINT}/openai/deployments/"
                f"{config.AZURE_OPENAI_DEPLOYMENT}/chat/completions"
                f"?api-version={config.AZURE_OPENAI_API_VERSION}"
            )
            resp = httpx.post(
                url,
                headers={"api-key": config.AZURE_OPENAI_API_KEY},
                json={"messages": messages, "temperature": temperature},
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:  # noqa: BLE001 - any failure -> safe fallback
            logger.warning("Azure OpenAI provider call failed: %s", exc)
            return None


class GeminiProvider:
    """Google Gemini (Generative Language API) adapter.

    Translates the OpenAI-style ``messages`` list into Gemini's ``contents``
    format so the rest of the app stays provider-independent.
    """

    name = "gemini"

    def available(self) -> bool:
        return bool(config.GEMINI_API_KEY)

    def chat(self, messages: list[Message], temperature: float = 0.2) -> Optional[str]:
        if not self.available():
            return None
        system_parts = [m["content"] for m in messages if m.get("role") == "system"]
        contents = [
            {
                "role": "model" if m.get("role") == "assistant" else "user",
                "parts": [{"text": m.get("content", "")}],
            }
            for m in messages
            if m.get("role") in ("user", "assistant")
        ]
        body: dict = {
            "contents": contents,
            "generationConfig": {"temperature": temperature},
        }
        if system_parts:
            body["systemInstruction"] = {"parts": [{"text": "\n".join(system_parts)}]}
        try:
            url = (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{config.GEMINI_MODEL}:generateContent"
            )
            resp = httpx.post(
                url,
                headers={"x-goog-api-key": config.GEMINI_API_KEY},
                json=body,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            candidates = data.get("candidates") or []
            if not candidates:
                return None
            parts = candidates[0].get("content", {}).get("parts") or []
            text = "".join(p.get("text", "") for p in parts).strip()
            return text or None
        except Exception as exc:  # noqa: BLE001 - any failure -> safe fallback
            logger.warning("Gemini provider call failed: %s", exc)
            return None


_PROVIDERS: dict[str, AIProvider] = {
    "gemini": GeminiProvider(),
    "openai": OpenAIProvider(),
    "azure": AzureOpenAIProvider(),
    "mock": MockProvider(),
}


class LLMService:
    """Resolve the active provider from ``config.LLM_PROVIDER`` and delegate."""

    def __init__(self) -> None:
        self._mock = _PROVIDERS["mock"]

    def resolve_provider(self) -> AIProvider:
        """Return the configured provider, or mock if it is unusable."""
        provider = _PROVIDERS.get(config.LLM_PROVIDER, self._mock)
        if provider.name != "mock" and not provider.available():
            return self._mock
        return provider

    @property
    def provider_name(self) -> str:
        return self.resolve_provider().name

    def enabled(self) -> bool:
        """True when a real (non-mock) provider is active and usable."""
        return self.resolve_provider().name != "mock"

    def chat(self, messages: list[Message], temperature: float = 0.2) -> Optional[str]:
        provider = self.resolve_provider()
        result = provider.chat(messages, temperature)
        if result is None and provider.name != "mock":
            # Safe degradation: a configured provider failed at call time.
            logger.info("Provider '%s' returned no result; using deterministic mode.",
                        provider.name)
        return result


_service: Optional[LLMService] = None


def get_service() -> LLMService:
    global _service
    if _service is None:
        _service = LLMService()
    return _service


def log_provider_selection() -> None:
    """Log the resolved provider at startup (never logs secrets)."""
    svc = get_service()
    configured = config.LLM_PROVIDER
    active = svc.provider_name
    if configured != active:
        logger.info(
            "LLM provider: configured=%s but no usable key -> active=%s (deterministic)",
            configured, active,
        )
    else:
        logger.info("LLM provider: %s (ai_enabled=%s)", active, svc.enabled())
