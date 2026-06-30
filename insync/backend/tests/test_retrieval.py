"""Unit tests: retrieval backend selection + local vector fallback."""
from __future__ import annotations

from app import rag


def test_active_backend_prefers_pgvector(monkeypatch):
    monkeypatch.setattr(rag, "_pg_available", lambda: True)
    monkeypatch.setattr(rag, "local_store_available", lambda: True)
    assert rag.active_backend() == "pgvector"


def test_active_backend_falls_back_to_local(monkeypatch):
    monkeypatch.setattr(rag, "_pg_available", lambda: False)
    monkeypatch.setattr(rag, "local_store_available", lambda: True)
    assert rag.active_backend() == "local-vector"


def test_active_backend_none_when_nothing_available(monkeypatch):
    monkeypatch.setattr(rag, "_pg_available", lambda: False)
    monkeypatch.setattr(rag, "local_store_available", lambda: False)
    assert rag.active_backend() == "none"


def test_retrieval_enabled_true_when_only_local(monkeypatch):
    monkeypatch.setattr(rag, "_pg_available", lambda: False)
    monkeypatch.setattr(rag, "local_store_available", lambda: True)
    assert rag.retrieval_enabled() is True


def _doc(key: str, content: str) -> dict:
    return {
        "document_key": key,
        "source_type": "candidate_summary",
        "source_id": key,
        "content": content,
        "metadata": {},
        "vector": rag.embed_text(content),
    }


def test_local_vector_store_ranks_by_similarity():
    store = rag.LocalVectorStore(
        [
            _doc("d1", "Java Spring Boot backend engineer in Pune banking"),
            _doc("d2", "React frontend designer in Melbourne retail"),
        ]
    )
    results = store.search("java spring boot backend banking", top_k=2)
    assert results
    assert results[0].document_key == "d1"
    assert results[0].score >= results[-1].score


def test_local_vector_store_source_type_filter():
    store = rag.LocalVectorStore([_doc("d1", "Java engineer")])
    assert store.search("java", source_types=["project_summary"]) == []


def test_retrieve_uses_local_when_pgvector_down(monkeypatch):
    store = rag.LocalVectorStore([_doc("d1", "Kubernetes devops engineer")])
    monkeypatch.setattr(rag, "_pg_available", lambda: False)
    monkeypatch.setattr(rag, "local_store_available", lambda: True)
    monkeypatch.setattr(rag, "_local_store", lambda: store)
    docs = rag.retrieve("kubernetes devops", top_k=3)
    assert docs and docs[0].document_key == "d1"


def test_retrieve_empty_when_no_backend(monkeypatch):
    monkeypatch.setattr(rag, "_pg_available", lambda: False)
    monkeypatch.setattr(rag, "local_store_available", lambda: False)
    assert rag.retrieve("anything") == []
