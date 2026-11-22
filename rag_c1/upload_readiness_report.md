# Upload readiness report (reconciliation only)

**Generated:** 2026-11-22 (read-only check — no new embeddings, no vector edits, no Supabase)  
**Source:** `/cursor/stores/self/docs/chunker_output/chunks.jsonl`  
**Output:** `/cursor/stores/self/docs/rag_c1/chunks_with_embeddings.jsonl`  
**Also checked:** `full_embedding_validation_report.md`, `full_embedding_checkpoint.json`, `full_embedding_failures.jsonl`

---

## Verdict

# READY

Embeddings are complete and valid for Person B `document_chunks` / `vector(768)` insertion **after** human approval of upload. This reconciliation did **not** upload.

---

## Counts

| Metric | Count |
| --- | ---: |
| Source total | 1120 |
| Embed-eligible (`include_in_embedding==true`) | 742 |
| Excluded (not embedded) | 378 |
| Output rows with valid embeddings | **742** |
| Failed (current failures file / checkpoint) | **0** |
| Missing eligible IDs | **0** |
| True oversize / truncation | **0** |

---

## Checklist — 12 items from full-embed request

| # | Requirement | Result | Evidence |
| ---: | --- | --- | --- |
| 1 | Config: `gemini-embedding-001`, dims 768, `RETRIEVAL_DOCUMENT`, L2 normalize; key from `.env` only | **PASS** | All 742 rows: `embed_model=gemini-embedding-001`, `embed_dims=768`, `embed_task_type=RETRIEVAL_DOCUMENT`; post-L2 ‖v‖ ∈ [1.0±1e-3] (min≈1.0, max=1.0). Secrets not present in reports. |
| 2 | Source = `chunks.jsonl`; only `include_in_embedding==true` | **PASS** | Output 742 = eligible 742; 0 excluded headers in output; 0 unknown IDs. |
| 3 | Complete `embedding_text` if non-empty else `chunk_text` (not truncated display fields) | **PASS** | 742/742 used `embed_input_field=embedding_text`; `embed_input_chars` matches full source field length on every row. |
| 4 | Output `chunks_with_embeddings.jsonl` + checkpoint for resume | **PASS** | Both present; checkpoint `completed_ids` = 742, `failed` = []. |
| 5 | Validation report at `full_embedding_validation_report.md` | **PASS** | File exists; records PASS / 742 success. |
| 6 | Preflight: pilot passed; total/eligible/excluded counts | **PASS** | Pilot artifacts present; validation report preflight table: 1120 / 742 / 378. |
| 7 | Retries + backoff, progress, resume skip valid, record failed IDs (no silent skip) | **PASS** | Runner implements retries/checkpoint/resume; mid-run 429s were recorded then cleared on resume (0 failures now). |
| 8 | Token / oversize: record IDs and report | **PASS*** | No true size failures. Checkpoint still lists 7 stale `oversized_or_truncated` entries that are **429 rate-limits mis-tagged**, and all 7 IDs are **present with valid embeddings** in the output. Treat as historical noise, not blocking. |
| 9 | Preserve all original fields + embedding metadata | **PASS** | Every source key preserved with identical values; embed metadata fields present on all rows. |
| 10 | Do not modify `chunks.jsonl`; no Supabase upload | **PASS** | Source still 1120 lines, no embedding arrays in source; this reconciliation performed no upload. |
| 11 | Stop after validation for human approval | **PASS** | Prior validation report gates on human approval; upload not run. |
| 12 | Final counts: success / fail / excluded (+ issues) | **PASS** | success=742, fail=0, excluded=378. Issues: transient free-tier TPM 429s + one store write flake during the original run — both resolved via resume. |

\*Item 8: **PASS for upload readiness** with documentation of stale checkpoint notes (not real truncations).

---

## Vector integrity (output file)

| Check | Result |
| --- | --- |
| dims == 768 | PASS (0 bad) |
| all finite floats | PASS (0 bad) |
| L2 norm ≈ 1 after normalize | PASS (0 bad) |
| Output order = eligible source order | PASS |

---

## Artifact status

| Artifact | Status |
| --- | --- |
| `chunks_with_embeddings.jsonl` | 742 lines — OK |
| `full_embedding_validation_report.md` | PASS — OK |
| `full_embedding_checkpoint.json` | completed=742, failed=0; stale oversized notes=7 (429s, all recovered) |
| `full_embedding_failures.jsonl` | empty — OK |
| `chunks.jsonl` | unchanged (1120) — OK |

---

## Explicit gate for Supabase insertion

| Decision | |
| --- | --- |
| **READY / NOT READY** | **READY** |
| Meaning | Safe to proceed with a **separate** Person B / C1 upload step using these 742 vectors (`vector(768)`), subject to human approval and live Supabase schema (pgvector + `documents` / `document_chunks`). |
| Do not | Re-embed, mutate vectors, or treat checkpoint’s 7 stale 429 notes as truncations. |

**Blocked only if** humans withhold upload approval or Supabase schema/pgvector is not ready — not blocked by embedding quality.
