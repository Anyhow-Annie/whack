#!/usr/bin/env python3
"""
C1 document ingest → live Supabase tables (beginner-friendly)
=============================================================

What this script does:
  1. Loads WHACK documents from documents.jsonl (preferred) OR walks Markdown.
  2. Classifies corpus department/access_level per Person B confirmed contract
     (see mapping_table.md). Ambiguous docs are flagged — never invented.
  3. Splits text into ~800-character chunks with 100-character overlap.
  4. Default = dry-run (no Gemini, no Supabase writes).
  5. --upload embeds + inserts via SERVICE_ROLE (prefer supabase_upload_run.py
     to reuse existing vectors).

Live SoT (do not redesign):
  - Position (craft title) → profiles.department; chunk metadata.position
  - Permission → profiles.role ∈ {admin, member, project_lead}
  - position_role_map.position → position_role_map.system_role (permission)
  - Chunk system_role = legacy Manager/Member only — never map to permission
  - Corpus department = position title OR General (org/season general)
  - Corpus access_level = position title (restricted) OR All employees (general)

Does NOT:
  - Change RLS / DDL / profiles / project_members
  - Invent General merely because position is missing (flag ambiguous)
  - Treat owner_employee_id as ACL / put permission on chunk metadata

Usage:
  python3 ingest_documents.py
  python3 ingest_documents.py --limit 3
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Optional

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

HERE = Path(__file__).resolve().parent
DOCS_ROOT = HERE.parent  # .../docs
DEFAULT_JSONL = DOCS_ROOT / "loader_output" / "documents.jsonl"
DEFAULT_DATASET = (DOCS_ROOT / ".." / "internal" / "dataset" / "WHACK_Organizational_Memory").resolve()

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
EMBED_DIMS = 768
# Prefer gemini-embedding-001; text-embedding-004 also accepted via --embed-model
DEFAULT_EMBED_MODEL = "gemini-embedding-001"

POSITION_TITLES = frozenset(
    {
        "Director",
        "Production Manager",
        "Stage Manager",
        "Actor",
        "Costume Designer",
        "Set & Prop Designer",
        "Light Designer",
        "Sound Designer",
        "Publicity",
        "Dramaturg",
    }
)
# Confirmed Person B corpus enums (backward-compatible required columns)
CORPUS_DEPARTMENTS = frozenset({"General"}) | POSITION_TITLES
CORPUS_ACCESS_LEVELS = frozenset({"All employees"}) | POSITION_TITLES
DEPARTMENTS = CORPUS_DEPARTMENTS
ACCESS_LEVELS = CORPUS_ACCESS_LEVELS

# Confirmed live position_role_map (permission seeding only — not chunk ACL)
POSITION_ROLE_MAP = {
    "Director": "admin",
    "Production Manager": "project_lead",
    "Stage Manager": "project_lead",
    "Actor": "member",
    "Costume Designer": "member",
    "Set & Prop Designer": "member",
    "Light Designer": "member",
    "Sound Designer": "member",
    "Publicity": "member",
    "Dramaturg": "member",
}
PERMISSION_ROLES = frozenset({"admin", "member", "project_lead"})
LEGACY_CHUNK_SYSTEM_ROLES = frozenset({"Manager", "Member", ""})

# Org-wide institutional docs (level=organization) → General / All employees
ORG_GENERAL = {
    "ORG-001": "org_profile",
    "ORG-002": "employee_directory",
    "ORG-003": "donors_vendors",
    "ORG-004": "approval_workflow",
    "ORG-005": "institutional_lessons",
    "ORG-006": "data_dictionary",
}
SEASON_GENERAL = {
    "Event Brief": "event_brief",
    "Previous Season Proposal and Lessons": "previous_season_lessons",
    "Kickoff and Design Meeting Notes": "meeting_notes",
    "Project Status Report": "status_report",
    "Season Approval and Change Log": "change_log",
    "Season Employee Roster and Contacts": "season_roster",
}
POSITION_SUBCATEGORY = {
    "Production Manager": "employee_pm",
    "Stage Manager": "employee_sm",
    "Director": "employee_director",
    "Actor": "employee_actor",
    "Costume Designer": "employee_costume",
    "Set & Prop Designer": "employee_set_prop",
    "Light Designer": "employee_light",
    "Sound Designer": "employee_sound",
    "Publicity": "publicity",
    "Dramaturg": "employee_dramaturg",
}

HELPER_NAMES = frozenset({"README_START_HERE.md", "MASTER_INDEX.md"})
DOC_ID_RE = re.compile(r"^\s*[-*]?\s*\*\*Document ID:\*\*\s*(.+?)\s*$", re.IGNORECASE | re.MULTILINE)
TITLE_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)


# ---------------------------------------------------------------------------
# Person B corpus classification (see mapping_table.md)
# ---------------------------------------------------------------------------


@dataclass
class AccessMapping:
    department: str
    access_level: str
    subcategory: str
    status: str = "resolved"  # resolved | ambiguous
    reason: str = ""


def _infer_position_from_blob(dtype: str, path: str, title: str, position: str = "") -> str:
    pos = (position or "").strip()
    if pos in POSITION_TITLES:
        return pos
    blob = f"{(dtype or '').lower()} {(path or '').lower()} {(title or '').lower()}"
    # Prefer longer / more specific titles first
    ordered = sorted(POSITION_TITLES, key=len, reverse=True)
    for title_pos in ordered:
        key = title_pos.lower().replace("&", "").replace("  ", " ")
        if title_pos.lower() in blob or key in blob:
            return title_pos
        # slug forms
        slug = title_pos.lower().replace(" & ", "_").replace(" ", "_")
        if slug in blob.replace("-", "_"):
            return title_pos
    # Keyword fallbacks
    rules = [
        (("production plan", "production management", "strike closeout", "weekly production"), "Production Manager"),
        (("rehearsal report and prompt", "rehearsal technical", "sm handoff", "stage manager"), "Stage Manager"),
        (("character research", "rehearsal journal", "character handoff"), "Actor"),
        (("set prop", "set & prop", "set_prop"), "Set & Prop Designer"),
        (("costume",), "Costume Designer"),
        (("light designer",), "Light Designer"),
        (("sound designer",), "Sound Designer"),
        (("dramaturg",), "Dramaturg"),
        (("publicity",), "Publicity"),
        (("director",), "Director"),
        (("actor",), "Actor"),
    ]
    for keys, p in rules:
        if any(k in blob for k in keys):
            return p
    return ""


def classify_corpus(
    *,
    document_id: str = "",
    document_type: str = "",
    path: str = "",
    title: str = "",
    level: str = "",
    position: str = "",
    organizational_role: str = "",
) -> AccessMapping:
    """Classify required corpus department/access_level from source metadata.

    Rules (Person B confirmed):
      - Position-specific knowledge → department=position, access_level=position
      - Org-wide / season-wide general → department=General, access_level=All employees
      - Do not invent General merely because position is missing → ambiguous
    Permission (admin/member/project_lead) is never written here.
    """
    did = (document_id or "").strip()
    dtype = document_type or ""
    path_l = (path or "").lower()
    level_l = (level or "").strip().lower()
    pos = (position or "").strip() or (organizational_role or "").strip()
    if pos and pos not in POSITION_TITLES:
        return AccessMapping(
            "",
            "",
            "",
            status="ambiguous",
            reason=f"unknown position value {pos!r}",
        )
    if not pos:
        pos = _infer_position_from_blob(dtype, path, title, "")

    # --- organization-level institutional (explicit general, not "missing position") ---
    if did in ORG_GENERAL or dtype in {
        "Organization Profile",
        "Employee Directory",
        "Donors and Vendors",
        "Sponsorship and Purchase Approval Workflow",
        "Four Season Institutional Lessons",
        "Data Dictionary and Relationships",
    }:
        sub = ORG_GENERAL.get(did) or {
            "Organization Profile": "org_profile",
            "Employee Directory": "employee_directory",
            "Donors and Vendors": "donors_vendors",
            "Sponsorship and Purchase Approval Workflow": "approval_workflow",
            "Four Season Institutional Lessons": "institutional_lessons",
            "Data Dictionary and Relationships": "data_dictionary",
        }.get(dtype, "org_general")
        return AccessMapping(
            "General",
            "All employees",
            sub,
            reason="organization-level institutional / org-wide general",
        )

    # --- season-wide general production docs ---
    if dtype in SEASON_GENERAL or path_l.endswith("_season_employee_roster_and_contacts.md"):
        sub = SEASON_GENERAL.get(dtype, "season_roster")
        return AccessMapping(
            "General",
            "All employees",
            sub,
            reason="season-wide / general production document",
        )

    if level_l == "organization":
        return AccessMapping(
            "General",
            "All employees",
            "org_general",
            reason="level=organization general institutional",
        )

    # --- position-specific knowledge ---
    if pos in POSITION_TITLES:
        sub = POSITION_SUBCATEGORY.get(pos, "employee_position")
        return AccessMapping(
            pos,
            pos,
            sub,
            reason="position-specific knowledge from source position/metadata",
        )

    if level_l == "season":
        # Season docs without a matching general type and without position
        return AccessMapping(
            "",
            "",
            "",
            status="ambiguous",
            reason="season-level doc without general-type match and without position",
        )

    if level_l == "employee":
        return AccessMapping(
            "",
            "",
            "",
            status="ambiguous",
            reason="employee-level doc missing usable position",
        )

    return AccessMapping(
        "",
        "",
        "",
        status="ambiguous",
        reason="could not classify from level/document_type/position",
    )


def map_access(
    document_id: str,
    document_type: str,
    path: str,
    title: str = "",
    *,
    level: str = "",
    position: str = "",
    organizational_role: str = "",
) -> Optional[AccessMapping]:
    """Return resolved Person B corpus mapping or None if ambiguous."""
    m = classify_corpus(
        document_id=document_id,
        document_type=document_type,
        path=path,
        title=title,
        level=level,
        position=position,
        organizational_role=organizational_role,
    )
    if m.status != "resolved" or not m.department or not m.access_level:
        return None
    return m


def assert_mapping_enums(m: AccessMapping) -> None:
    if m.status != "resolved":
        raise ValueError(f"mapping not resolved: {m.reason}")
    if m.department not in CORPUS_DEPARTMENTS:
        raise ValueError(f"department not in Person B corpus enums: {m.department}")
    if m.access_level not in CORPUS_ACCESS_LEVELS:
        raise ValueError(f"access_level not in Person B corpus enums: {m.access_level}")
    # Consistency: position-restricted rows use the same title in both fields
    if m.department in POSITION_TITLES and m.access_level != m.department:
        raise ValueError(
            f"position-restricted mismatch department={m.department!r} access_level={m.access_level!r}"
        )
    if m.department == "General" and m.access_level != "All employees":
        raise ValueError(
            f"General department requires access_level=All employees, got {m.access_level!r}"
        )
    if m.access_level in PERMISSION_ROLES or m.department in PERMISSION_ROLES:
        raise ValueError("permission roles must not appear in corpus department/access_level")


def assert_chunk_role_fields(position: str = "", organizational_role: str = "", system_role: str = "") -> None:
    """Guardrails for craft vs permission vs legacy tier labels."""
    pos = (position or "").strip()
    org = (organizational_role or "").strip()
    sys = (system_role or "").strip()
    if pos and org and pos != org:
        raise ValueError(f"position/organizational_role disagree: {pos!r} vs {org!r}")
    if pos and pos not in POSITION_TITLES:
        raise ValueError(f"unknown position title: {pos}")
    if org and org not in POSITION_TITLES:
        raise ValueError(f"unknown organizational_role: {org}")
    if pos and pos in PERMISSION_ROLES:
        raise ValueError("permission role must not appear in position")
    if sys and sys not in LEGACY_CHUNK_SYSTEM_ROLES:
        if sys in PERMISSION_ROLES:
            raise ValueError(
                f"chunk system_role must stay legacy Manager/Member; not permission {sys!r}"
            )
        raise ValueError(f"unexpected chunk system_role: {sys}")


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------


def load_from_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            rows.append(
                {
                    "document_id": obj.get("document_id") or "",
                    "title": obj.get("title") or "",
                    "content": obj.get("body") or "",
                    "document_type": obj.get("document_type") or "",
                    "path": obj.get("path") or "",
                    "source": "documents.jsonl",
                }
            )
    return rows


def load_from_dataset(dataset: Path) -> list[dict[str, Any]]:
    """Fallback: walk Markdown under the WHACK dataset folder."""
    rows: list[dict[str, Any]] = []
    if not dataset.is_dir():
        raise FileNotFoundError(f"Dataset not found: {dataset}")
    for md in sorted(dataset.rglob("*.md")):
        if md.name in HELPER_NAMES:
            continue
        text = md.read_text(encoding="utf-8", errors="replace")
        m = DOC_ID_RE.search(text)
        if not m:
            continue  # skip helpers / non-indexed files
        doc_id = m.group(1).strip()
        t = TITLE_RE.search(text)
        title = t.group(1).strip() if t else md.stem
        rel = str(md.relative_to(dataset))
        # document_type: best-effort from filename (not invented beyond filename tokens)
        document_type = md.stem.replace("_", " ")
        rows.append(
            {
                "document_id": doc_id,
                "title": title,
                "content": text,
                "document_type": document_type,
                "path": rel,
                "source": "markdown",
            }
        )
    return rows


# ---------------------------------------------------------------------------
# Chunking (~800 chars, 100 overlap)
# ---------------------------------------------------------------------------


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping character windows. Beginner note: this is
    character-based (not token-based) to match the Person B C1 brief."""
    text = text or ""
    if not text.strip():
        return []
    if size <= 0:
        raise ValueError("chunk size must be positive")
    if overlap < 0 or overlap >= size:
        raise ValueError("overlap must be >= 0 and < size")

    chunks: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + size, n)
        piece = text[start:end]
        if piece.strip():
            chunks.append(piece)
        if end >= n:
            break
        start = end - overlap
    return chunks


