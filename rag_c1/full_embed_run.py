#!/usr/bin/env python3
"""
Full embed of embed-eligible chunks.jsonl rows → chunks_with_embeddings.jsonl

Config (Person C approved):
  model=gemini-embedding-001
  output_dimensionality=768
  task=RETRIEVAL_DOCUMENT
  L2 normalize
  GEMINI_API_KEY from .env only (never print)

Does not modify chunks.jsonl. Does not upload to Supabase.
Supports resume via checkpoint + skipping rows that already have valid embeddings.
"""

from __future__ import annotations

import json
import math
import os
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

HERE = Path(__file__).resolve().parent
CHUNKS_PATH = HERE.parent / "chunker_output" / "chunks.jsonl"
ENV_PATH = HERE / ".env"
OUT_PATH = HERE / "chunks_with_embeddings.jsonl"
CKPT_PATH = HERE / "full_embedding_checkpoint.json"
FAIL_PATH = HERE / "full_embedding_failures.jsonl"
REPORT_PATH = HERE / "full_embedding_validation_report.md"

MODEL = "gemini-embedding-001"
EMBED_DIMS = 768
TASK = "RETRIEVAL_DOCUMENT"
BATCH_SIZE = 4  # smaller batches to stay under free-tier embed TPM
MAX_RETRIES = 6
BASE_BACKOFF_SEC = 2.0
BATCH_PAUSE_SEC = 1.5  # gentle pacing between batches


def load_api_key() -> str:
    if not ENV_PATH.is_file():
        raise SystemExit("STOP: .env missing")
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() == "GEMINI_API_KEY":
            key = v.strip().strip('"').strip("'")
            if key:
                return key
    raise SystemExit("STOP: GEMINI_API_KEY missing or empty in .env")


def l2_normalize(vec: list[float]) -> tuple[list[float], float, float]:
    pre = math.sqrt(sum(x * x for x in vec))
    if pre == 0:
        return vec, pre, 0.0
    out = [x / pre for x in vec]
    post = math.sqrt(sum(x * x for x in out))
    return out, pre, post


def embed_input_text(row: dict[str, Any]) -> str:
    et = (row.get("embedding_text") or "").strip()
    if et:
        return row["embedding_text"]  # complete field, not stripped of internal whitespace intent
    ct = (row.get("chunk_text") or "").strip()
    if ct:
        return row["chunk_text"]
    return ""


def is_valid_embedding(emb: Any) -> bool:
    if not isinstance(emb, list) or len(emb) != EMBED_DIMS:
        return False
    if not all(isinstance(x, (int, float)) and math.isfinite(float(x)) for x in emb):
        return False
    n = math.sqrt(sum(float(x) * float(x) for x in emb))
    return abs(n - 1.0) < 1e-3  # allow tiny float drift


def load_checkpoint() -> dict[str, Any]:
    if CKPT_PATH.is_file():
        return json.loads(CKPT_PATH.read_text(encoding="utf-8"))
    return {
        "completed_ids": [],
        "failed": [],  # {chunk_id, reason, attempts}
        "oversized_or_truncated": [],
        "updated_at": None,
        "model": MODEL,
        "dims": EMBED_DIMS,
    }


def save_checkpoint(ckpt: dict[str, Any]) -> None:
    ckpt["updated_at"] = datetime.now(timezone.utc).isoformat()
    atomic_write_text(CKPT_PATH, json.dumps(ckpt, indent=2))


def load_existing_out() -> dict[str, dict[str, Any]]:
    """chunk_id → full output row for resume."""
    by_id: dict[str, dict[str, Any]] = {}
    if not OUT_PATH.is_file():
        return by_id
    with OUT_PATH.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            cid = obj.get("chunk_id")
            if cid and is_valid_embedding(obj.get("embedding")):
                by_id[cid] = obj
    return by_id


