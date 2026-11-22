# Pre-Semantic Retrieval Readiness Audit (Person C)

**Mode:** Read-only inspection — **no** retrieval implementation, **no** DB/RLS/RPC/document mutations  
**Date:** 2026-11-22  
**Legend:** **FACT** = observed in files/API this audit · **ASSUMPTION** = inferred / not directly proven

**Overall:** **NOT READY for end-user semantic retrieval** until auth keys for RLS-scoped chat are fixed.  
**Corpus + schema + RPC (service role):** largely ready.

---

## 1. Embedding corpus readiness

**Inspected:** `docs/rag_c1/chunks_with_embeddings.jsonl`, `full_embedding_validation_report.md`, `upload_readiness_report.md`, `supabase_upload_report.md`

| Item | Status | Notes |
| --- | --- | --- |
| Local embedded rows | **FACT** | **742** lines |
| Model / dims / task | **FACT** | All `gemini-embedding-001`, `embed_dims=768`, `RETRIEVAL_DOCUMENT` |
| L2-normalized / finite | **FACT** | Validation + recheck: 0 dim/finite/L2 failures |
| Source filter | **FACT** | Embed-eligible only (`include_in_embedding=true`); 378 headers excluded from embed file |
| Uploaded to Supabase | **FACT** | `document_chunks` count **742**; all have non-null `embedding`; `chunk_id` coverage 742/742 vs local |
| Headers in DB | **FACT** | **0** rows with `include_in_retrieval=false` in DB (headers not uploaded) |

**FACT:** Person B email said headers *may* be inserted with `embedding=null` and are skipped by `match_document_chunks`.  
**ASSUMPTION:** Omitting headers from DB is acceptable for search quality; provenance still lives in local `chunks.jsonl`.

**Gate:** Corpus for vector search — **READY** (service-side).

---

## 2. Live schema alignment (`documents` + `document_chunks`)

**Inspected:** PostgREST OpenAPI + table probes (SERVICE_ROLE)

| Item | Status | Notes |
| --- | --- | --- |
| Target tables | **FACT** | `documents`, `document_chunks` present |
| `knowledge_chunks` | **FACT** | **Absent** (PGRST205) — C1 correctly uses Person B tables |
| `document_chunks.embedding` | **FACT** | OpenAPI format `extensions.vector(768)` |
| PK / FK | **FACT** | `documents.id` uuid PK; `document_chunks.document_id` FK → `documents.id`; `document_chunks.id` uuid PK |
| Identity bridge | **FACT** | WHACK ids in `source_doc_id` / `chunk_id` (unique in practice for our upload) |
| Filter columns on chunks | **FACT** | `department`, `access_level`, `subcategory`, `level`, `season`, `production`, `venue`, `employee_id`, `system_role`, `lifecycle_stage`, `safety_critical`, include flags, `embedding_text`, `metadata` jsonb |
| Row counts | **FACT** | documents **382** (378 WHACK + 4 seed); chunks **742** |

**ASSUMPTION:** Seed `documents` (4 demo rows without `source_doc_id`) do not affect WHACK retrieval if RPC filters on chunk embeddings only.

**Gate:** Schema — **READY** for C1 retrieval against `document_chunks`.

---

## 3. RPC `match_document_chunks` contract

**Inspected:** OpenAPI `/rpc/match_document_chunks`; SERVICE_ROLE smoke call (zero vector, high threshold)

| Item | Status | Notes |
| --- | --- | --- |
| RPC exists | **FACT** | Listed in OpenAPI |
| Required arg | **FACT** | `query_embedding` (`extensions.vector`) |
| Optional args | **FACT** | `match_threshold` (float), `match_count` (int), `filter_subcategory` (text) |
| Callable | **FACT** | SERVICE_ROLE probe returned rows with keys: `id`, `chunk_id`, `document_id`, `source_doc_id`, `subcategory`, `content`, `metadata`, `similarity` |
| Skips null / non-retrieval rows | **ASSUMPTION** | Person B stated function skips non-retrieval / null embeddings; not proven by reading SQL (SQL body not exposed via PostgREST) |
| Similarity metric | **ASSUMPTION** | Likely cosine/inner-product over L2-normalized vectors (our vectors are L2-normalized; matches Person B 768 design) |

**Gap (FACT):** OpenAPI does **not** expose filters for `department` / `access_level` / `season` — only `filter_subcategory` plus (assumed) RLS.

**Gate:** RPC — **READY for service-role smoke**; client retrieval still blocked by auth (§4–5).

---

## 4. Environment keys (presence / shape only — no secrets)

**Inspected:** `docs/rag_c1/.env` (lengths + JWT prefix only)

| Key | Present | Len | Looks like JWT | Assessment |
| --- | --- | ---: | --- | --- |
| `SUPABASE_URL` | yes | 40 | n/a | **FACT:** usable |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | 219 | yes | **FACT:** usable (upload + RPC probe worked) |
| `SUPABASE_ANON_KEY` | yes | **46** | **no** | **FACT:** shape abnormal vs typical anon JWT (~200+) — treat as **placeholder / invalid for production client** |
| `SUPABASE_USER_JWT` | yes | **36** | **no** | **FACT:** not a user access token shape — **cannot** drive RLS user session |
| `GEMINI_API_KEY` | yes | 53 | n/a | **FACT:** present (needed for query embeddings / `gemini-2.5-flash`) |

**FACT (anon probe):** Using current `ANON_KEY`, `document_chunks` select and `match_document_chunks` returned **0 rows** (no hard 401 observed).  
**ASSUMPTION:** Either RLS hides all rows from that key, or the key is a nonstandard/limited credential — either way it is **not** validated as a proper logged-in user path.