# ---------------------------------------------------------------------------
# Embeddings (768) + L2 normalize
# ---------------------------------------------------------------------------


def l2_normalize(vec: list[float]) -> list[float]:
    """Gemini dims < 3072 should be L2-normalized for cosine-style search."""
    s = math.sqrt(sum(x * x for x in vec))
    if s == 0:
        return vec
    return [x / s for x in vec]


def embed_texts(
    texts: list[str],
    *,
    api_key: str,
    model: str,
    task_type: str,
) -> list[list[float]]:
    """Call Gemini embeddings with output_dimensionality=768."""
    try:
        from google import genai
        from google.genai import types
    except ImportError as e:
        raise SystemExit(
            "Missing google-genai. Install with: pip install -r requirements.txt"
        ) from e

    client = genai.Client(api_key=api_key)
    out: list[list[float]] = []
    # Small batches keep requests simple for beginners / rate limits
    batch_size = 16
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        resp = client.models.embed_content(
            model=model,
            contents=batch,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=EMBED_DIMS,
            ),
        )
        embeddings = getattr(resp, "embeddings", None) or []
        if len(embeddings) != len(batch):
            # Some SDK versions return a single embedding for one content
            if len(batch) == 1 and getattr(resp, "embedding", None) is not None:
                values = list(resp.embedding.values)
                if len(values) != EMBED_DIMS:
                    raise RuntimeError(f"expected {EMBED_DIMS} dims, got {len(values)}")
                out.append(l2_normalize(values))
                continue
            raise RuntimeError(
                f"embed_content returned {len(embeddings)} vectors for {len(batch)} texts"
            )
        for emb in embeddings:
            values = list(emb.values)
            if len(values) != EMBED_DIMS:
                raise RuntimeError(f"expected {EMBED_DIMS} dims, got {len(values)}")
            out.append(l2_normalize(values))
    return out


