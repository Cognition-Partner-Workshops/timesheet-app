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
import logging
import math
import re
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Optional

from . import config

logger = logging.getLogger(__name__)

EMBED_DIM = 384
_TOKEN_RE = re.compile(r"[a-zA-Z0-9_+#./-]+")


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
    """True when pgvector retrieval is wired up and usable."""
    return _pg_available()


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
    """Embed the query and return the top-k closest masked documents from pgvector."""
    if not _pg_available():
        return []
    conn = _connect()
    if conn is None:
        return []
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
