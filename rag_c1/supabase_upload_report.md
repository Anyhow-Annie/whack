# Supabase upload report (Person C)

**When:** 2026-11-22  
**Source embeddings:** `/cursor/stores/self/docs/rag_c1/chunks_with_embeddings.jsonl` (742)  
**Destination:** Person B tables `documents` + `document_chunks` (`embedding extensions.vector(768)`)  
**Auth:** `SUPABASE_SERVICE_ROLE_KEY` for insert only · **no RLS/schema changes**  
**Secrets:** loaded from `.env`; **never printed**

---

## Step 1 — Schema inspection

| Check                       | Result                                                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `documents`                 | **Present** — PK `id` (uuid); required: `id`, `title`, `department`, `access_level`; also `content`, `subcategory`, `source_doc_id`, WHACK metadata columns, optional `project_id` FK                                                                   |
| `document_chunks`           | **Present** — PK `id` (uuid); FK `document_id` → `documents.id`; required: `id`, `document_id`, `chunk_index`, `content`; `embedding` **=** `extensions.vector(768)`; also `chunk_id`, `source_doc_id`, access fields, WHACK metadata, `metadata` jsonb |
| `knowledge_chunks`          | **Absent** (PGRST205) — correctly **did not stop**; proceeded with Person B tables                                                                                                                                                                      |
| RPC `match_document_chunks` | Present (query_embedding required; optional threshold/count/filter_subcategory)                                                                                                                                                                         |

### Env key shape audit (lengths only — no values)

| Key | Length | Looks like JWT (`eyJ…`) | Assessment |
| --- | ---: | --- | --- |
| `SUPABASE_URL` | 40 | n/a | OK shape (`https://…supabase…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | 219 | yes | **OK — used for upload** |
| `SUPABASE_ANON_KEY` | 46 | no | **SUSPICIOUS / likely placeholder** — do **not** use for RLS chat until replaced with real anon JWT |
| `SUPABASE_USER_JWT` | 36 | no | **SUSPICIOUS / likely placeholder** — retrieval/chat will fail until a real user access token is supplied |
| `GEMINI_API_KEY` | present | — | Present (not needed for this upload step) |

**Ask for Person B / project owner:** refresh `.env` `SUPABASE_ANON_KEY` (full anon JWT) and provide a real signed-in `SUPABASE_USER_JWT` before C1 RAG chat testing. Insert path did **not** need them.

---

## Step 2 — Test batch (5–10)

| Metric | Value |
| --- | --- |
| Batch size | **8** chunks (org policy, meeting, status, employee, closeout, rule, decision, directory row) |
| Parent `documents` inserted | 8 (`source_doc_id` = WHACK id) |
| `document_chunks` inserted | 8 |
| `chunk_id` round-trip match | **8 / 8** |
| Embedding dim sampled | **768** |
| Errors | 0 |

**TEST: OK** → proceeded to full upload.

---

## Step 3 — Full upload (remaining)

| Metric | Count |
| --- | ---: |
| Local embedded chunks | 742 |
| Distinct WHACK docs | 378 |
| Documents inserted this run | 370 |
| Documents reused (test batch) | 8 |
| Document failures | 0 |
| Unresolved department mappings | 0 |
| Chunks inserted this run | 734 |
| Chunks skipped (already present) | 8 |
| Chunk failures | 0 |

**Duplicate protection:** skip existing `documents.source_doc_id` and `document_chunks.chunk_id` (no silent overwrite of vectors).  
**Batching:** 25 chunks/request with per-row fallback on batch error.

---

## Step 4 — Post-upload verification

| Check | Result |
| --- | --- |
| `documents` total rows | 382 (378 WHACK `source_doc_id` + 4 pre-existing seed docs) |
| `document_chunks` total | **742** |
| Local chunk_ids present in DB | **742 / 742** (missing 0) |
| Unexpected extra `chunk_id`s | 0 |
| Embedding dims ≠ 768 | **0** |
| Metadata present (dept/access/`chunk_id`/`source_doc_id`/`document_id`) | **742 / 742** |
| Sample source refs | `ORG-001`, `S1-03`, `S1-04` … with matching `chunk_id` + subcategory |

### Access mapping distribution (chunks in DB)

| department | count |
| --- | ---: |
| General | 445 |
| HR | 236 |
| Partnerships | 58 |
| Finance | 3 |

| access_level | count |
| --- | ---: |
| All employees | 493 |
| HR | 236 |
| Partnerships | 10 |
| Finance | 3 |

(Mapping rules: `docs/rag_c1/mapping_table.md` / `ingest_documents.map_access`.)

---

## Overall

| Gate | Status |
| --- | --- |
| Schema usable for C1 | **YES** (`documents` + `document_chunks` @ 768) |
| Upload complete | **YES** |
| Vector / id integrity | **PASS** |
| Ready for RLS chat smoke test | **NOT YET** — replace short `ANON_KEY` / `USER_JWT` placeholders first |
| RLS / schema modified by Person C | **No** |

### Artifacts

- This report: `/cursor/stores/self/docs/rag_c1/supabase_upload_report.md`
- Progress: `/cursor/stores/self/docs/rag_c1/supabase_upload_progress.json`
- Uploader: `/cursor/stores/self/docs/rag_c1/supabase_upload_run.py`
- Log: `/cursor/stores/self/docs/rag_c1/supabase_upload_run.log`
