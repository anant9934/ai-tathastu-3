"""Independent Collaboration Matcher & Profile Vector Embedding Engine.

Generates 768-dimensional dense vector representations of user profiles (skills, projects, career goals)
using Gemini text-embedding-004 / OpenRouter embeddings, with pgvector support on Neon PostgreSQL.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

log = logging.getLogger("worker.collaboration")

EMBEDDING_DIM = 768


def _normalize_vector(vec: List[float]) -> List[float]:
    norm = math.sqrt(sum(x * x for x in vec))
    if norm < 1e-9:
        return [0.0] * len(vec)
    return [round(x / norm, 6) for x in vec]


def fetch_dense_api_embedding(text: str, target_dim: int = EMBEDDING_DIM) -> Optional[List[float]]:
    """Calls Gemini text-embedding-004 or OpenRouter embedding API."""
    gemini_keys = [k.strip() for k in os.environ.get("GEMINI_KEYS", "").split(",") if k.strip()]
    openrouter_keys = [k.strip() for k in os.environ.get("OPENROUTER_KEYS", "").split(",") if k.strip()]

    # 1. Try Gemini text-embedding-004
    for key in gemini_keys:
        url = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"
        req = urllib.request.Request(
            url,
            data=json.dumps({"content": {"parts": [{"text": text[:2000]}]}}).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-goog-api-key": key},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=8.0) as res:
                data = json.loads(res.read().decode("utf-8"))
                vals = (data.get("embedding") or {}).get("values")
                if vals and isinstance(vals, list) and len(vals) == target_dim:
                    return _normalize_vector(vals)
        except Exception as exc:
            log.debug("Gemini embedding call failed on key (%s)", exc)

    # 2. Try OpenRouter Embeddings
    for key in openrouter_keys:
        url = "https://openrouter.ai/api/v1/embeddings"
        req = urllib.request.Request(
            url,
            data=json.dumps({"model": "text-embedding-3-small", "dimensions": target_dim, "input": text[:2000]}).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
                "HTTP-Referer": "https://aitathastu.com",
                "X-Title": "AI Tathastu",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=8.0) as res:
                data = json.loads(res.read().decode("utf-8"))
                records = data.get("data") or []
                if records and isinstance(records[0], dict) and "embedding" in records[0]:
                    vals = records[0]["embedding"]
                    if len(vals) == target_dim:
                        return _normalize_vector(vals)
        except Exception as exc:
            log.debug("OpenRouter embedding call failed (%s)", exc)

    return None


def compute_profile_vector(
    role: str,
    skills: List[str],
    projects: List[str],
    goals: List[str],
    dim: int = EMBEDDING_DIM,
) -> List[float]:
    """Generates a dense normalized 768-dim feature vector from profile signals."""
    profile_text = (
        f"Role: {role}. "
        f"Skills: {', '.join(skills[:25])}. "
        f"Projects: {', '.join(projects[:10])}. "
        f"Goals: {', '.join(goals[:10])}."
    )

    api_vec = fetch_dense_api_embedding(profile_text, target_dim=dim)
    if api_vec and len(api_vec) == dim:
        return api_vec

    # High-precision deterministic fallback vector (768 dimensions)
    vec = [0.0] * dim
    domain_weights = {
        "ml": ["python", "pytorch", "tensorflow", "deep learning", "machine learning", "nlp", "llm", "cv", "transformers"],
        "systems": ["c++", "rust", "cuda", "linux", "distributed systems", "concurrency", "operating systems"],
        "data": ["sql", "pandas", "spark", "kafka", "analytics", "data science", "statistics"],
        "cloud": ["docker", "kubernetes", "aws", "gcp", "devops", "ci/cd", "infrastructure"],
        "web": ["react", "typescript", "javascript", "node", "next.js", "frontend", "full stack"],
        "research": ["scopus", "ieee", "arxiv", "paper", "grant", "evaluation", "benchmark"],
    }

    all_tokens = [role.lower()] + [s.lower() for s in skills] + [p.lower() for p in projects] + [g.lower() for g in goals]
    for token in all_tokens:
        h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        sign = 1.0 if (h // dim) % 2 == 0 else -1.0
        vec[idx] += sign * 1.0

        for d_idx, (domain, keywords) in enumerate(domain_weights.items()):
            if any(k in token for k in keywords):
                target_slot = (d_idx * 127 + (h % 31)) % dim
                vec[target_slot] += 1.5

    return _normalize_vector(vec)


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Calculates cosine similarity between two float vectors."""
    if len(v1) != len(v2) or not v1:
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 < 1e-9 or norm2 < 1e-9:
        return 0.0
    return max(0.0, min(1.0, dot / (norm1 * norm2)))


def process_collaboration_embedding(cur: Any, user_id: str) -> List[float]:
    """Computes and stores the collaboration embedding vector in NeonDB."""
    from db import fetch_all, fetch_one

    user = fetch_one(cur, "SELECT role, degree, university, department FROM users WHERE id = %s", (user_id,))
    if not user:
        return [0.0] * EMBEDDING_DIM

    # Collect skills
    skills_rows = fetch_all(
        cur,
        """SELECT s.canonical_name FROM skill_evidence e
           JOIN skills s ON s.id = e.skill_id WHERE e.user_id = %s""",
        (user_id,),
    )
    skills = [r["canonical_name"] for r in skills_rows]

    # Collect projects
    project_rows = fetch_all(
        cur,
        "SELECT canonical_title, technologies FROM unified_projects WHERE user_id = %s",
        (user_id,),
    )
    projects = [r["canonical_title"] for r in project_rows]

    # Collect goals
    state = fetch_one(cur, "SELECT career_roles, priorities FROM onboarding_state WHERE user_id = %s", (user_id,))
    goals = (state.get("career_roles") or []) + (state.get("priorities") or []) if state else []

    vec = compute_profile_vector(
        role=user.get("role") or "student",
        skills=skills,
        projects=projects,
        goals=goals,
        dim=EMBEDDING_DIM,
    )

    summary = (
        f"{user.get('role')} at {user.get('university')}. "
        f"Skills: {', '.join(skills[:10])}. Projects: {', '.join(projects[:5])}."
    )

    now = datetime.now(timezone.utc)
    vector_str = f"[{','.join(f'{x:.6f}' for x in vec)}]"

    cur.execute(
        """INSERT INTO collaboration_embeddings (user_id, embedding, profile_summary, updated_at)
           VALUES (%s, %s::vector, %s, %s)
           ON CONFLICT (user_id) DO UPDATE SET
             embedding = EXCLUDED.embedding,
             profile_summary = EXCLUDED.profile_summary,
             updated_at = EXCLUDED.updated_at""",
        (user_id, vector_str, summary, now),
    )
    return vec
