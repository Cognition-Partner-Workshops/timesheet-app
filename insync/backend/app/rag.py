"""Retrieval layer for the TalentBridge chatbot.

Implements the pipeline tail:

    user question -> local embedding -> pgvector similarity search
                  -> top masked retrieval documents

The embeddings are produced by the same deterministic, local feature-hashing
embedder used by the ``insync/loader`` ingestion project, so no paid embedding
service or downloaded model is required. Vectors live in the ``retrieval_embeddings``
``vector(384)`` column (populated by ``loader/scripts/store_pgvector.py``) and the
masked text lives in ``rag_documents``.

If PostgreSQL/pgvector is unavailable the layer degrades gracefully: it returns
an empty result set so the chatbot can fall back to deterministic answers built
from the in-memory workbook. The app therefore always works, with or without a
database.
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import re
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from . import config

logger = logging.getLogger(__name__)

EMBED_DIM = 384
_TOKEN_RE = re.compile(r"[a-zA-Z0-9_+#./-]+")

# Persisted local vector store used as a fallback when pgvector is unavailable.
LOCAL_STORE_PATH = config.BACKEND_ROOT / "data" / "rag_vectors.json"


# --------------------------------------------------------------------------- #
# Local embedding (mirrors loader/src/rag/local_embeddings.py)                 #
# --------------------------------------------------------------------------- #
def tokenize(text: str) -> list[str]:
    return [m.group(0).lower() for m in _TOKEN_RE.finditer(text or "")]


def embed_text(text: str, dimensions: int = EMBED_DIM) -> list[float]:
    """Deterministic feature-hashing embedding, L2-normalised."""
    vector = [0.0] * dimensions
    counts = Counter(tokenize(text))
    for token, count in counts.items():
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        value = int.from_bytes(digest, byteorder="big", signed=False)
        index = value % dimensions
        sign = 1.0 if ((value >> 8) & 1) == 0 else -1.0
        vector[index] += sign * (1.0 + math.log(float(count)))
    norm = math.sqrt(sum(v * v for v in vector))
    if norm > 0:
        vector = [v / norm for v in vector]
    return vector


def _vector_literal(values: list[float]) -> str:
    return "[" + ",".join(f"{v:.6f}" for v in values) + "]"


@dataclass
class RetrievedDoc:
    document_key: str
    source_type: str
    source_id: Optional[str]
    content: str
    metadata: dict[str, Any]
    score: float


# --------------------------------------------------------------------------- #
# pgvector access                                                              #
# --------------------------------------------------------------------------- #
@lru_cache(maxsize=1)
def _pg_available() -> bool:
    """Probe the database once; cache the result for the process lifetime."""
    conn = _connect()
    if conn is None:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT to_regclass('public.retrieval_embeddings');")
            row = cur.fetchone()
            return bool(row and row[0])
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("pgvector probe failed: %s", exc)
        return False
    finally:
        conn.close()


def _connect():
    if not config.PG_ENABLED:
        return None
    try:
        import psycopg2
    except ImportError:  # pragma: no cover
        logger.warning("psycopg2 not installed; RAG runs in fallback mode")
        return None
    try:
        return psycopg2.connect(
            host=config.PG_HOST,
            port=config.PG_PORT,
            dbname=config.PG_DATABASE,
            user=config.PG_USER,
            password=config.PG_PASSWORD,
            connect_timeout=3,
        )
    except Exception as exc:
        logger.warning("Could not connect to PostgreSQL: %s", exc)
        return None


def retrieval_enabled() -> bool:
    """True when *any* retrieval backend (pgvector OR local vectors) is usable."""
    return _pg_available() or local_store_available()


def active_backend() -> str:
    """Name of the retrieval backend that would serve a query right now."""
    if _pg_available():
        return "pgvector"
    if local_store_available():
        return "local-vector"
    return "none"


def semantic_scores_for_tokens(
    query: str,
    employee_tokens: list[str],
    top_k: int = 50,
) -> dict[str, float]:
    """pgvector similarity restricted to a pre-filtered candidate pool.

    Per the hybrid retrieval architecture, semantic search must run **only**
    against the SQL-filtered candidate pool, never the whole workforce. We embed
    the role/skill/domain query once and rank the embedding documents whose
    ``employee_token`` is in ``employee_tokens``. Returns ``{token: best_score}``.
    Degrades to an empty dict when pgvector is unavailable.
    """
    tokens = [t for t in employee_tokens if t]
    if not tokens or not _pg_available():
        return {}
    conn = _connect()
    if conn is None:
        return {}
    try:
        qvec = _vector_literal(embed_text(query))
        sql = """
            SELECT d.metadata->>'employee_token' AS token,
                   MAX(1 - (e.embedding <=> %s::vector)) AS score
            FROM retrieval_embeddings e
            JOIN rag_documents d ON d.document_id = e.document_id
            WHERE d.metadata->>'employee_token' = ANY(%s)
            GROUP BY d.metadata->>'employee_token'
            ORDER BY score DESC
            LIMIT %s;
        """
        with conn.cursor() as cur:
            cur.execute(sql, [qvec, tokens, top_k])
            return {row[0]: float(row[1]) for row in cur.fetchall() if row[0]}
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("pgvector subset retrieval failed: %s", exc)
        return {}
    finally:
        conn.close()


def retrieve(
    query: str,
    top_k: int = 6,
    source_types: Optional[list[str]] = None,
) -> list[RetrievedDoc]:
    """Return the top-k closest masked documents for a query.

    Backend selection: pgvector first; if pgvector is unavailable, fall back to
    the local vector store. The backend that served the query is logged.
    """
    if not _pg_available():
        if local_store_available():
            docs = _local_store().search(query, top_k=top_k, source_types=source_types)
            logger.info("retrieval backend=local-vector results=%d", len(docs))
            return docs
        logger.info("retrieval backend=none (no pgvector, no local store)")
        return []
    conn = _connect()
    if conn is None:
        if local_store_available():
            return _local_store().search(query, top_k=top_k, source_types=source_types)
        return []
    logger.info("retrieval backend=pgvector")
    try:
        from psycopg2.extras import RealDictCursor

        qvec = _vector_literal(embed_text(query))
        where = ""
        params: list[Any] = [qvec]
        if source_types:
            where = "WHERE d.source_type = ANY(%s)"
            params.append(source_types)
        params.append(qvec)
        params.append(top_k)
        sql = f"""
            SELECT
                d.document_key,
                d.source_type,
                d.source_id,
                d.content_masked,
                d.metadata,
                1 - (e.embedding <=> %s::vector) AS score
            FROM retrieval_embeddings e
            JOIN rag_documents d ON d.document_id = e.document_id
            {where}
            ORDER BY e.embedding <=> %s::vector
            LIMIT %s;
        """
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
        return [
            RetrievedDoc(
                document_key=r["document_key"],
                source_type=r["source_type"],
                source_id=r["source_id"],
                content=r["content_masked"],
                metadata=r["metadata"] or {},
                score=float(r["score"]),
            )
            for r in rows
        ]
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("pgvector retrieval failed: %s", exc)
        return []
    finally:
        conn.close()


# --------------------------------------------------------------------------- #
# Local vector store (fallback when pgvector is unavailable)                    #
#                                                                               #
# Documents and their locally-computed embeddings are persisted to a JSON file. #
# Cosine similarity is computed in-process. The store is built from the plain   #
# ``rag_documents`` table (no pgvector extension required), so retrieval keeps  #
# working even when the vector extension / ``retrieval_embeddings`` table is    #
# missing — as long as the local store file exists.                             #
# --------------------------------------------------------------------------- #
class LocalVectorStore:
    """In-memory cosine-similarity search over locally-embedded documents."""

    def __init__(self, docs: list[dict]) -> None:
        self._docs = docs

    def __len__(self) -> int:
        return len(self._docs)

    def search(
        self,
        query: str,
        top_k: int = 6,
        source_types: Optional[list[str]] = None,
    ) -> list[RetrievedDoc]:
        if not self._docs:
            return []
        qvec = embed_text(query)
        allowed = set(source_types) if source_types else None
        scored: list[tuple[float, dict]] = []
        for doc in self._docs:
            if allowed and doc.get("source_type") not in allowed:
                continue
            vec = doc.get("vector") or []
            score = sum(a * b for a, b in zip(qvec, vec))  # both L2-normalised
            scored.append((score, doc))
        scored.sort(key=lambda pair: pair[0], reverse=True)
        out: list[RetrievedDoc] = []
        for score, doc in scored[:top_k]:
            out.append(
                RetrievedDoc(
                    document_key=doc.get("document_key", ""),
                    source_type=doc.get("source_type", ""),
                    source_id=doc.get("source_id"),
                    content=doc.get("content", ""),
                    metadata=doc.get("metadata") or {},
                    score=float(score),
                )
            )
        return out


@lru_cache(maxsize=1)
def _local_store() -> LocalVectorStore:
    """Load the persisted local vector store (empty when the file is absent)."""
    try:
        if LOCAL_STORE_PATH.exists():
            data = json.loads(LOCAL_STORE_PATH.read_text(encoding="utf-8"))
            docs = data.get("documents") or []
            logger.info("Loaded local vector store: %d documents", len(docs))
            return LocalVectorStore(docs)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Could not load local vector store: %s", exc)
    return LocalVectorStore([])


def local_store_available() -> bool:
    """True when a non-empty local vector store is loaded."""
    return len(_local_store()) > 0


def build_local_store(path: Optional[Path] = None) -> int:
    """Build/refresh the local vector store from the ``rag_documents`` table.

    Reads masked document text from PostgreSQL (no pgvector extension needed),
    embeds each document with the local feature-hashing embedder and writes the
    JSON store to disk. Returns the number of documents persisted. Safe to call
    at startup; a no-op (returns 0) when Postgres/``rag_documents`` is missing.
    """
    target = path or LOCAL_STORE_PATH
    conn = _connect()
    if conn is None:
        return 0
    try:
        from psycopg2.extras import RealDictCursor

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT to_regclass('public.rag_documents');")
            row = cur.fetchone()
            if not (row and row["to_regclass"]):
                return 0
            cur.execute(
                "SELECT document_key, source_type, source_id, content_masked, "
                "metadata FROM rag_documents;"
            )
            rows = cur.fetchall()
        documents = [
            {
                "document_key": r["document_key"],
                "source_type": r["source_type"],
                "source_id": r["source_id"],
                "content": r["content_masked"],
                "metadata": r["metadata"] or {},
                "vector": embed_text(r["content_masked"] or ""),
            }
            for r in rows
        ]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            json.dumps({"dimensions": EMBED_DIM, "documents": documents}),
            encoding="utf-8",
        )
        _local_store.cache_clear()
        logger.info("Built local vector store: %d documents -> %s", len(documents), target)
        return len(documents)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Could not build local vector store: %s", exc)
        return 0
    finally:
        conn.close()
