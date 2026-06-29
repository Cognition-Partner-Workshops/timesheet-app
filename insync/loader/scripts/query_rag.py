"""Search local RAG embeddings and print OpenAI-ready context."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import List, Set

import numpy as np
from psycopg2.extras import RealDictCursor

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import get_config
from src.db import connect_db
from src.rag.local_embeddings import embed_text, tokenize

VECTOR_STORE_DIR = PROJECT_ROOT / "vector_store"
EMBEDDINGS_FILE = VECTOR_STORE_DIR / "embeddings.npz"
ID_MAP_FILE = VECTOR_STORE_DIR / "id_map.json"


def load_vector_store():
    if not EMBEDDINGS_FILE.exists() or not ID_MAP_FILE.exists():
        raise SystemExit(
            "Vector store not found. Run: python scripts/create_rag_documents.py "
            "then python scripts/generate_embeddings.py"
        )

    embeddings = np.load(EMBEDDINGS_FILE)["embeddings"]
    id_map = json.loads(ID_MAP_FILE.read_text(encoding="utf-8"))
    return embeddings, id_map


AVAILABILITY_TERMS = {"available", "availability", "bench", "capacity", "fte", "free", "release"}
DEMAND_TERMS = {"role", "project", "opportunity", "required", "skills", "need", "needs"}
EVIDENCE_TERMS = {"why", "evidence", "history", "experience", "worked", "rationale"}
PROPOSAL_TERMS = {"proposal", "ewa", "approval", "booked", "pending", "match", "candidate"}
CODE_RE = re.compile(r"\b(?:OPP|OPR|EMP)-?\d{1,5}\b|\bC\d{4,5}\b", re.IGNORECASE)
STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "for",
    "in",
    "is",
    "me",
    "of",
    "show",
    "the",
    "to",
    "what",
    "which",
    "who",
}


def lexical_score(query_tokens: Set[str], content: str) -> float:
    content_tokens = set(tokenize(content))
    if not query_tokens or not content_tokens:
        return 0.0
    return len(query_tokens & content_tokens) / len(query_tokens)


def intent_boost(query_tokens: Set[str], source_type: str) -> float:
    boost = 0.0
    if query_tokens & AVAILABILITY_TERMS and source_type == "candidate_summary":
        boost += 0.08
    if query_tokens & DEMAND_TERMS and source_type == "project_role_summary":
        boost += 0.05
    if query_tokens & EVIDENCE_TERMS and source_type == "employee_evidence":
        boost += 0.04
    if query_tokens & PROPOSAL_TERMS and source_type == "proposal_candidate":
        boost += 0.05
    return boost


def normalize_code(value: str) -> str:
    return value.upper().replace("-", "")


def extract_codes(question: str) -> Set[str]:
    return {normalize_code(match.group(0)) for match in CODE_RE.finditer(question)}


def exact_code_boost(query_codes: Set[str], document: dict) -> float:
    if not query_codes:
        return 0.0

    haystack = " ".join(
        [
            document.get("content_masked") or "",
            document.get("document_key") or "",
            json.dumps(document.get("metadata") or {}, default=str),
        ]
    )
    normalized_haystack = normalize_code(haystack)
    matches = sum(1 for code in query_codes if code in normalized_haystack)
    return min(matches * 0.55, 1.1)


def phrase_boost(question: str, content: str) -> float:
    question_tokens = [token for token in tokenize(question) if token not in STOPWORDS]
    content_lower = (content or "").lower()
    boost = 0.0

    for size in (3, 2):
        for index in range(0, max(len(question_tokens) - size + 1, 0)):
            phrase = " ".join(question_tokens[index : index + size])
            if phrase and phrase in content_lower:
                boost += 0.04 if size == 2 else 0.06

    return min(boost, 0.18)


def vector_candidates(question: str, candidate_count: int):
    embeddings, id_map = load_vector_store()
    query_vector = embed_text(question, dimensions=embeddings.shape[1])
    scores = embeddings @ query_vector
    best_indexes = np.argsort(scores)[::-1][:candidate_count]

    matches = []
    for index in best_indexes:
        entry = id_map[int(index)]
        matches.append(
            {
                "score": float(scores[int(index)]),
                "document_id": entry["document_id"],
                "document_key": entry["document_key"],
                "source_type": entry["source_type"],
                "source_id": entry["source_id"],
                "metadata": entry.get("metadata") or {},
            }
        )
    return matches


def fetch_documents(document_ids: List[str]):
    if not document_ids:
        return []

    config = get_config()
    with connect_db(config) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    document_id::text AS document_id,
                    document_key,
                    source_type,
                    source_id,
                    content_masked,
                    metadata
                FROM rag_documents
                WHERE document_id = ANY(%s::uuid[])
                """,
                (document_ids,),
            )
            rows = list(cur.fetchall())

    by_id = {row["document_id"]: row for row in rows}
    return [by_id[document_id] for document_id in document_ids if document_id in by_id]


def build_prompt(question: str, results: List[dict]) -> str:
    facts = []
    for index, result in enumerate(results, start=1):
        document = result["document"]
        facts.append(
            f"[{index}] source_type={document['source_type']} "
            f"score={result['score']:.4f}\n{document['content_masked']}"
        )

    return (
        "You are an AI assistant for workforce planning. Answer using only the facts below. "
        "If the facts are insufficient, say what is missing.\n\n"
        f"User question:\n{question}\n\n"
        "Retrieved facts:\n"
        + "\n\n".join(facts)
        + "\n\nAnswer with a concise explanation, risks, and recommended next action."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Query the local RAG vector store.")
    parser.add_argument("question", help="User question to search for")
    parser.add_argument("--top-k", type=int, default=6, help="Number of documents to retrieve")
    parser.add_argument("--candidate-pool", type=int, default=5000, help="Vector candidates to rerank")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of readable prompt")
    args = parser.parse_args()

    matches = vector_candidates(args.question, max(args.candidate_pool, args.top_k))
    documents = fetch_documents([match["document_id"] for match in matches])
    documents_by_id = {document["document_id"]: document for document in documents}
    query_tokens = set(tokenize(args.question))
    query_codes = extract_codes(args.question)

    results = []
    for match in matches:
        document = documents_by_id.get(match["document_id"])
        if not document:
            continue
        combined_score = (
            match["score"]
            + 0.08 * lexical_score(query_tokens, document["content_masked"])
            + intent_boost(query_tokens, document["source_type"])
            + exact_code_boost(query_codes, document)
            + phrase_boost(args.question, document["content_masked"])
        )
        results.append(
            {
                "score": match["score"],
                "combined_score": combined_score,
                "document": dict(document),
            }
        )
    results = sorted(results, key=lambda item: item["combined_score"], reverse=True)[: args.top_k]

    if args.json:
        print(json.dumps({"question": args.question, "results": results}, indent=2, default=str))
        return

    print("\nTop retrieved documents\n")
    for index, result in enumerate(results, start=1):
        document = result["document"]
        print(f"{index}. {document['source_type']} | score={result['score']:.4f} | combined={result['combined_score']:.4f}")
        print(f"   key: {document['document_key']}")
        print(f"   metadata: {json.dumps(document['metadata'], default=str)}")
        print()

    print("OpenAI-ready prompt\n")
    print(build_prompt(args.question, results))


if __name__ == "__main__":
    main()