def _retry_delay_seconds(exc: Exception, attempt: int) -> float:
    """Prefer API-suggested RetryInfo delay for 429; else exponential backoff."""
    import re

    msg = str(exc)
    m = re.search(r"retry in ([0-9]+(?:\.[0-9]+)?)s", msg, re.I)
    if m:
        return max(float(m.group(1)) + 1.0, BASE_BACKOFF_SEC)
    m2 = re.search(r"'retryDelay':\s*'(\d+)s'", msg)
    if m2:
        return max(float(m2.group(1)) + 1.0, BASE_BACKOFF_SEC)
    if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
        return max(15.0, BASE_BACKOFF_SEC * (2 ** (attempt - 1)))
    return BASE_BACKOFF_SEC * (2 ** (attempt - 1))


def atomic_write_text(path: Path, text: str, attempts: int = 8) -> None:
    """Write with retries — agent-store mounts can raise BlockingIOError briefly."""
    tmp = path.with_suffix(path.suffix + ".tmp")
    last: Optional[Exception] = None
    for i in range(attempts):
        try:
            tmp.write_text(text, encoding="utf-8")
            tmp.replace(path)
            return
        except OSError as e:
            last = e
            time.sleep(0.25 * (i + 1))
    assert last is not None
    raise last


def call_embed_batch(client: Any, texts: list[str], types_mod: Any) -> list[list[float]]:
    """Returns raw (pre-normalize) vectors; raises on failure."""
    resp = client.models.embed_content(
        model=MODEL,
        contents=texts,
        config=types_mod.EmbedContentConfig(
            task_type=TASK,
            output_dimensionality=EMBED_DIMS,
        ),
    )
    embeddings = getattr(resp, "embeddings", None)
    if embeddings and len(embeddings) == len(texts):
        return [list(e.values) for e in embeddings]
    # Single-content fallback shape
    if len(texts) == 1 and getattr(resp, "embedding", None) is not None:
        return [list(resp.embedding.values)]
    raise RuntimeError(
        f"unexpected embed response size: got {0 if not embeddings else len(embeddings)} for {len(texts)}"
    )