# ---------------------------------------------------------------------------
# Supabase upload (service role — ingest only)
# ---------------------------------------------------------------------------


def supabase_service_client(url: str, service_key: str):
    try:
        from supabase import create_client
    except ImportError as e:
        raise SystemExit(
            "Missing supabase. Install with: pip install -r requirements.txt"
        ) from e
    return create_client(url, service_key)


def upload_document(
    sb: Any,
    *,
    title: str,
    content: str,
    mapping: AccessMapping,
    chunk_rows: list[dict[str, Any]],
) -> str:
    """Insert parent documents row, then document_chunks. Returns document UUID."""
    doc_id = str(uuid.uuid4())
    doc_row = {
        "id": doc_id,
        "title": title,
        "content": content,
        "department": mapping.department,
        "access_level": mapping.access_level,
        "subcategory": mapping.subcategory,
    }
    ins = sb.table("documents").insert(doc_row).execute()
    if getattr(ins, "data", None) is None and getattr(ins, "error", None):
        raise RuntimeError(f"documents insert failed: {ins.error}")

    # Attach document_id + copy access fields onto each chunk
    payload = []
    for ch in chunk_rows:
        payload.append(
            {
                "id": str(uuid.uuid4()),
                "document_id": doc_id,
                "chunk_index": ch["chunk_index"],
                "content": ch["content"],
                "embedding": ch["embedding"],
                "department": mapping.department,
                "access_level": mapping.access_level,
                "subcategory": mapping.subcategory,
            }
        )
    # Insert in batches
    for i in range(0, len(payload), 50):
        batch = payload[i : i + 50]
        cres = sb.table("document_chunks").insert(batch).execute()
        if getattr(cres, "data", None) is None and getattr(cres, "error", None):
            raise RuntimeError(f"document_chunks insert failed: {cres.error}")
    return doc_id


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def require_upload_env() -> tuple[str, str, str]:
    gemini = os.environ.get("GEMINI_API_KEY", "").strip()
    url = os.environ.get("SUPABASE_URL", "").strip()
    service = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    missing = [
        name
        for name, val in [
            ("GEMINI_API_KEY", gemini),
            ("SUPABASE_URL", url),
            ("SUPABASE_SERVICE_ROLE_KEY", service),
        ]
        if not val
    ]
    if missing:
        raise SystemExit(
            "Refusing --upload: missing env "
            + ", ".join(missing)
            + ". Copy .env.example → .env and fill placeholders (never commit secrets)."
        )
    return gemini, url, service


