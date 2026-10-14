"""Generate local embeddings for rag_documents into vector_store files."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from psycopg2.extras import RealDictCursor

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import get_config
from src.db import connect_db
from src.rag.local_embeddings import embed_texts

VECTOR_STORE_DIR = PROJECT_ROOT / "vector_store"
EMBEDDINGS_FILE = VECTOR_STORE_DIR / "embeddings.npz"
ID_MAP_FILE = VECTOR_STORE_DIR / "id_map.json"
MANIFEST_FILE = VECTOR_STORE_DIR / "manifest.json"
DEFAULT_DIMENSIONS = 384


def fetch_documents(conn):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT
                document_id::text AS document_id,
                document_key,
                source_type,
                source_id,
                content_masked,
                metadata,
                content_hash
            FROM rag_documents
            ORDER BY source_type, document_key
            """
        )
        return list(cur.fetchall())


def main() -> None:
    config = get_config()
    with connect_db(config) as conn:
        documents = fetch_documents(conn)

    if not documents:
        raise SystemExit("No rag_documents found. Run: python scripts/create_rag_documents.py")

    texts = [doc["content_masked"] for doc in documents]
    embeddings = embed_texts(texts, dimensions=DEFAULT_DIMENSIONS)

    VECTOR_STORE_DIR.mkdir(exist_ok=True)
    np.savez_compressed(EMBEDDINGS_FILE, embeddings=embeddings)

    id_map = [
        {
            "index": index,
            "document_id": doc["document_id"],
            "document_key": doc["document_key"],
            "source_type": doc["source_type"],
            "source_id": doc["source_id"],
            "metadata": doc["metadata"],
            "content_hash": doc["content_hash"],
        }
        for index, doc in enumerate(documents)
    ]
    ID_MAP_FILE.write_text(json.dumps(id_map, indent=2, default=str), encoding="utf-8")

    manifest = {
        "embedding_method": "local_feature_hashing",
        "dimensions": DEFAULT_DIMENSIONS,
        "document_count": len(documents),
        "embeddings_file": str(EMBEDDINGS_FILE.relative_to(PROJECT_ROOT)),
        "id_map_file": str(ID_MAP_FILE.relative_to(PROJECT_ROOT)),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
