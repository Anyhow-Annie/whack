#!/usr/bin/env python3
"""
Controlled PATCH of corpus department / access_level only.

Default = dry-run → docs/rag_c1/classification_patch_dry_run.md
Optional --apply = UPDATE existing rows (never run unless explicitly approved).

Rules (Person B contract):
  - UPDATE only: documents.department, documents.access_level (filter source_doc_id)
  - UPDATE only: document_chunks.department, document_chunks.access_level (filter chunk_id)
  - No INSERT / DELETE / UPSERT / TRUNCATE
  - Never touch: embedding, embedding_text, metadata, system_role, content,
    profiles, project_members, RLS, schema
  - Mandatory pre-checks; STOP on any mismatch
  - Never print secrets

Usage:
  python3 patch_classification.py
  python3 patch_classification.py --apply   # only after explicit approval
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from ingest_documents import (  # noqa: E402
    CORPUS_ACCESS_LEVELS,
    CORPUS_DEPARTMENTS,
    PERMISSION_ROLES,
    POSITION_TITLES,
    assert_chunk_role_fields,
)

ENV_PATH = HERE / ".env"
EMBED_PATH = HERE / "chunks_with_embeddings.jsonl"
CHUNKS_PATH = HERE.parent / "chunker_output" / "chunks.jsonl"
DRY_RUN_REPORT = HERE / "classification_patch_dry_run.md"

EXPECTED_DOCS = 378
EXPECTED_CHUNKS = 742
EXPECTED_DIMS = 768
EMBED_SAMPLE = 20


class PrecheckError(Exception):
    """Fatal pre-check failure — STOP before any write."""


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    need = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    missing = [k for k in need if not env.get(k)]
    if missing:
        raise SystemExit(f"Missing env: {', '.join(missing)}")
    # Never print secret values — shapes only at call sites
    return env


def rest(
    env: dict[str, str],
    method: str,
    path: str,
    params: Optional[dict[str, str]] = None,
    body: Any = None,
    prefer: str = "return=representation",
) -> tuple[int, Any, dict[str, str]]:
    base = env["SUPABASE_URL"].rstrip("/")
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    q = ("?" + urllib.parse.urlencode(params, doseq=True)) if params else ""
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Prefer": prefer,
    }
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    req = urllib.request.Request(
        base + "/rest/v1" + path + q, data=data, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else None), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500], dict(e.headers)


def parse_embedding(emb: Any) -> Optional[list[float]]:
    if emb is None:
        return None
    if isinstance(emb, list):
        return emb
    if isinstance(emb, str):
        try:
            return json.loads(emb)
        except json.JSONDecodeError:
            parts = [p.strip() for p in emb.strip("[]").split(",") if p.strip()]
            return [float(p) for p in parts]
    return None


def emb_fingerprint(emb: Any) -> Optional[tuple[Any, ...]]:
    vec = parse_embedding(emb)
    if not vec:
        return None
    return (len(vec), round(float(vec[0]), 8), round(float(vec[len(vec) // 2]), 8), round(float(vec[-1]), 8))


def load_local_plans() -> tuple[dict[str, dict[str, str]], dict[str, dict[str, str]], list[str]]:
    """Build plans from stamped embeddings JSONL; cross-check chunks.jsonl stamps."""
    errors: list[str] = []
    if not EMBED_PATH.is_file():
        raise PrecheckError(f"missing {EMBED_PATH}")
    if not CHUNKS_PATH.is_file():
        raise PrecheckError(f"missing {CHUNKS_PATH}")

    doc_plan: dict[str, dict[str, str]] = {}
    chunk_plan: dict[str, dict[str, str]] = {}
    embed_rows = 0
    with EMBED_PATH.open(encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            if not line.strip():
                continue
            r = json.loads(line)
            embed_rows += 1
            cid = r.get("chunk_id") or ""
            did = r.get("document_id") or ""
            status = r.get("classification_status") or ""
            dept = r.get("department") or ""
            access = r.get("access_level") or ""
            if status != "resolved":
                errors.append(f"embed L{line_no} {cid}: classification_status={status!r}")
                continue
            if not cid or not did:
                errors.append(f"embed L{line_no}: missing chunk_id/document_id")
                continue
            if dept not in CORPUS_DEPARTMENTS:
                errors.append(f"embed {cid}: department not allowed: {dept!r}")
            if access not in CORPUS_ACCESS_LEVELS:
                errors.append(f"embed {cid}: access_level not allowed: {access!r}")
            if dept == "General" and access != "All employees":
                errors.append(f"embed {cid}: General requires All employees, got {access!r}")
            if dept in POSITION_TITLES and access != dept:
                errors.append(f"embed {cid}: position-restricted mismatch {dept!r}/{access!r}")
            if dept in PERMISSION_ROLES or access in PERMISSION_ROLES:
                errors.append(f"embed {cid}: permission role leaked into corpus fields")
            try:
                assert_chunk_role_fields(
                    r.get("position") or "",
                    r.get("organizational_role") or "",
                    r.get("system_role") or "",
                )
            except ValueError as e:
                errors.append(f"embed {cid}: {e}")
            emb = r.get("embedding")
            vec = parse_embedding(emb)
            if vec is None or len(vec) != EXPECTED_DIMS:
                errors.append(f"embed {cid}: embedding dims != {EXPECTED_DIMS}")
            payload = {"department": dept, "access_level": access}
            if cid in chunk_plan and chunk_plan[cid] != payload:
                errors.append(f"embed duplicate chunk_id conflict: {cid}")
            chunk_plan[cid] = payload
            if did in doc_plan and doc_plan[did] != payload:
                # Same document must not disagree across its chunks
                errors.append(
                    f"embed doc {did}: conflicting chunk classifications "
                    f"{doc_plan[did]} vs {payload}"
                )
            doc_plan.setdefault(did, payload)

    if embed_rows != EXPECTED_CHUNKS:
        errors.append(f"embed JSONL rows={embed_rows} expected={EXPECTED_CHUNKS}")
    if len(chunk_plan) != EXPECTED_CHUNKS:
        errors.append(f"unique chunk_ids={len(chunk_plan)} expected={EXPECTED_CHUNKS}")
    if len(doc_plan) != EXPECTED_DOCS:
        errors.append(f"unique document_ids={len(doc_plan)} expected={EXPECTED_DOCS}")

    # Cross-check stamps on full chunks.jsonl for shared chunk_ids
    checked = 0
    with CHUNKS_PATH.open(encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            r = json.loads(line)
            cid = r.get("chunk_id") or ""
            if cid not in chunk_plan:
                continue  # headers etc. may lack embeddings
            checked += 1
            if (r.get("classification_status") or "") != "resolved":
                errors.append(f"chunks.jsonl {cid}: not resolved")
                continue
            if (r.get("department") or "") != chunk_plan[cid]["department"]:
                errors.append(f"chunks.jsonl {cid}: department disagrees with embed plan")
            if (r.get("access_level") or "") != chunk_plan[cid]["access_level"]:
                errors.append(f"chunks.jsonl {cid}: access_level disagrees with embed plan")
    if checked != EXPECTED_CHUNKS:
        errors.append(
            f"chunks.jsonl overlap with embed plan={checked} expected={EXPECTED_CHUNKS}"
        )

    return doc_plan, chunk_plan, errors


def fetch_live(env: dict[str, str]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    _, docs, _ = rest(
        env,
        "GET",
        "/documents",
        {"select": "id,source_doc_id,department,access_level", "limit": "2000"},
        prefer="count=exact",
    )
    chunks: list[dict[str, Any]] = []
    start = 0
    while True:
        _, batch, _ = rest(
            env,
            "GET",
            "/document_chunks",
            {
                "select": "id,chunk_id,source_doc_id,department,access_level,system_role",
                "limit": "1000",
                "offset": str(start),
            },
            prefer="count=exact",
        )
        batch = batch or []
        chunks.extend(batch)
        if len(batch) < 1000:
            break
        start += 1000
    return docs or [], chunks


def precheck_live(
    env: dict[str, str],
    doc_plan: dict[str, dict[str, str]],
    chunk_plan: dict[str, dict[str, str]],
    docs: list[dict[str, Any]],
    chunks: list[dict[str, Any]],
) -> list[str]:
    errors: list[str] = []
    whack_docs = [d for d in docs if d.get("source_doc_id")]
    if len(whack_docs) != EXPECTED_DOCS:
        errors.append(f"live WHACK documents={len(whack_docs)} expected={EXPECTED_DOCS}")
    if len(chunks) != EXPECTED_CHUNKS:
        errors.append(f"live chunks={len(chunks)} expected={EXPECTED_CHUNKS}")

    live_docs = {d["source_doc_id"]: d for d in whack_docs}
    live_chunks = {c["chunk_id"]: c for c in chunks if c.get("chunk_id")}

    missing_docs = sorted(set(doc_plan) - set(live_docs))
    extra_plan_chunks = sorted(set(chunk_plan) - set(live_chunks))
    missing_live_chunks = sorted(set(live_chunks) - set(chunk_plan))
    if missing_docs:
        errors.append(f"planned docs missing live: {missing_docs[:10]}… n={len(missing_docs)}")
    if extra_plan_chunks:
        errors.append(
            f"planned chunks missing live: {extra_plan_chunks[:5]}… n={len(extra_plan_chunks)}"
        )
    if missing_live_chunks:
        errors.append(
            f"live chunks not in plan: {missing_live_chunks[:5]}… n={len(missing_live_chunks)}"
        )

    # Sample embeddings — read-only; never write
    sample_ids = sorted(chunk_plan.keys())[:EMBED_SAMPLE]
    for cid in sample_ids:
        st, rows, _ = rest(
            env,
            "GET",
            "/document_chunks",
            {"select": "chunk_id,embedding", "chunk_id": f"eq.{cid}", "limit": "1"},
        )
        if st != 200 or not rows:
            errors.append(f"embedding probe failed for {cid} status={st}")
            continue
        vec = parse_embedding(rows[0].get("embedding"))
        if vec is None or len(vec) != EXPECTED_DIMS:
            errors.append(f"live embedding dims bad for {cid}")

    # system_role must remain legacy vocabulary on live rows (read-only check)
    for c in chunks:
        sysr = c.get("system_role") or ""
        if sysr in PERMISSION_ROLES:
            errors.append(
                f"live chunk {c.get('chunk_id')}: system_role is permission {sysr!r}"
            )

    return errors


def plan_updates(
    doc_plan: dict[str, dict[str, str]],
    chunk_plan: dict[str, dict[str, str]],
    docs: list[dict[str, Any]],
    chunks: list[dict[str, Any]],
) -> dict[str, Any]:
    live_docs = {d["source_doc_id"]: d for d in docs if d.get("source_doc_id")}
    live_chunks = {c["chunk_id"]: c for c in chunks if c.get("chunk_id")}

    docs_to_update: list[dict[str, Any]] = []
    docs_skip = 0
    for did, plan in sorted(doc_plan.items()):
        live = live_docs[did]
        if live.get("department") == plan["department"] and live.get("access_level") == plan[
            "access_level"
        ]:
            docs_skip += 1
        else:
            docs_to_update.append(
                {
                    "source_doc_id": did,
                    "id": live["id"],
                    "from": {
                        "department": live.get("department"),
                        "access_level": live.get("access_level"),
                    },
                    "to": plan,
                }
            )

    chunks_to_update: list[dict[str, Any]] = []
    chunks_skip = 0
    for cid, plan in sorted(chunk_plan.items()):
        live = live_chunks[cid]
        if live.get("department") == plan["department"] and live.get("access_level") == plan[
            "access_level"
        ]:
            chunks_skip += 1
        else:
            chunks_to_update.append(
                {
                    "chunk_id": cid,
                    "id": live["id"],
                    "from": {
                        "department": live.get("department"),
                        "access_level": live.get("access_level"),
                    },
                    "to": plan,
                }
            )

    return {
        "docs_to_update": docs_to_update,
        "docs_skip": docs_skip,
        "chunks_to_update": chunks_to_update,
        "chunks_skip": chunks_skip,
        "doc_dept_plan": Counter(p["department"] for p in doc_plan.values()),
        "doc_access_plan": Counter(p["access_level"] for p in doc_plan.values()),
        "chunk_dept_plan": Counter(p["department"] for p in chunk_plan.values()),
        "chunk_access_plan": Counter(p["access_level"] for p in chunk_plan.values()),
        "doc_dept_live": Counter(d.get("department") for d in docs if d.get("source_doc_id")),
        "doc_access_live": Counter(d.get("access_level") for d in docs if d.get("source_doc_id")),
        "chunk_dept_live": Counter(c.get("department") for c in chunks),
        "chunk_access_live": Counter(c.get("access_level") for c in chunks),
    }


def write_dry_run_report(
    *,
    ok: bool,
    errors: list[str],
    plan: dict[str, Any],
    env_shapes: dict[str, Any],
) -> None:
    lines = [
        "# Classification patch dry-run",
        "",
        f"**Generated:** {datetime.now(timezone.utc).isoformat()}",
        "**Mode:** dry-run — no Supabase writes",
        "**Patch fields:** `department`, `access_level` only",
        "**Keys:** `source_doc_id` (documents), `chunk_id` (document_chunks)",
        "",
        "## Gate",
        "",
        f"**{'PASS — safe for --apply after explicit approval' if ok else 'STOP — pre-check failed'}**",
        "",
        "## Env shapes (no secrets)",
        "",
        f"- SUPABASE_URL host: `{env_shapes.get('url_host')}`",
        f"- SUPABASE_SERVICE_ROLE_KEY len={env_shapes.get('sr_len')} jwt={env_shapes.get('sr_jwt')}",
        "",
        "## Planned histograms (from stamped JSONL)",
        "",
        "### Documents",
        "",
        "| department | count | access_level | count |",
        "| --- | ---: | --- | ---: |",
    ]
    # aligned rows roughly
    dept_items = sorted(plan["doc_dept_plan"].items())
    access_map = dict(plan["doc_access_plan"])
    for k, v in dept_items:
        ak = k if k in access_map else ("All employees" if k == "General" else k)
        lines.append(f"| {k} | {v} | {ak} | {access_map.get(ak, access_map.get(k, 0))} |")
    lines += [
        "",
        "### Chunks",
        "",
        "| department | count |",
        "| --- | ---: |",
    ]
    for k, v in sorted(plan["chunk_dept_plan"].items()):
        lines.append(f"| {k} | {v} |")
    lines += [
        "",
        "## Live histograms (before patch)",
        "",
        f"- documents department: `{dict(plan['doc_dept_live'])}`",
        f"- documents access_level: `{dict(plan['doc_access_live'])}`",
        f"- chunks department: `{dict(plan['chunk_dept_live'])}`",
        f"- chunks access_level: `{dict(plan['chunk_access_live'])}`",
        "",
        "## Update plan",
        "",
        "| Target | To UPDATE | Already match (skip) |",
        "| --- | ---: | ---: |",
        f"| documents | {len(plan['docs_to_update'])} | {plan['docs_skip']} |",
        f"| document_chunks | {len(plan['chunks_to_update'])} | {plan['chunks_skip']} |",
        "",
        "### Sample doc updates (first 15)",
        "",
    ]
    if not plan["docs_to_update"]:
        lines.append("_None — live already matches plan._")
    for row in plan["docs_to_update"][:15]:
        lines.append(
            f"- `{row['source_doc_id']}`: {row['from']} → {row['to']}"
        )
    lines += ["", "### Sample chunk updates (first 15)", ""]
    if not plan["chunks_to_update"]:
        lines.append("_None — live already matches plan._")
    for row in plan["chunks_to_update"][:15]:
        lines.append(f"- `{row['chunk_id']}`: {row['from']} → {row['to']}")
    lines += [
        "",
        "## Guarantees",
        "",
        "- No INSERT / DELETE / UPSERT / TRUNCATE",
        "- No writes to embedding / embedding_text / metadata / system_role / content",
        "- No profiles / project_members / RLS / schema changes",
        "- `--apply` requires explicit approval after this dry-run",
        "",
    ]
    if errors:
        lines += ["## Pre-check errors (STOP)", ""]
        for e in errors[:50]:
            lines.append(f"- {e}")
        if len(errors) > 50:
            lines.append(f"- … +{len(errors) - 50} more")
        lines.append("")
    DRY_RUN_REPORT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {DRY_RUN_REPORT}", flush=True)


def apply_updates(
    env: dict[str, str],
    plan: dict[str, Any],
) -> dict[str, Any]:
    """PATCH department/access_level only. Called only from --apply."""
    doc_ok = doc_fail = 0
    chunk_ok = chunk_fail = 0
    errors: list[dict[str, Any]] = []

    for row in plan["docs_to_update"]:
        st, body, _ = rest(
            env,
            "PATCH",
            "/documents",
            params={"source_doc_id": f"eq.{row['source_doc_id']}"},
            body={
                "department": row["to"]["department"],
                "access_level": row["to"]["access_level"],
            },
            prefer="return=representation",
        )
        if st in (200, 204):
            if isinstance(body, list) and body and body[0].get("id") != row["id"]:
                doc_fail += 1
                errors.append({"document_id": row["source_doc_id"], "reason": "id_changed"})
            else:
                doc_ok += 1
        else:
            doc_fail += 1
            errors.append({"document_id": row["source_doc_id"], "status": st, "body": str(body)[:200]})
        time.sleep(0.02)

    for i, row in enumerate(plan["chunks_to_update"]):
        st, body, _ = rest(
            env,
            "PATCH",
            "/document_chunks",
            params={"chunk_id": f"eq.{row['chunk_id']}"},
            body={
                "department": row["to"]["department"],
                "access_level": row["to"]["access_level"],
            },
            prefer="return=representation",
        )
        if st in (200, 204):
            if isinstance(body, list) and body and body[0].get("id") != row["id"]:
                chunk_fail += 1
                errors.append({"chunk_id": row["chunk_id"], "reason": "id_changed"})
            else:
                chunk_ok += 1
        else:
            chunk_fail += 1
            errors.append({"chunk_id": row["chunk_id"], "status": st, "body": str(body)[:200]})
        if (i + 1) % 50 == 0:
            print(f"  chunks {i+1}/{len(plan['chunks_to_update'])} ok={chunk_ok} fail={chunk_fail}", flush=True)
        time.sleep(0.015)

    return {
        "doc_ok": doc_ok,
        "doc_fail": doc_fail,
        "chunk_ok": chunk_ok,
        "chunk_fail": chunk_fail,
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="PATCH corpus department/access_level only")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply UPDATEs after pre-checks (default is dry-run only)",
    )
    args = parser.parse_args()

    env = load_env()
    env_shapes = {
        "url_host": env["SUPABASE_URL"].rstrip("/").split("//")[-1],
        "sr_len": len(env["SUPABASE_SERVICE_ROLE_KEY"]),
        "sr_jwt": env["SUPABASE_SERVICE_ROLE_KEY"].count(".") == 2,
    }
    print(
        f"Env shapes url_host={env_shapes['url_host']} sr_len={env_shapes['sr_len']} "
        f"mode={'APPLY' if args.apply else 'DRY-RUN'}",
        flush=True,
    )

    empty_plan = {
        "docs_to_update": [],
        "docs_skip": 0,
        "chunks_to_update": [],
        "chunks_skip": 0,
        "doc_dept_plan": Counter(),
        "doc_access_plan": Counter(),
        "chunk_dept_plan": Counter(),
        "chunk_access_plan": Counter(),
        "doc_dept_live": Counter(),
        "doc_access_live": Counter(),
        "chunk_dept_live": Counter(),
        "chunk_access_live": Counter(),
    }
    try:
        doc_plan, chunk_plan, local_errors = load_local_plans()
    except PrecheckError as e:
        write_dry_run_report(ok=False, errors=[str(e)], plan=empty_plan, env_shapes=env_shapes)
        print(f"STOP: {e}", flush=True)
        return 2

    docs, chunks = fetch_live(env)
    live_errors = precheck_live(env, doc_plan, chunk_plan, docs, chunks)
    errors = local_errors + live_errors
    plan = plan_updates(doc_plan, chunk_plan, docs, chunks) if not errors else {
        **empty_plan,
        "doc_dept_plan": Counter(p["department"] for p in doc_plan.values()),
        "doc_access_plan": Counter(p["access_level"] for p in doc_plan.values()),
        "chunk_dept_plan": Counter(p["department"] for p in chunk_plan.values()),
        "chunk_access_plan": Counter(p["access_level"] for p in chunk_plan.values()),
        "doc_dept_live": Counter(d.get("department") for d in docs if d.get("source_doc_id")),
        "doc_access_live": Counter(d.get("access_level") for d in docs if d.get("source_doc_id")),
        "chunk_dept_live": Counter(c.get("department") for c in chunks),
        "chunk_access_live": Counter(c.get("access_level") for c in chunks),
    }
    if errors:
        write_dry_run_report(ok=False, errors=errors, plan=plan, env_shapes=env_shapes)
        print(f"STOP: {len(errors)} pre-check failure(s)", flush=True)
        return 2

    write_dry_run_report(ok=True, errors=[], plan=plan, env_shapes=env_shapes)
    print(
        f"DRY-RUN PASS docs_update={len(plan['docs_to_update'])} docs_skip={plan['docs_skip']} "
        f"chunks_update={len(plan['chunks_to_update'])} chunks_skip={plan['chunks_skip']}",
        flush=True,
    )

    if not args.apply:
        print("Stop here — await explicit approval before --apply", flush=True)
        return 0

    print("APPLY starting (department/access_level only)…", flush=True)
    result = apply_updates(env, plan)
    print(
        f"APPLY done doc_ok={result['doc_ok']} doc_fail={result['doc_fail']} "
        f"chunk_ok={result['chunk_ok']} chunk_fail={result['chunk_fail']}",
        flush=True,
    )
    return 0 if result["doc_fail"] == 0 and result["chunk_fail"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
