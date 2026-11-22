#!/usr/bin/env python3
"""
C1 RAG chat — retrieve via match_document_chunks + answer with Gemini flash
===========================================================================

Beginner flow:
  1. Embed the user question at 768 dims (task = RETRIEVAL_QUERY).
  2. Call Supabase RPC match_document_chunks with the **logged-in user** client
     (SUPABASE_ANON_KEY + user JWT). Do NOT use the service role here — RLS
     must filter unauthorized departments.
  3. Pass returned chunks to gemini-3.5-flash-lite (with flash fallbacks) and cite.

Usage (CLI):
  export GEMINI_API_KEY=...
  export SUPABASE_URL=...
  export SUPABASE_ANON_KEY=...
  export SUPABASE_USER_JWT=...   # access token from a signed-in user session
  python3 rag_chat.py "Who approves purchases over $250?"

Usage (API):
  uvicorn rag_chat:app --reload --app-dir .
  # POST /chat  Authorization: Bearer <user JWT>
  # body: {"question": "...", "match_count": 6, "match_threshold": 0.2}

Does NOT change RLS. Does NOT use SERVICE_ROLE for retrieval.
"""

from __future__ import annotations

import argparse
import math
import os
import sys
from typing import Any, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

EMBED_DIMS = 768
DEFAULT_EMBED_MODEL = "gemini-embedding-001"
# gemini-2.5-flash 404 for new keys; heavier flash models often 503 under load.
ANSWER_MODEL = "gemini-3.5-flash-lite"
ANSWER_MODEL_FALLBACKS = (
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def l2_normalize(vec: list[float]) -> list[float]:
    s = math.sqrt(sum(x * x for x in vec))
    if s == 0:
        return vec
    return [x / s for x in vec]


def require_env(*names: str) -> dict[str, str]:
    out: dict[str, str] = {}
    missing = []
    for n in names:
        v = os.environ.get(n, "").strip()
        if not v:
            missing.append(n)
        else:
            out[n] = v
    if missing:
        raise RuntimeError("Missing env: " + ", ".join(missing))
    return out


def embed_query(text: str, *, api_key: str, model: str = DEFAULT_EMBED_MODEL) -> list[float]:
    """Embed a user question (RETRIEVAL_QUERY) at 768 dims + L2 normalize."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    resp = client.models.embed_content(
        model=model,
        contents=text,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=EMBED_DIMS,
        ),
    )
    # SDK may expose .embeddings[0] or .embedding
    values: list[float]
    embeddings = getattr(resp, "embeddings", None)
    if embeddings:
        values = list(embeddings[0].values)
    else:
        values = list(resp.embedding.values)
    if len(values) != EMBED_DIMS:
        raise RuntimeError(f"expected {EMBED_DIMS} dims, got {len(values)}")
    return l2_normalize(values)


def user_supabase_client(url: str, anon_key: str, user_jwt: str):
    """Anon key + user access token — RLS applies. Never pass service role here."""
    from supabase import create_client

    client = create_client(url, anon_key)
    # Attach the signed-in user's JWT so PostgREST/RLS sees auth.uid()
    client.postgrest.auth(user_jwt)
    return client


def match_chunks(
    sb: Any,
    query_embedding: list[float],
    *,
    match_threshold: float = 0.2,
    match_count: int = 6,
    filter_subcategory: Optional[str] = None,
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {
        "query_embedding": query_embedding,
        "match_threshold": match_threshold,
        "match_count": match_count,
        "filter_subcategory": filter_subcategory,
    }
    res = sb.rpc("match_document_chunks", params).execute()
    data = getattr(res, "data", None) or []
    return list(data)


def answer_with_gemini(
    question: str,
    chunks: list[dict[str, Any]],
    *,
    api_key: str,
    model: str = ANSWER_MODEL,
) -> str:
    import time

    from google import genai
    from google.genai import errors as genai_errors

    if not chunks:
        return (
            "I could not find any authorized chunks for that question "
            "(empty retrieval — check login, RLS, or ingest)."
        )

    # Build a simple numbered evidence block for the model to cite
    lines = []
    for i, ch in enumerate(chunks, start=1):
        content = ch.get("content") or ch.get("chunk_content") or ""
        meta = []
        for k in ("document_id", "department", "access_level", "subcategory", "chunk_index"):
            if ch.get(k) is not None:
                meta.append(f"{k}={ch.get(k)}")
        # Prefer source ids returned by match_document_chunks
        for k in ("source_doc_id", "chunk_id"):
            if ch.get(k) is not None and f"{k}=" not in ",".join(meta):
                meta.append(f"{k}={ch.get(k)}")
        header = ", ".join(meta) if meta else f"chunk {i}"
        lines.append(f"[{i}] ({header})\n{content}\n")

    evidence = "\n".join(lines)
    prompt = (
        "You are answering questions about the WHACK theater organizational archive.\n"
        "Use ONLY the evidence chunks below. If the evidence is insufficient, say so.\n"
        "Cite chunk numbers like [1], [2] next to claims.\n\n"
        f"Question: {question}\n\n"
        f"Evidence chunks:\n{evidence}\n\n"
        "Answer:"
    )
    client = genai.Client(api_key=api_key)
    models: list[str] = []
    for m in (model, *ANSWER_MODEL_FALLBACKS):
        if m and m not in models:
            models.append(m)
    last_err: Exception | None = None
    for m in models:
        for attempt in range(3):
            try:
                resp = client.models.generate_content(model=m, contents=prompt)
                text = getattr(resp, "text", None)
                if text:
                    return text.strip()
                return str(resp)
            except (genai_errors.ClientError, genai_errors.ServerError) as e:
                last_err = e
                msg = str(e)
                # Retry transient overload; skip missing models quickly
                if "UNAVAILABLE" in msg or "high demand" in msg or "503" in msg:
                    time.sleep(1.5 * (attempt + 1))
                    continue
                break
    if last_err:
        raise last_err
    raise RuntimeError("Gemini answer generation failed with no response")


def run_rag(
    question: str,
    *,
    user_jwt: str,
    match_threshold: float = 0.2,
    match_count: int = 6,
    filter_subcategory: Optional[str] = None,
) -> dict[str, Any]:
    env = require_env("GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY")
    embedding = embed_query(question, api_key=env["GEMINI_API_KEY"])
    sb = user_supabase_client(env["SUPABASE_URL"], env["SUPABASE_ANON_KEY"], user_jwt)
    chunks = match_chunks(
        sb,
        embedding,
        match_threshold=match_threshold,
        match_count=match_count,
        filter_subcategory=filter_subcategory,
    )
    answer = answer_with_gemini(question, chunks, api_key=env["GEMINI_API_KEY"])
    return {"question": question, "answer": answer, "chunks": chunks}


# ---------------------------------------------------------------------------
# FastAPI
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    match_count: int = Field(6, ge=1, le=20)
    match_threshold: float = Field(0.2, ge=0.0, le=1.0)
    filter_subcategory: Optional[str] = None


class ChatResponse(BaseModel):
    question: str
    answer: str
    chunks: list[dict[str, Any]]


app = FastAPI(
    title="WHACK C1 RAG",
    description="Retrieve document_chunks via user JWT (RLS) and answer with Gemini flash.",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "embed_dims": str(EMBED_DIMS), "answer_model": ANSWER_MODEL}


@app.post("/chat", response_model=ChatResponse)
def chat(
    body: ChatRequest,
    authorization: Optional[str] = Header(default=None),
) -> ChatResponse:
    """Requires Authorization: Bearer <Supabase user access token>."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Send Authorization: Bearer <user JWT>. Do not use the service role key.",
        )
    user_jwt = authorization.split(" ", 1)[1].strip()
    if not user_jwt:
        raise HTTPException(status_code=401, detail="Empty bearer token")
    try:
        result = run_rag(
            body.question,
            user_jwt=user_jwt,
            match_threshold=body.match_threshold,
            match_count=body.match_count,
            filter_subcategory=body.filter_subcategory,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001 — surface RPC/auth errors cleanly
        raise HTTPException(status_code=502, detail=f"RAG failed: {e}") from e
    return ChatResponse(**result)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main(argv: Optional[list[str]] = None) -> int:
    try:
        from dotenv import load_dotenv
        from pathlib import Path

        load_dotenv(Path(__file__).resolve().parent / ".env")
    except ImportError:
        pass

    p = argparse.ArgumentParser(description="C1 RAG chat (user JWT, not service role)")
    p.add_argument("question", nargs="?", help="Question to ask")
    p.add_argument("--match-count", type=int, default=6)
    p.add_argument("--match-threshold", type=float, default=0.2)
    p.add_argument("--filter-subcategory", default=None)
    args = p.parse_args(argv)

    if not args.question:
        p.print_help()
        print("\nProvide a question, e.g. python3 rag_chat.py 'What is WHACK?'")
        return 2

    jwt = os.environ.get("SUPABASE_USER_JWT", "").strip()
    if not jwt:
        print(
            "Set SUPABASE_USER_JWT to a signed-in user's access token "
            "(anon key alone is not enough for RLS-backed retrieval).",
            file=sys.stderr,
        )
        return 2

    try:
        result = run_rag(
            args.question,
            user_jwt=jwt,
            match_threshold=args.match_threshold,
            match_count=args.match_count,
            filter_subcategory=args.filter_subcategory,
        )
    except Exception as e:  # noqa: BLE001
        print(f"Error: {e}", file=sys.stderr)
        return 1

    print("=== Answer ===")
    print(result["answer"])
    print(f"\n=== Retrieved {len(result['chunks'])} chunk(s) ===")
    for i, ch in enumerate(result["chunks"], start=1):
        preview = (ch.get("content") or "")[:160].replace("\n", " ")
        print(f"[{i}] {preview}…")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