def embed_with_retries(
    client: Any,
    types_mod: Any,
    texts: list[str],
    chunk_ids: list[str],
) -> tuple[list[Optional[list[float]]], list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Returns (vectors_or_None, failures, oversized_notes).
    On persistent batch failure, falls back to per-item calls so one bad row
    does not wipe the batch silently.
    """
    failures: list[dict[str, Any]] = []
    oversized: list[dict[str, Any]] = []

    def try_batch(ts: list[str]) -> list[list[float]]:
        last_err: Optional[Exception] = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                return call_embed_batch(client, ts, types_mod)
            except Exception as e:  # noqa: BLE001
                last_err = e
                msg = str(e).lower()
                # Hard size errors (not quota): stop early
                if (
                    any(s in msg for s in ("too long", "too large", "invalid argument", "payload"))
                    and "429" not in msg
                    and "resource_exhausted" not in msg
                    and attempt >= 2
                ):
                    break
                sleep = _retry_delay_seconds(e, attempt)
                print(f"  retry {attempt}/{MAX_RETRIES} after error; sleep {sleep:.1f}s", flush=True)
                time.sleep(sleep)
        assert last_err is not None
        raise last_err

    try:
        raw = try_batch(texts)
        # Truncation signal: wrong dim before our normalize
        out: list[Optional[list[float]]] = []
        for cid, vec in zip(chunk_ids, raw):
            if len(vec) != EMBED_DIMS:
                oversized.append(
                    {
                        "chunk_id": cid,
                        "reason": f"unexpected_dim_{len(vec)}",
                        "input_chars": len(texts[chunk_ids.index(cid)]),
                    }
                )
                failures.append(
                    {
                        "chunk_id": cid,
                        "reason": f"dim_mismatch_{len(vec)}",
                        "attempts": MAX_RETRIES,
                    }
                )
                out.append(None)
            else:
                out.append(vec)
        return out, failures, oversized
    except Exception as batch_err:  # noqa: BLE001
        print(f"  batch failed ({batch_err}); falling back per-item", flush=True)
        out2: list[Optional[list[float]]] = []
        for cid, text in zip(chunk_ids, texts):
            try:
                raw1 = try_batch([text])[0]
                if len(raw1) != EMBED_DIMS:
                    oversized.append(
                        {
                            "chunk_id": cid,
                            "reason": f"unexpected_dim_{len(raw1)}",
                            "input_chars": len(text),
                        }
                    )
                    failures.append(
                        {
                            "chunk_id": cid,
                            "reason": f"dim_mismatch_{len(raw1)}",
                            "attempts": MAX_RETRIES,
                        }
                    )
                    out2.append(None)
                else:
                    out2.append(raw1)
            except Exception as e:  # noqa: BLE001
                reason = str(e)
                low = reason.lower()
                if any(s in low for s in ("token", "too long", "too large", "length")):
                    oversized.append(
                        {"chunk_id": cid, "reason": reason[:300], "input_chars": len(text)}
                    )
                failures.append(
                    {"chunk_id": cid, "reason": reason[:500], "attempts": MAX_RETRIES}
                )
                out2.append(None)
                print(f"  FAIL {cid}: recorded", flush=True)
        return out2, failures, oversized


def preflight(eligible: list[dict[str, Any]], total: int) -> None:
    # Pilot must have passed
    pilot = HERE / "embedding_pilot.jsonl"
    pilot_report = HERE / "embedding_pilot_report.md"
    if not pilot.is_file() or not pilot_report.is_file():
        raise SystemExit("PREFLIGHT FAIL: pilot artifacts missing")
    prows = [json.loads(l) for l in pilot.open() if l.strip()]
    if len(prows) != 5:
        raise SystemExit("PREFLIGHT FAIL: pilot line count != 5")
    for r in prows:
        if not is_valid_embedding(r.get("embedding")):
            raise SystemExit("PREFLIGHT FAIL: pilot embedding invalid")
    if "PASS" not in pilot_report.read_text(encoding="utf-8"):
        raise SystemExit("PREFLIGHT FAIL: pilot report not PASS")
    excluded = total - len(eligible)
    print(
        f"PREFLIGHT PASS | total={total} eligible={len(eligible)} excluded={excluded}",
        flush=True,
    )
    empty = [
        r["chunk_id"]
        for r in eligible
        if not embed_input_text(r)
    ]
    if empty:
        raise SystemExit(f"PREFLIGHT FAIL: {len(empty)} eligible rows lack embed text")


def main() -> int:
    api_key = load_api_key()
    rows = [json.loads(l) for l in CHUNKS_PATH.open(encoding="utf-8") if l.strip()]
    eligible = [r for r in rows if r.get("include_in_embedding") is True]
    excluded_rows = [r for r in rows if r.get("include_in_embedding") is not True]
    preflight(eligible, len(rows))

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    del api_key  # avoid accidental logging

    existing = load_existing_out()
    ckpt = load_checkpoint()
    completed = set(ckpt.get("completed_ids") or []) | set(existing.keys())
    failed_map = {f["chunk_id"]: f for f in (ckpt.get("failed") or []) if "chunk_id" in f}
    oversized_list = list(ckpt.get("oversized_or_truncated") or [])

    # Build work list
    todo: list[dict[str, Any]] = []
    skipped_valid = 0
    for r in eligible:
        cid = r["chunk_id"]
        if cid in existing and is_valid_embedding(existing[cid].get("embedding")):
            skipped_valid += 1
            completed.add(cid)
            continue
        todo.append(r)

    print(
        f"Resume: already_valid={skipped_valid} todo={len(todo)} failed_prior={len(failed_map)}",
        flush=True,
    )

    # Merge existing valid into running output dict
    out_by_id: dict[str, dict[str, Any]] = dict(existing)

    started = time.time()
    newly_ok = 0
    newly_fail = 0

    for i in range(0, len(todo), BATCH_SIZE):
        batch = todo[i : i + BATCH_SIZE]
        texts: list[str] = []
        ids: list[str] = []
        for r in batch:
            t = embed_input_text(r)
            if not t:
                failed_map[r["chunk_id"]] = {
                    "chunk_id": r["chunk_id"],
                    "reason": "empty_embed_input",
                    "attempts": 0,
                }
                newly_fail += 1
                print(f"  FAIL {r['chunk_id']}: empty_embed_input", flush=True)
                continue
            texts.append(t)
            ids.append(r["chunk_id"])

        if not texts:
            continue

        done_so_far = skipped_valid + newly_ok
        print(
            f"[{done_so_far}/{len(eligible)}] embedding batch {i // BATCH_SIZE + 1} "
            f"size={len(texts)} …",
            flush=True,
        )

        vectors, fails, oversized = embed_with_retries(client, types, texts, ids)
        for f in fails:
            failed_map[f["chunk_id"]] = f
            newly_fail += 1
        for o in oversized:
            # de-dupe by chunk_id
            oversized_list = [x for x in oversized_list if x.get("chunk_id") != o["chunk_id"]]
            oversized_list.append(o)

        id_to_row = {r["chunk_id"]: r for r in batch}
        for cid, raw in zip(ids, vectors):
            if raw is None:
                continue
            normed, pre, post = l2_normalize(raw)
            if not is_valid_embedding(normed):
                failed_map[cid] = {
                    "chunk_id": cid,
                    "reason": f"post_validate_failed pre={pre:.6f} post={post:.6f}",
                    "attempts": MAX_RETRIES,
                }
                newly_fail += 1
                print(f"  FAIL {cid}: post_validate", flush=True)
                continue
            src = id_to_row[cid]
            out_row = dict(src)  # preserve all original fields
            out_row.update(
                {
                    "embedding": normed,
                    "embed_model": MODEL,
                    "embed_task_type": TASK,
                    "embed_dims": EMBED_DIMS,
                    "embedding_pre_l2_norm": pre,
                    "embedding_post_l2_norm": post,
                    "embed_input_field": (
                        "embedding_text"
                        if (src.get("embedding_text") or "").strip()
                        else "chunk_text"
                    ),
                    "embed_input_chars": len(embed_input_text(src)),
                    "embedded_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            out_by_id[cid] = out_row
            completed.add(cid)
            failed_map.pop(cid, None)
            newly_ok += 1

        # Persist after each batch (resume-safe)
        lines = []
        for r in eligible:
            cid = r["chunk_id"]
            if cid in out_by_id:
                lines.append(json.dumps(out_by_id[cid], ensure_ascii=False))
        atomic_write_text(OUT_PATH, "\n".join(lines) + ("\n" if lines else ""))

        ckpt = {
            "completed_ids": sorted(completed),
            "failed": list(failed_map.values()),
            "oversized_or_truncated": oversized_list,
            "newly_ok": newly_ok,
            "newly_fail": newly_fail,
            "skipped_valid": skipped_valid,
            "eligible_total": len(eligible),
            "excluded_total": len(excluded_rows),
            "model": MODEL,
            "dims": EMBED_DIMS,
        }
        save_checkpoint(ckpt)

        fail_lines = [json.dumps(fobj, ensure_ascii=False) for fobj in failed_map.values()]
        atomic_write_text(FAIL_PATH, "\n".join(fail_lines) + ("\n" if fail_lines else ""))

        elapsed = time.time() - started
        rate = newly_ok / elapsed if elapsed > 0 else 0
        print(
            f"  progress ok={len(out_by_id)}/{len(eligible)} "
            f"new_ok={newly_ok} new_fail={newly_fail} ({rate:.1f}/s)",
            flush=True,
        )
        time.sleep(BATCH_PAUSE_SEC)

    # --- Validation report ---
    success_ids = [r["chunk_id"] for r in eligible if r["chunk_id"] in out_by_id]
    fail_ids = sorted(failed_map.keys())
    missing = [
        r["chunk_id"]
        for r in eligible
        if r["chunk_id"] not in out_by_id and r["chunk_id"] not in failed_map
    ]

    # Validate every written row
    dim_fail = []
    finite_fail = []
    l2_fail = []
    for cid in success_ids:
        emb = out_by_id[cid]["embedding"]
        if len(emb) != EMBED_DIMS:
            dim_fail.append(cid)
        if not all(math.isfinite(x) for x in emb):
            finite_fail.append(cid)
        n = math.sqrt(sum(x * x for x in emb))
        if abs(n - 1.0) >= 1e-3:
            l2_fail.append(cid)

    # Secret leak scan on output (patterns only)
    import re

    sample = ""
    with OUT_PATH.open(encoding="utf-8") as f:
        for i, line in enumerate(f):
            if i >= 3:
                break
            # strip embedding arrays for scan of metadata portion
            try:
                obj = json.loads(line)
                obj.pop("embedding", None)
                sample += json.dumps(obj)
            except Exception:  # noqa: BLE001
                pass
    leak = bool(re.search(r"AIza[0-9A-Za-z_-]{20,}", sample))

    overall = (
        len(success_ids) == len(eligible)
        and not fail_ids
        and not missing
        and not dim_fail
        and not finite_fail
        and not l2_fail
        and not leak
    )

    report = f"""# Full embedding validation report

**Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}  
**Model:** `{MODEL}` · dims={EMBED_DIMS} · task=`{TASK}` · L2-normalized  
**Source:** `{CHUNKS_PATH}` (`include_in_embedding==true` only)  
**Output:** `{OUT_PATH}`  
**Checkpoint:** `{CKPT_PATH}`  
**Failures file:** `{FAIL_PATH}`  
**Supabase upload:** no  
**chunks.jsonl:** unchanged  

