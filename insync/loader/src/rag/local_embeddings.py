"""Small local embedding utility.

This uses deterministic feature hashing so the project can run without a paid
embedding service or a downloaded model. It is lexical rather than deep
semantic, but it gives a complete local RAG flow for the hackathon.
"""

from __future__ import annotations

import hashlib
import math
import re
from collections import Counter
from typing import Iterable, List

import numpy as np

TOKEN_RE = re.compile(r"[a-zA-Z0-9_+#./-]+")


def tokenize(text: str) -> List[str]:
    return [match.group(0).lower() for match in TOKEN_RE.finditer(text or "")]


def embed_text(text: str, dimensions: int = 384) -> np.ndarray:
    vector = np.zeros(dimensions, dtype=np.float32)
    counts = Counter(tokenize(text))

    for token, count in counts.items():
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        value = int.from_bytes(digest, byteorder="big", signed=False)
        index = value % dimensions
        sign = 1.0 if ((value >> 8) & 1) == 0 else -1.0
        weight = 1.0 + math.log(float(count))
        vector[index] += sign * weight

    norm = float(np.linalg.norm(vector))
    if norm > 0:
        vector /= norm
    return vector


def embed_texts(texts: Iterable[str], dimensions: int = 384) -> np.ndarray:
    vectors = [embed_text(text, dimensions) for text in texts]
    if not vectors:
        return np.empty((0, dimensions), dtype=np.float32)
    return np.vstack(vectors).astype(np.float32)
