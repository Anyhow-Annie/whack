# Embedding recovery report

**Status:** SUCCESS  
**Generated:** 2026-11-22T14:24:00Z (≈ 2026-11-22 9:24 AM America/New_York)  
**Mode:** Option-2 reload — reuse local vectors; no Gemini / embedding API; no RLS/schema/RPC changes; no drop/truncate  
**Keys:** `docs/rag_c1/.env` only (`SUPABASE_SERVICE_ROLE` server-side)

---

## Verdict

| Metric | Result |
| --- | ---: |
| Documents (target / live) | **378 / 378** |
| Chunks (target / live) | **742 / 742** |
| Docs failed | **0** |
| Chunks failed | **0** |
| Unresolved Person B mappings | **0** |
| Duplicate `chunk_id` | **0** |
| Missing / extra vs local embeddings | **0 / 0** |
| Embedding dims ≠ 768 | **0** |
| Null embeddings | **0** |
| Orphan FK (`document_id`) | **0** |
| Position written into `department` | **0** |
| Vectors regenerated | **No** — reused from `chunks_with_embeddings.jsonl` |

---

## 1. Schema compare (upload script vs live OpenAPI)

Live PostgREST OpenAPI inspected before upload (SERVICE_ROLE).

| Object | Live | Script alignment |
| --- | --- | --- |
| `documents` | 15 cols; required `id,title,department,access_level` | Matches insert fields; no Position columns |
| `document_chunks` | 24 cols; `embedding=extensions.vector(768)`; FK `document_id → documents.id` | Matches; Position/`organizational_role` → `metadata` jsonb only |
| `match_document_chunks` | Present; required `query_embedding` | Smoke-tested after load |
| `knowledge_chunks` | Absent | Not used |

**Pre-resume live counts:** 200 `documents` (all with WHACK `source_doc_id`, C1 ACL enums already correct) · 0 `document_chunks`.  
**Dry-run (pass):** insert 178 docs + 742 chunks; reuse 200 parents; unresolved=0; vectors_ok.

Evidence: `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/embedding_recovery_dry_run.md`

---

## 2. Metadata mapping (corrected)

| Concept | Stored where | Source |
| --- | --- | --- |
| Document department (ACL bag) | `documents.department` / `document_chunks.department` | `map_access` → `Partnerships` \| `Finance` \| `HR` \| `General` |
| Access level | `access_level` | Approved C1 mapping (`Partnerships`/`Finance`/`HR`/`All employees`) |
| Subcategory | `subcategory` | Stable filter slugs from mapping table |
| System role | `document_chunks.system_role` | Chunk field only: Manager / Member / empty (org docs) |
| Production assignment | `season` / `production` / `venue` | Chunk/doc fields (separate from ACL) |
| Employee Position / craft role | `metadata.position` / `metadata.organizational_role` | **Not** `department` |
| Vectors | `embedding` | Local JSONL; `metadata.vectors_reused=true` |

No ACL invented. Person B required fields all resolved (0 unresolved).

### Live histograms (post-load)

**Chunks**

| department | count | access_level | count |
| --- | ---: | --- | ---: |
| General | 445 | All employees | 493 |
| HR | 236 | HR | 236 |
| Partnerships | 58 | Partnerships | 10 |
| Finance | 3 | Finance | 3 |

**`system_role`:** Manager 92 · Member 324 · empty 326  
**`map_access` mismatches:** 0 · **Position-as-department:** 0

---

## 3. Upload run

| Phase | Result |
| --- | --- |
| Dry-run | COMPATIBLE — 378 docs / 742 chunks planned; vectors_ok |
| First upload (paused mid-chunks) | Docs 178 inserted + 200 reused; chunks ~325–350 inserted |
| Resume (skip existing `chunk_id`) | Docs reused 378; chunks +392 inserted, 350 skipped |
| Final progress | `phase=done`, docs_failed=0, chunks_failed=0, `vectors_reused=true` |

Log: `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/supabase_recovery_upload.log`  
Progress: `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/supabase_upload_progress.json`

Preserved: `chunk_id`, `source_doc_id`, `content`/`chunk_text`, embeddings (no silent overwrite — skip-existing policy).

---

## 4. Verification

| Check | Result |
| --- | --- |
| 378 documents with unique `source_doc_id` | Pass |
| 742 chunks / 742 unique `chunk_id` covering local file | Pass |
| FK `document_id` → parent; `source_doc_id` consistency | Pass (0 orphans / mismatches) |
| All embeddings 768-d, non-null, L2≈1.0 | Pass |
| Local vs DB vector (sample) | Content exact match; float max_diff ~1e-8 (serialize noise, not re-embed) |
| `metadata.vectors_reused=true` | 742/742 |
| Position/org role in metadata when present | 416 rows |
| `match_document_chunks` smoke (zero vector, threshold 0, count 3) | **3 rows** returned |

---

## 5. Success / fail counts

| | Success | Fail |
| --- | ---: | ---: |
| Documents | **378** | **0** |
| Chunks | **742** | **0** |
| Unresolved mappings | — | **0** |

**Overall: SUCCESS**

---

## Sources

| Artifact | Path |
| --- | --- |
| This report | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/embedding_recovery_report.md` |
| Dry-run | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/embedding_recovery_dry_run.md` |
| Upload script | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/supabase_upload_run.py` |
| Embeddings | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/chunks_with_embeddings.jsonl` |
| Loader docs | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/loader_output/documents.jsonl` |
| Mapping | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/mapping_table.md` |
| Schema audit | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/schema_correction_impact_report.md` |