## Preflight

| Check | Result |
| --- | --- |
| Pilot PASS (5×768, L2≈1) | PASS |
| GEMINI_API_KEY present in `.env` | PASS (value not logged) |
| Total chunks | {len(rows)} |
| Embed-eligible | {len(eligible)} |
| Excluded (headers / flag false) | {len(excluded_rows)} |

## Results

| Metric | Count |
| --- | ---: |
| Success (valid embedding written) | {len(success_ids)} |
| Failed (recorded, not silent) | {len(fail_ids)} |
| Missing (neither success nor failed) | {len(missing)} |
| Excluded from job | {len(excluded_rows)} |
| Oversized / truncation notes | {len(oversized_list)} |
| Resume skipped (already valid) | {skipped_valid} |
| Newly embedded this run | {newly_ok} |

## Vector checks (success rows)

| Check | Result | Count bad |
| --- | --- | ---: |
| dims == 768 | {'PASS' if not dim_fail else 'FAIL'} | {len(dim_fail)} |
| all finite | {'PASS' if not finite_fail else 'FAIL'} | {len(finite_fail)} |
| L2 norm ≈ 1 | {'PASS' if not l2_fail else 'FAIL'} | {len(l2_fail)} |
| secret pattern scan (metadata sample) | {'CLEAN' if not leak else 'HIT'} | — |