def main(argv: Optional[list[str]] = None) -> int:
    # Optional: load .env if python-dotenv is installed
    try:
        from dotenv import load_dotenv

        load_dotenv(HERE / ".env")
    except ImportError:
        pass

    p = argparse.ArgumentParser(description="C1 WHACK → documents/document_chunks ingest")
    p.add_argument(
        "--jsonl",
        type=Path,
        default=DEFAULT_JSONL,
        help="Path to loader documents.jsonl (default: ../loader_output/documents.jsonl)",
    )
    p.add_argument(
        "--dataset",
        type=Path,
        default=None,
        help="Optional WHACK Markdown root (used if --jsonl missing, or with --from-markdown)",
    )
    p.add_argument(
        "--from-markdown",
        action="store_true",
        help="Force reading Markdown from --dataset instead of jsonl",
    )
    p.add_argument("--limit", type=int, default=0, help="Only process first N docs (0 = all)")
    p.add_argument(
        "--upload",
        action="store_true",
        help="Embed + insert into Supabase (requires env keys). Prefer supabase_upload_run.py to reuse vectors.",
    )
    p.add_argument(
        "--embed-model",
        default=DEFAULT_EMBED_MODEL,
        help="gemini-embedding-001 (default) or text-embedding-004",
    )
    p.add_argument(
        "--report",
        type=Path,
        default=HERE / "dry_run_report.json",
        help="Where to write dry-run / upload summary JSON",
    )
    args = p.parse_args(argv)

    upload_creds: Optional[tuple[str, str, str]] = None
    if args.upload:
        upload_creds = require_upload_env()

    # Load source docs
    if args.from_markdown or not args.jsonl.is_file():
        dataset = args.dataset or DEFAULT_DATASET
        print(f"Loading Markdown from {dataset}")
        docs = load_from_dataset(dataset)
    else:
        print(f"Loading JSONL from {args.jsonl}")
        docs = load_from_jsonl(args.jsonl)

    if args.limit and args.limit > 0:
        docs = docs[: args.limit]

    prepared: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []
    total_chunks = 0

    for doc in docs:
        mapping = map_access(
            doc["document_id"],
            doc["document_type"],
            doc["path"],
            doc.get("title") or "",
            level=str(doc.get("level") or ""),
            position=str(doc.get("position") or ""),
            organizational_role=str(doc.get("organizational_role") or ""),
        )
        if mapping is None:
            amb = classify_corpus(
                document_id=doc["document_id"],
                document_type=doc["document_type"],
                path=doc["path"],
                title=doc.get("title") or "",
                level=str(doc.get("level") or ""),
                position=str(doc.get("position") or ""),
                organizational_role=str(doc.get("organizational_role") or ""),
            )
            unresolved.append(
                {
                    "document_id": doc["document_id"],
                    "document_type": doc["document_type"],
                    "path": doc["path"],
                    "reason": amb.reason or "ambiguous department/access_level",
                }
            )
            continue
        assert_mapping_enums(mapping)
        chunks = chunk_text(doc["content"], CHUNK_SIZE, CHUNK_OVERLAP)
        total_chunks += len(chunks)
        prepared.append(
            {
                "whack_document_id": doc["document_id"],
                "title": doc["title"] or doc["document_id"],
                "content": doc["content"],
                "document_type": doc["document_type"],
                "path": doc["path"],
                "mapping": asdict(mapping),
                "chunk_count": len(chunks),
                "chunk_previews": [
                    {"chunk_index": i, "chars": len(c), "preview": c[:120].replace("\n", " ")}
                    for i, c in enumerate(chunks[:3])
                ],
                "_chunks": chunks,  # kept for upload; stripped in report
            }
        )

    mode = "upload" if args.upload else "dry-run"
    print(f"\n=== C1 ingest ({mode}) ====")
    print(f"Source docs:     {len(docs)}")
    print(f"Mapped (ok):     {len(prepared)}")
    print(f"Unresolved:      {len(unresolved)}  (will NOT upload)")
    print(f"Chunk windows:   {total_chunks}  (~{CHUNK_SIZE} chars, overlap {CHUNK_OVERLAP})")
    print(f"Embedding dims:  {EMBED_DIMS}  (Person B document_chunks schema)")

    # Mapping histogram
    from collections import Counter

    dept_c = Counter(x["mapping"]["department"] for x in prepared)
    access_c = Counter(x["mapping"]["access_level"] for x in prepared)
    sub_c = Counter(x["mapping"]["subcategory"] for x in prepared)
    print("\nDepartments:", dict(dept_c))
    print("Access levels:", dict(access_c))
    print("Subcategories:", dict(sub_c))
    if unresolved:
        print("\nUnresolved examples (first 10):")
        for u in unresolved[:10]:
            print(f"  - {u['document_id']}: {u['document_type']} ({u['path']})")

    uploaded = 0
    if args.upload:
        assert upload_creds is not None
        gemini_key, supabase_url, service_key = upload_creds
        print("\nKeys present — embedding + inserting via SERVICE_ROLE…")
        sb = supabase_service_client(supabase_url, service_key)
        for item in prepared:
            chunks: list[str] = item["_chunks"]
            if not chunks:
                continue
            vectors = embed_texts(
                chunks,
                api_key=gemini_key,
                model=args.embed_model,
                task_type="RETRIEVAL_DOCUMENT",
            )
            chunk_rows = [
                {"chunk_index": i, "content": c, "embedding": vectors[i]}
                for i, c in enumerate(chunks)
            ]
            mapping = AccessMapping(**item["mapping"])
            new_id = upload_document(
                sb,
                title=item["title"],
                content=item["content"],
                mapping=mapping,
                chunk_rows=chunk_rows,
            )
            item["supabase_document_id"] = new_id
            uploaded += 1
            print(f"  uploaded {item['whack_document_id']} → {new_id} ({len(chunks)} chunks)")
        print(f"\nDone. Uploaded {uploaded} documents.")
    else:
        print("\nDry-run only. Re-run with --upload after filling .env (see .env.example).")

    # Write report without huge bodies
    report = {
        "mode": mode,
        "embed_dims": EMBED_DIMS,
        "chunk_size": CHUNK_SIZE,
        "chunk_overlap": CHUNK_OVERLAP,
        "source_docs": len(docs),
        "mapped": len(prepared),
        "unresolved_count": len(unresolved),
        "total_chunks": total_chunks,
        "uploaded": uploaded,
        "departments": dict(dept_c),
        "access_levels": dict(access_c),
        "subcategories": dict(sub_c),
        "unresolved": unresolved,
        "mapped_docs": [
            {k: v for k, v in item.items() if k != "_chunks" and k != "content"}
            | {"content_chars": len(item["content"])}
            for item in prepared
        ],
        "mapping_doc": str(HERE / "mapping_table.md"),
        "note": (
            "Person B corpus contract: department=position|General; "
            "access_level=position|All employees. Permission stays on profiles/"
            "position_role_map — never on chunk metadata."
        ),
    }
    args.report.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote report: {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