**Gate:** Keys for **user-scoped** retrieval — **NOT READY**.  
**Ask:** Person B / project owner → real `SUPABASE_ANON_KEY` (anon JWT) + real signed-in `SUPABASE_USER_JWT` (or auth login flow).

---

## 5. RLS / authorization posture

**Inspected:** Behavior differences SERVICE_ROLE vs ANON; OpenAPI RPC list; Person B architecture notes (no policy SQL dump available)

| Item | Status | Notes |
| --- | --- | --- |
| SERVICE_ROLE sees chunks | **FACT** | Full 742 readable; RPC returns hits |
| ANON-shaped key sees chunks | **FACT** | 0 rows on select/RPC with current `.env` anon value |
| `rls_auto_enable` RPC | **FACT** | Present in OpenAPI (not invoked this audit) |
| Actual `pg_policies` text | **NOT OBSERVED** | No SQL catalog access in this read-only PostgREST session |
| RLS filters by `department` / `access_level` / project membership | **ASSUMPTION** | Consistent with Person B design + Avery C1 brief (“RLS automatically blocks unauthorized departments”); **not verified** by reading policies |
| C1 must use anon + user JWT (not service role) for chat | **FACT** | Stated in `rag_chat.py` / C1 README; service role would bypass RLS |

**Gate:** RLS design intent — **plausible but unverified**.  
**Gate:** Safe user retrieval demo — **NOT READY** until §4 keys fixed and a positive user-JWT RPC test returns authorized rows only.

---

## 6. Access metadata alignment (mapping vs proxy vs DB)

**Inspected:** `mapping_table.md`, DB `department`/`access_level` histograms, `proxy_access_assignments.jsonl`, `person_b_access_metadata_handoff.md`

### C1 enum mapping (uploaded)

| Item | Status | Notes |
| --- | --- | --- |
| Allowed enums | **FACT** | department ∈ {Partnerships, Finance, HR, General}; access_level ∈ {Partnerships, Finance, HR, All employees} |
| DB values only use those enums | **FACT** | dept: General 445, HR 236, Partnerships 58, Finance 3 · access: All employees 493, HR 236, Partnerships 10, Finance 3 |
| Mapping documented | **FACT** | `mapping_table.md` + `ingest_documents.map_access` |
| Unresolved skipped | **FACT** | Upload reported 0 unresolved docs |

### Proxy access layer (separate from C1 enums)

| Item | Status | Notes |
| --- | --- | --- |
| Proxy rows | **FACT** | **378** documents in `proxy_access_assignments.jsonl` |
| Approval state | **FACT** | All `permission_status=proposed`; `access_review_required=true` on all |
| System tiers in proxy | **FACT** | Admin / Manager / Member actions (architecture PDF) — **not** the same columns as `department`/`access_level` |
| Ownership ≠ ACL | **FACT** | Handoff: `ownership_is_acl=false`; do not wire as per-user ACL |
| Official permissions | **FACT** | **0** approved |

**ASSUMPTION:** Live RLS uses Person B `department`/`access_level` (and/or `project_members`), **not** the proxy JSONL file directly.  
**FACT:** Proxy file is still a **proposal** for Person B policy decisions (U-1 / U-3 open).

**Risk:** C1 `access_level=HR|Finance|Partnerships|All employees` is a **coarse bag** vs WHACK Admin/Manager/Member matrix — **ASSUMPTION** that Person B RLS maps user profiles → these bags correctly.

**Gate:** Metadata present for filtering — **READY at enum level**.  
**Gate:** Policy-approved access — **NOT READY** (proxy still proposed).

---

## Go / No-Go summary

| Capability | Verdict |
| --- | --- |
| Vectors in DB @ 768, IDs/metadata intact | **GO** |
| Schema + `match_document_chunks` (service role) | **GO** |
| User-JWT + anon RLS retrieval path | **NO-GO** (placeholder keys; policies not SQL-verified) |
| Treat proxy permissions as production ACLs | **NO-GO** (all proposed) |
| Implement / ship semantic chat next | **NO-GO** until §4 keys + one successful user-scoped RPC smoke |

### Blockers for Person B / owners (clear asks)

1. Provide real **`SUPABASE_ANON_KEY`** (full anon JWT) and a real **`SUPABASE_USER_JWT`** (or login method) for RLS testing.  
2. Confirm (or paste) **RLS policy** rules tying `profiles` / `project_members` → `document_chunks.department` / `access_level`.  
3. Confirm whether **378 headers** should be inserted as non-embedded provenance rows.  
4. Keep proxy JSONL **out of** automatic enforcement until U-1/U-3 decisions close.

### Non-blockers

- Local `chunks_with_embeddings.jsonl` quality  
- Upload completeness (742/742)  
- Absence of `knowledge_chunks` (by design)

---

## Sources (read-only)

| Artifact | Path |
| --- | --- |
| Embeddings | `/cursor/stores/self/docs/rag_c1/chunks_with_embeddings.jsonl` |
| Upload report | `/cursor/stores/self/docs/rag_c1/supabase_upload_report.md` |
| Upload readiness | `/cursor/stores/self/docs/rag_c1/upload_readiness_report.md` |
| Mapping | `/cursor/stores/self/docs/rag_c1/mapping_table.md` |
| Proxy access | `/cursor/stores/self/docs/access_policy/proxy_access_assignments.jsonl` |
| Access handoff | `/cursor/stores/self/docs/access_policy/person_b_access_metadata_handoff.md` |
| Chat stub (not executed as retrieval impl) | `/cursor/stores/self/docs/rag_c1/rag_chat.py` |