## Failed chunk_ids

"""
    if fail_ids:
        for cid in fail_ids:
            reason = failed_map[cid].get("reason", "")
            report += f"- `{cid}` — {reason[:200]}\n"
    else:
        report += "_None._\n"

    report += "\n## Oversized / truncation notes\n\n"
    if oversized_list:
        for o in oversized_list:
            report += f"- `{o.get('chunk_id')}` — {o.get('reason')} (chars={o.get('input_chars')})\n"
    else:
        report += "_None recorded._\n"

    report += f"""
## Overall

**{'PASS — ready for human approval before any Supabase upload' if overall else 'FAIL — fix failures / re-run (resume supported) before upload'}**

Elapsed this run: {time.time() - started:.1f}s
"""
    REPORT_PATH.write_text(report, encoding="utf-8")
    print(report.split("## Overall")[-1], flush=True)
    print(f"Wrote {OUT_PATH} lines={len(success_ids)}", flush=True)
    print(f"Wrote {REPORT_PATH}", flush=True)
    print(
        f"SUMMARY success={len(success_ids)} fail={len(fail_ids)} excluded={len(excluded_rows)} missing={len(missing)}",
        flush=True,
    )
    return 0 if overall else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception:
        traceback.print_exc()
        raise SystemExit(1)
