"""Store local embeddings into PostgreSQL using pgvector.

Reads every row from ``rag_documents``, embeds the masked content with the
same local feature-hashing embedder used by the offline vector store, and
upserts the vector into ``retrieval_embeddings`` (a ``vector(N)`` column).

This makes the literal pipeline step "Store embeddings using pgvector" real,
so the FastAPI backend can run similarity search directly in the database:

    SELECT ... FROM retrieval_embeddings e
    JOIN rag_documents d ON d.document_id = e.document_id
    ORDER BY e.embedding <=> :query_vector
    LIMIT :k;
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from psycopg2.extras import RealDictCursor, execute_values

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import get_config
from src.db import connect_db
from src.rag.local_embeddings import embed_text

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

DIMENSIONS = 384


def vector_literal(values) -> str:
    """Render a numpy/array vector as the pgvector text format '[a,b,c]'."""
    return "[" + ",".join(f"{float(v):.6f}" for v in values) + "]"


def main() -> None:
    config = get_config()
    with connect_db(config) as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS retrieval_embeddings (
                    document_id UUID PRIMARY KEY
                        REFERENCES rag_documents(document_id) ON DELETE CASCADE,
                    embedding vector({DIMENSIONS}) NOT NULL,
                    model TEXT NOT NULL DEFAULT 'local-feature-hash-384',
                    updated_at TIMESTAMP DEFAULT now()
                );
                """
            )

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT document_id, content_masked FROM rag_documents;")
            rows = cur.fetchall()

        logger.info("Embedding %d documents into pgvector", len(rows))
        payload = [
            (str(row["document_id"]), vector_literal(embed_text(row["content_masked"], DIMENSIONS)))
            for row in rows
        ]

        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO retrieval_embeddings (document_id, embedding)
                VALUES %s
                ON CONFLICT (document_id)
                DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = now();
                """,
                payload,
                template="(%s, %s::vector)",
                page_size=500,
            )
            # Cosine-distance ANN index for fast similarity search.
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_retrieval_embeddings_cosine "
                "ON retrieval_embeddings USING hnsw (embedding vector_cosine_ops);"
            )
        conn.commit()
    logger.info("Stored %d embeddings in retrieval_embeddings", len(payload))


if __name__ == "__main__":
    main()
