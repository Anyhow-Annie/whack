#!/usr/bin/env python3
"""
Upload / align chunks_with_embeddings.jsonl → live Supabase tables.

Live SoT (no DDL/RLS redesign; do not modify profiles/project_members):
- Corpus department = position title OR General (Person B confirmed)
- Corpus access_level = position title (restricted) OR All employees (general)
- Position also in metadata.position = metadata.organizational_role
- Permission → profiles.role / position_role_map only — never chunk metadata
- Chunk system_role = legacy Manager|Member — never overwrite/convert/use for ACL
- Reuses local embedding vectors — never calls the embedding API
- Skip existing source_doc_id / chunk_id (no silent vector overwrite)
- Optional --link-project-ids: set documents.project_id from live projects.production
- Never prints secrets

Usage:
  python3 supabase_upload_run.py --dry-run
  python3 supabase_upload_run.py --link-project-ids --dry-run
  python3 supabase_upload_run.py --link-project-ids
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from ingest_documents import (  # noqa: E402
    map_access,
    classify_corpus,
    assert_mapping_enums,
    assert_chunk_role_fields,
    DEPARTMENTS,
    ACCESS_LEVELS,
    POSITION_TITLES,
    PERMISSION_ROLES,
    POSITION_ROLE_MAP,
)

ENV_PATH = HERE / ".env"
EMBED_PATH = HERE / "chunks_with_embeddings.jsonl"
PROGRESS_PATH = HERE / "supabase_upload_progress.json"
DRY_RUN_PATH = HERE / "embedding_recovery_dry_run.md"
PROJECT_LINK_DRY_RUN_PATH = HERE / "project_id_link_dry_run.md"

CHUNK_BATCH = 25
EXPECTED_DIMS = 768


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
    return env


def empty_to_none(s: Any) -> Any:
    if s is None:
        return None
    if isinstance(s, str) and s.strip() == "":
        return None
    return s


def save_progress(obj: dict[str, Any]) -> None:
    obj["updated_at"] = datetime.now(timezone.utc).isoformat()
    PROGRESS_PATH.write_text(json.dumps(obj, indent=2), encoding="utf-8")


def chunk_metadata(r: dict[str, Any]) -> dict[str, Any]:
    """Craft / provenance metadata only. Position must NOT become department or permission."""
    pos = empty_to_none(r.get("position"))
    org = empty_to_none(r.get("organizational_role"))
    assert_chunk_role_fields(
        position=pos or "",
        organizational_role=org or "",
        system_role=(r.get("system_role") or ""),
    )
    meta: dict[str, Any] = {
        "path": r.get("path"),
        "section_path": r.get("section_path"),
        "section_heading": r.get("section_heading"),
        "document_type": r.get("document_type"),
        "embed_model": r.get("embed_model"),
        "embed_dims": r.get("embed_dims"),
        "approx_tokens": r.get("approx_tokens"),
        "vectors_reused": True,
        "embedding_source": "chunks_with_embeddings.jsonl",
    }
    # Employee craft fields → metadata (no first-class position columns on chunks)
    for key in (
        "organizational_role",
        "position",
        "employee_name",
        "owner_employee_id",
        "ownership_is_acl",
    ):
        val = r.get(key)
        if val is None or (isinstance(val, str) and val.strip() == ""):
            continue
        meta[key] = val
    # owner_employee_id is authorship evidence only — never an ACL grant
    if meta.get("ownership_is_acl") is True:
        raise ValueError("ownership_is_acl must remain false")
    return meta


def validate_local_vectors(rows: list[dict[str, Any]]) -> dict[str, Any]:
    ids = [r["chunk_id"] for r in rows]
    unique = len(set(ids))
    bad_dims = 0
    bad_finite = 0
    bad_norm = 0
    missing = 0
    for r in rows:
        emb = r.get("embedding")
        if emb is None:
            missing += 1
            continue
        if len(emb) != EXPECTED_DIMS:
            bad_dims += 1
        if not all(isinstance(x, (int, float)) and math.isfinite(x) for x in emb):
            bad_finite += 1
        n = math.sqrt(sum(float(x) * float(x) for x in emb))
        if abs(n - 1.0) > 0.05:
            bad_norm += 1
    return {
        "count": len(rows),
        "unique_chunk_ids": unique,
        "dupes": len(rows) - unique,
        "missing_embedding": missing,
        "bad_dims": bad_dims,
        "bad_finite": bad_finite,
        "bad_norm": bad_norm,
        "vectors_ok": missing == 0
        and bad_dims == 0
        and bad_finite == 0
        and bad_norm == 0
        and unique == len(rows),
    }


def build_pending(
    rows: list[dict[str, Any]],
    by_doc: dict[str, list[dict[str, Any]]],
    existing_docs: dict[str, str],
    existing_chunks: set[str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any], dict[str, str]]:
    """Plan document + chunk rows without writing. Vectors copied from local file."""
    stats: dict[str, Any] = {
        "docs_to_insert": 0,
        "docs_to_reuse": 0,
        "docs_unresolved": 0,
        "chunks_to_insert": 0,
        "chunks_to_skip": 0,
        "chunks_unresolved": 0,
        "chunks_missing_parent": 0,
        "errors": [],
        "dept_hist": Counter(),
        "access_hist": Counter(),
        "subcategory_hist": Counter(),
        "doc_dept_hist": Counter(),
        "doc_access_hist": Counter(),
        "ambiguous": [],
    }
    doc_uuid: dict[str, str] = dict(existing_docs)
    planned_docs: list[dict[str, Any]] = []
    doc_mapping: dict[str, Any] = {}

    for whack_id, chunks in sorted(by_doc.items()):
        sample = chunks[0]
        mapping = map_access(
            whack_id,
            sample.get("document_type") or "",
            sample.get("path") or "",
            sample.get("document_title") or "",
            level=sample.get("level") or "",
            position=sample.get("position") or "",
            organizational_role=sample.get("organizational_role") or "",
        )
        if mapping is None:
            amb = classify_corpus(
                document_id=whack_id,
                document_type=sample.get("document_type") or "",
                path=sample.get("path") or "",
                title=sample.get("document_title") or "",
                level=sample.get("level") or "",
                position=sample.get("position") or "",
                organizational_role=sample.get("organizational_role") or "",
            )
            stats["docs_unresolved"] += 1
            stats["ambiguous"].append(
                {
                    "document_id": whack_id,
                    "document_type": sample.get("document_type"),
                    "level": sample.get("level"),
                    "position": sample.get("position"),
                    "reason": amb.reason or "unresolved_mapping",
                }
            )
            stats["errors"].append({"document_id": whack_id, "reason": amb.reason or "unresolved_mapping"})
            continue
        assert_mapping_enums(mapping)
        doc_mapping[whack_id] = mapping
        stats["doc_dept_hist"][mapping.department] += 1
        stats["doc_access_hist"][mapping.access_level] += 1

        if whack_id in doc_uuid:
            stats["docs_to_reuse"] += 1
            continue

        supabase_id = str(uuid.uuid4())
        body = "\n\n".join((c.get("chunk_text") or "") for c in chunks)
        if len(body) > 100_000:
            body = body[:100_000]
        doc_row = {
            "id": supabase_id,
            "title": sample.get("document_title") or whack_id,
            "content": body or whack_id,
            # Person B: position title OR General
            "department": mapping.department,
            "access_level": mapping.access_level,
            "subcategory": mapping.subcategory,
            "source_doc_id": whack_id,
            "document_type": empty_to_none(sample.get("document_type")),
            "level": empty_to_none(sample.get("level")),
            "season": empty_to_none(sample.get("season")),
            "production": empty_to_none(sample.get("production")),
            "venue": empty_to_none(sample.get("venue")),
            "lifecycle_stage": empty_to_none(sample.get("lifecycle_stage")),
        }
        planned_docs.append(doc_row)
        doc_uuid[whack_id] = supabase_id
        stats["docs_to_insert"] += 1

    pending: list[dict[str, Any]] = []
    for r in rows:
        cid = r["chunk_id"]
        whack_id = r["document_id"]
        mapping = doc_mapping.get(whack_id)
        if mapping is None:
            # Inherit document classification; if doc ambiguous, chunk is too
            if cid in existing_chunks:
                stats["chunks_to_skip"] += 1
            else:
                stats["chunks_unresolved"] += 1
                stats["errors"].append({"chunk_id": cid, "reason": "unresolved_mapping"})
            continue
        assert_mapping_enums(mapping)
        if mapping.department in PERMISSION_ROLES:
            raise ValueError(f"refusing permission-as-department: {mapping.department}")
        stats["dept_hist"][mapping.department] += 1
        stats["access_hist"][mapping.access_level] += 1
        stats["subcategory_hist"][mapping.subcategory] += 1
        if cid in existing_chunks:
            stats["chunks_to_skip"] += 1
            continue
        if whack_id not in doc_uuid:
            stats["chunks_missing_parent"] += 1
            stats["errors"].append({"chunk_id": cid, "reason": "missing_parent_document"})
            continue
        sys_role = empty_to_none(r.get("system_role"))
        if sys_role in PERMISSION_ROLES:
            raise ValueError(
                f"chunk system_role must not be permission role: {sys_role}"
            )
        pending.append(
            {
                "id": str(uuid.uuid4()),
                "document_id": doc_uuid[whack_id],
                "chunk_index": int(r.get("chunk_index") or 0),
                "content": r.get("chunk_text") or "",
                "embedding": r["embedding"],  # reused local vector
                # Person B: inherit document department/access_level
                "department": mapping.department,
                "access_level": mapping.access_level,
                "subcategory": mapping.subcategory,
                "chunk_id": cid,
                "source_doc_id": whack_id,
                "chunk_type": empty_to_none(r.get("chunk_type")),
                "level": empty_to_none(r.get("level")),
                "season": empty_to_none(r.get("season")),
                "production": empty_to_none(r.get("production")),
                "venue": empty_to_none(r.get("venue")),
                "employee_id": empty_to_none(r.get("employee_id")),
                "system_role": sys_role,  # legacy Manager|Member only
                "lifecycle_stage": empty_to_none(r.get("lifecycle_stage")),
                "safety_critical": bool(r.get("safety_critical"))
                if r.get("safety_critical") is not None
                else False,
                "include_in_embedding": True,
                "include_in_retrieval": bool(r.get("include_in_retrieval"))
                if r.get("include_in_retrieval") is not None
                else True,
                "embedding_text": r.get("embedding_text") or r.get("chunk_text") or "",
                "metadata": chunk_metadata(r),
            }
        )
    stats["chunks_to_insert"] = len(pending)
    return planned_docs, pending, stats, doc_uuid


def write_dry_run_report(
    vector_check: dict[str, Any],
    plan_stats: dict[str, Any],
    existing_docs: int,
    existing_chunks: int,
    schema_notes: list[str],
    compatible: bool,
) -> None:
    lines = [
        "# Embedding recovery dry-run",
        "",
        f"**Generated:** {datetime.now(timezone.utc).isoformat()}",
        "**Mode:** dry-run — no Supabase writes",
        "**Vectors:** reused from `chunks_with_embeddings.jsonl` (no embedding API)",
        "",
        "## Compatibility",
        "",
        f"**{'COMPATIBLE — safe to upload' if compatible else 'INCOMPATIBLE — STOP'}**",
        "",
        "## Local vectors",
        "",
        "| Check | Value |",
        "| --- | ---: |",
        f"| Rows | {vector_check['count']} |",
        f"| Unique chunk_ids | {vector_check['unique_chunk_ids']} |",
        f"| Dupes | {vector_check['dupes']} |",
        f"| Missing embedding | {vector_check['missing_embedding']} |",
        f"| dims ≠ 768 | {vector_check['bad_dims']} |",
        f"| Non-finite | {vector_check['bad_finite']} |",
        f"| L2 off | {vector_check['bad_norm']} |",
        f"| vectors_ok | {vector_check['vectors_ok']} |",
        "",
        "## Live DB (before upload)",
        "",
        f"- Existing `documents` with `source_doc_id`: **{existing_docs}**",
        f"- Existing `document_chunks.chunk_id`: **{existing_chunks}**",
        "",
        "## Planned writes",
        "",
        "| Action | Count |",
        "| --- | ---: |",
        f"| Documents to insert | {plan_stats['docs_to_insert']} |",
        f"| Documents to reuse (skip) | {plan_stats['docs_to_reuse']} |",
        f"| Documents unresolved | {plan_stats['docs_unresolved']} |",
        f"| Chunks to insert | {plan_stats['chunks_to_insert']} |",
        f"| Chunks to skip (already present) | {plan_stats['chunks_to_skip']} |",
        f"| Chunks unresolved | {plan_stats['chunks_unresolved']} |",
        f"| Chunks missing parent | {plan_stats['chunks_missing_parent']} |",
        "",
        "## Required metadata mappings (Person B confirmed)",
        "",
        "| Field | Source | Notes |",
        "| --- | --- | --- |",
        "| `department` | classify_corpus | Position title OR `General` |",
        "| `access_level` | classify_corpus | Position title (restricted) OR `All employees` |",
        "| `subcategory` | classify_corpus | Stable filter slug |",
        "| `system_role` | chunk field | Legacy Manager/Member only — never convert |",
        "| `employee_id` | chunk field | When employee-level |",
        "| `season`/`production`/`venue` | chunk field | Production assignment |",
        "| `organizational_role` / `position` | chunk → `metadata` jsonb | Relevance; not permission |",
        "| `embedding` | local JSONL vector | Reused; not regenerated |",
        "| `chunk_id` / `source_doc_id` | preserved | Stable IDs |",
        "",
        "### Document department histogram (classified)",
        "",
        "| department | count |",
        "| --- | ---: |",
    ]
    for k, v in sorted((plan_stats.get("doc_dept_hist") or plan_stats["dept_hist"]).items()):
        lines.append(f"| {k} | {v} |")
    lines += [
        "",
        "### Document access_level histogram (classified)",
        "",
        "| access_level | count |",
        "| --- | ---: |",
    ]
    for k, v in sorted((plan_stats.get("doc_access_hist") or plan_stats["access_hist"]).items()):
        lines.append(f"| {k} | {v} |")
    lines += [
        "",
        "### Chunk department histogram (all classified rows)",
        "",
        "| department | count |",
        "| --- | ---: |",
    ]
    for k, v in sorted(plan_stats["dept_hist"].items()):
        lines.append(f"| {k} | {v} |")
    lines += [
        "",
        "### Chunk access_level histogram (all classified rows)",
        "",
        "| access_level | count |",
        "| --- | ---: |",
    ]
    for k, v in sorted(plan_stats["access_hist"].items()):
        lines.append(f"| {k} | {v} |")
    lines += [
        "",
        "## Schema notes",
        "",
    ]
    for n in schema_notes:
        lines.append(f"- {n}")
    lines += [
        "",
        "## Vectors reused confirmation",
        "",
        "- Embeddings read only from `chunks_with_embeddings.jsonl`",
        "- No Gemini / embedding API call in this script path",
        "- `metadata.vectors_reused=true` stamped on planned chunk rows",
        "",
    ]
    if plan_stats["errors"]:
        lines += ["## Plan errors (sample)", ""]
        for e in plan_stats["errors"][:20]:
            lines.append(f"- `{json.dumps(e)}`")
        lines.append("")
    DRY_RUN_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote dry-run report → {DRY_RUN_PATH}", flush=True)


def link_document_project_ids(sb: Any, *, dry_run: bool) -> int:
    """Set documents.project_id from live projects.production (factual FK; not auth).

    Does not touch embeddings, department, access_level, or RLS.
    """
    projects = sb.table("projects").select("id,production,season,venue").execute().data or []
    by_production = {p["production"]: p for p in projects if p.get("production")}
    docs = (
        sb.table("documents")
        .select("id,source_doc_id,production,season,project_id")
        .not_.is_("source_doc_id", "null")
        .execute()
        .data
        or []
    )
    planned: list[dict[str, Any]] = []
    already = 0
    no_production = 0
    unknown_production = 0
    for d in docs:
        if d.get("project_id"):
            already += 1
            continue
        prod = d.get("production")
        if not prod:
            no_production += 1
            continue
        proj = by_production.get(prod)
        if not proj:
            unknown_production += 1
            continue
        planned.append(
            {
                "document_id": d["id"],
                "source_doc_id": d.get("source_doc_id"),
                "production": prod,
                "project_id": proj["id"],
                "project_season": proj.get("season"),
            }
        )

    lines = [
        "# documents.project_id link dry-run",
        "",
        f"**Generated:** {datetime.now(timezone.utc).isoformat()}",
        f"**Mode:** {'dry-run (no writes)' if dry_run else 'APPLY'}",
        "",
        "## Live projects",
        "",
        "| production | project_id | season |",
        "| --- | --- | --- |",
    ]
    for p in projects:
        lines.append(f"| {p.get('production')} | `{p.get('id')}` | {p.get('season')} |")
    lines += [
        "",
        "## Plan",
        "",
        f"- Docs already linked: **{already}**",
        f"- Docs to link: **{len(planned)}**",
        f"- Docs with no production: **{no_production}**",
        f"- Docs with unknown production: **{unknown_production}**",
        "",
        "Sample (first 15):",
        "",
    ]
    for row in planned[:15]:
        lines.append(
            f"- `{row['source_doc_id']}` ({row['production']}) → `{row['project_id']}`"
        )
    PROJECT_LINK_DRY_RUN_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(
        f"project_id link plan: to_link={len(planned)} already={already} "
        f"no_production={no_production} unknown={unknown_production} "
        f"→ {PROJECT_LINK_DRY_RUN_PATH.name}",
        flush=True,
    )
    if dry_run:
        return 0

    updated = 0
    errors = 0
    for row in planned:
        try:
            sb.table("documents").update({"project_id": row["project_id"]}).eq(
                "id", row["document_id"]
            ).execute()
            updated += 1
        except Exception as e:  # noqa: BLE001
            errors += 1
            print(
                f"  project_id update fail {row.get('source_doc_id')}: {type(e).__name__}",
                flush=True,
            )
    print(f"project_id link applied updated={updated} errors={errors}", flush=True)
    save_progress(
        {
            "phase": "project_id_link",
            "updated": updated,
            "errors": errors,
            "planned": len(planned),
        }
    )
    return 0 if errors == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Recover/upload embeddings to Supabase")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Plan inserts only; write embedding_recovery_dry_run.md; no writes",
    )
    parser.add_argument(
        "--link-project-ids",
        action="store_true",
        help=(
            "Set documents.project_id from live projects.production "
            "(safe FK; no embedding/department changes)"
        ),
    )
    args = parser.parse_args()

    from supabase import create_client

    env = load_env()
    sb = create_client(env["SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])
    del env

    rows: list[dict[str, Any]] = []
    with EMBED_PATH.open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                rows.append(json.loads(line))
    print(f"Loaded {len(rows)} embedded chunks", flush=True)

    vector_check = validate_local_vectors(rows)
    print(f"Vector check: {vector_check}", flush=True)
    if not vector_check["vectors_ok"]:
        print("STOP: local vectors invalid — no upload", flush=True)
        return 2

    by_doc: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        by_doc[r["document_id"]].append(r)

    # Preload existing source_doc_ids and chunk_ids (paginated)
    existing_docs: dict[str, str] = {}
    start = 0
    while True:
        res = (
            sb.table("documents")
            .select("id,source_doc_id")
            .not_.is_("source_doc_id", "null")
            .range(start, start + 999)
            .execute()
        )
        data = res.data or []
        for d in data:
            if d.get("source_doc_id"):
                existing_docs[d["source_doc_id"]] = d["id"]
        if len(data) < 1000:
            break
        start += 1000

    existing_chunks: set[str] = set()
    start = 0
    while True:
        res = (
            sb.table("document_chunks")
            .select("chunk_id")
            .not_.is_("chunk_id", "null")
            .range(start, start + 999)
            .execute()
        )
        data = res.data or []
        for d in data:
            if d.get("chunk_id"):
                existing_chunks.add(d["chunk_id"])
        if len(data) < 1000:
            break
        start += 1000

    print(
        f"Existing docs with source_doc_id={len(existing_docs)} "
        f"existing chunk_ids={len(existing_chunks)}",
        flush=True,
    )

    planned_docs, pending, plan_stats, doc_uuid = build_pending(
        rows, by_doc, existing_docs, existing_chunks
    )

    # Live position↔permission (column named system_role; values are permissions)
    position_role_map: dict[str, str] = {}
    try:
        prm_res = sb.table("position_role_map").select("position,system_role").execute()
        for row in prm_res.data or []:
            position_role_map[row["position"]] = row["system_role"]
    except Exception as e:  # noqa: BLE001
        position_role_map = {}
        print(f"WARN: could not read position_role_map: {type(e).__name__}", flush=True)

    schema_notes = [
        "OpenAPI: documents + document_chunks + position_role_map present; embedding=vector(768)",
        "Corpus department = position title OR General (Person B confirmed)",
        "Corpus access_level = position title OR All employees (Person B confirmed)",
        "Position also in metadata.position = metadata.organizational_role",
        "profiles.department = position; profiles.role = permission (admin|member|project_lead)",
        f"position_role_map (live): {position_role_map or POSITION_ROLE_MAP}",
        "chunk system_role = legacy Manager|Member — never overwrite/convert/use for ACL",
        "Permission never written to chunk metadata",
        "match_document_chunks RPC present (query_embedding required)",
        f"Allowed corpus departments: {sorted(DEPARTMENTS)}",
        f"Allowed corpus access_levels: {sorted(ACCESS_LEVELS)}",
        f"Permission roles (profiles only): {sorted(PERMISSION_ROLES)}",
    ]
    incompatible = (
        plan_stats["docs_unresolved"] > 0
        or plan_stats["chunks_unresolved"] > 0
        or plan_stats["chunks_missing_parent"] > 0
        or not vector_check["vectors_ok"]
    )
    # Soft check: existing chunks skipped (non-destructive). Ambiguous docs block controlled upload.
    compatible = not incompatible

    write_dry_run_report(
        vector_check,
        plan_stats,
        len(existing_docs),
        len(existing_chunks),
        schema_notes,
        compatible,
    )

    if args.dry_run:
        if args.link_project_ids:
            link_document_project_ids(sb, dry_run=True)
        print(
            f"DRY-RUN complete compatible={compatible} "
            f"docs_insert={plan_stats['docs_to_insert']} "
            f"chunks_insert={plan_stats['chunks_to_insert']} "
            f"ambiguous_docs={plan_stats['docs_unresolved']}",
            flush=True,
        )
        return 0 if compatible else 3

    link_rc = 0
    if args.link_project_ids:
        link_rc = link_document_project_ids(sb, dry_run=False)

    if not compatible:
        print("STOP: dry-run found incompatibilities — refusing upload", flush=True)
        return 3 if link_rc == 0 else link_rc

    stats = {
        "docs_inserted": 0,
        "docs_reused": plan_stats["docs_to_reuse"],
        "docs_failed": 0,
        "chunks_inserted": 0,
        "chunks_skipped": plan_stats["chunks_to_skip"],
        "chunks_failed": 0,
        "unresolved_docs": plan_stats["docs_unresolved"],
        "errors": [],
        "vectors_reused": True,
    }

    # Insert planned documents
    for doc_row in planned_docs:
        whack_id = doc_row["source_doc_id"]
        try:
            sb.table("documents").insert(doc_row).execute()
            stats["docs_inserted"] += 1
        except Exception as e:  # noqa: BLE001
            again = (
                sb.table("documents")
                .select("id")
                .eq("source_doc_id", whack_id)
                .limit(1)
                .execute()
            )
            if again.data:
                doc_uuid[whack_id] = again.data[0]["id"]
                # Fix pending chunk FKs that pointed at planned uuid
                old_id = doc_row["id"]
                new_id = again.data[0]["id"]
                for row in pending:
                    if row["document_id"] == old_id:
                        row["document_id"] = new_id
                stats["docs_reused"] += 1
            else:
                stats["docs_failed"] += 1
                stats["errors"].append({"document_id": whack_id, "reason": str(e)[:300]})

    print(
        f"Documents inserted={stats['docs_inserted']} reused={stats['docs_reused']} "
        f"failed={stats['docs_failed']} unresolved={stats['unresolved_docs']}",
        flush=True,
    )
    save_progress({"phase": "docs_done", "stats": stats, "doc_count": len(doc_uuid)})

    print(
        f"Chunks to insert={len(pending)} already_skipped={stats['chunks_skipped']}",
        flush=True,
    )

    for i in range(0, len(pending), CHUNK_BATCH):
        batch = pending[i : i + CHUNK_BATCH]
        try:
            sb.table("document_chunks").insert(batch).execute()
            stats["chunks_inserted"] += len(batch)
            for row in batch:
                existing_chunks.add(row["chunk_id"])
        except Exception as e:  # noqa: BLE001
            print(f"  batch fail at {i}: falling back per-row ({type(e).__name__})", flush=True)
            for row in batch:
                if row["chunk_id"] in existing_chunks:
                    stats["chunks_skipped"] += 1
                    continue
                try:
                    ex = (
                        sb.table("document_chunks")
                        .select("chunk_id")
                        .eq("chunk_id", row["chunk_id"])
                        .limit(1)
                        .execute()
                    )
                    if ex.data:
                        stats["chunks_skipped"] += 1
                        existing_chunks.add(row["chunk_id"])
                        continue
                    sb.table("document_chunks").insert(row).execute()
                    stats["chunks_inserted"] += 1
                    existing_chunks.add(row["chunk_id"])
                except Exception as e2:  # noqa: BLE001
                    stats["chunks_failed"] += 1
                    stats["errors"].append({"chunk_id": row["chunk_id"], "reason": str(e2)[:300]})
        done = stats["chunks_inserted"] + stats["chunks_skipped"]
        print(
            f"  progress inserted={stats['chunks_inserted']} skipped={stats['chunks_skipped']} "
            f"failed={stats['chunks_failed']} (~{done}/{len(rows)})",
            flush=True,
        )
        save_progress({"phase": "chunks", "stats": stats})
        time.sleep(0.15)

    save_progress({"phase": "done", "stats": stats})
    print("DONE", json.dumps({k: v for k, v in stats.items() if k != "errors"}), flush=True)
    print(f"errors={len(stats['errors'])}", flush=True)
    return 0 if stats["chunks_failed"] == 0 and stats["docs_failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
