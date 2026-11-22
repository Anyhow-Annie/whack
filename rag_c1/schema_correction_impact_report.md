# Schema Correction Impact Audit (Person C)

**Mode:** Inspection-only — **no** uploads, deletes, embedding regeneration, RLS changes, or schema DDL  
**Date:** 2026-11-22  
**Audience:** Person B (schema/access) + Person C (RAG / embeddings) + project owners  
**Live project (SERVICE_ROLE):** `https://ghuljonbyhwcnfpibiwk.supabase.co` (ref from JWT `ref` claim only)  
**Keys used:** `docs/rag_c1/.env` — shapes only: `SUPABASE_URL` len=40 · `SUPABASE_SERVICE_ROLE_KEY` len=219 (JWT, `role=service_role`) · anon/user JWTs still placeholder-shaped (len 46 / 36)

**Legend:** **FACT** = observed this audit · **PRIOR** = stated in earlier Person C store reports · **ASSUMPTION** = inferred, not SQL-proven

---

## Verdict (read this first)

| Question | Answer |
| --- | --- |
| Do existing **local** embeddings stay valid? | **YES — preserve** (742 × `gemini-embedding-001` @ 768, L2-normalized). Chunk text / boundaries / model unchanged. |
| Do **DB** embeddings need re-embed? | **N/A — DB has 0 `document_chunks` rows** right now. Prior upload (742) is gone. |
| Smallest safe recovery | **Re-insert from `chunks_with_embeddings.jsonl` by stable `chunk_id`** after fixing profile field semantics (Option 2 / migrate-preserving-embeddings). **Do not** full-regenerate vectors. |
| What actually broke under “schema correction”? | **Profile / membership semantics:** job **Position** stored in `profiles.department` / `project_members.department`; system-ish tier in `profiles.role` with non-architecture labels. Plus **corpus tables emptied**. |

**Recommendation:** **Preserve embeddings → metadata/profile correction + re-load by `chunk_id` (no re-embed).** Partial re-embed only if a future change edits `embedding_text` / chunk boundaries. Full regenerate: **not indicated**.

---

## 1. Employee profile fields (live)

**Table:** `profiles` (OpenAPI: 6 properties; required `id`, `name`, `email`, `role`, `department`)

| Column | Present | Live values (3 seed rows) | Expected from WHACK source | Status |
| --- | --- | --- | --- | --- |
| `id` | yes | uuids | auth user id | OK (seed) |
| `employee_id` | yes | `WH-01-001`, `WH-01-005`, `WH-01-006` | directory IDs | **Correct** IDs |
| `name` / `email` | yes | Mira Chen / June Whitaker / Caleb Ross + `@whack.example` | directory | **Correct** |
| `role` | yes | `project_lead`, `admin`, `member` | Architecture tiers: **Admin / Manager / Member**; chunk `system_role` for these people: Manager, Manager, Member | **Incorrect / ambiguous** — Director seeded as `admin` but corpus maps Director → **Manager**; PM as `project_lead` not `Manager` |
| `department` | yes | `Production Manager`, `Director`, `Actor` | See §2–3 — these are **Positions**, not C1 access-bag departments | **Incorrect meaning** for RLS/C1 enums |
| `position` / `job_title` / `organizational_role` / `system_role` / `team` / `access_level` | **no** | — | Source has Position; chunks have `organizational_role` + `system_role` | **Missing** as dedicated columns |

**FACT:** Only 3 profiles exist (Hamlet demo triad). 116 directory employees are not profiled.

---

## 2. Position / job-title fields

### Source of truth (WHACK)

| Source | Field | Example |
| --- | --- | --- |
| `ORG-002` Employee Directory | column **Position** | Production Manager, Actor, … |
| `04_Indexes/employees.csv` | `position` | 116 rows; 10 distinct titles |
| Employee Markdown | `**Position:**` | same as CSV |
| Chunks (`chunks.jsonl`) | `organizational_role` **=** `position` (764/764 employee rows) | agrees with directory **116/116** |

**Distinct positions (directory):** Production Manager (8), Stage Manager (8), Director (4), Actor (28), Costume Designer (8), Set & Prop Designer (20), Light Designer (8), Sound Designer (8), Publicity (16), Dramaturg (8).

### Live DB

| Location | Holds job title? | Notes |
| --- | --- | --- |
| `profiles.department` | **Yes (wrong column)** | Values are Positions |
| `project_members.department` | **Yes (wrong column)** | Same three titles |
| `profiles.role` | No (holds tier-like strings) | Not Position |
| `documents` / `document_chunks` | **No `position` / `organizational_role` column** | Confirmed missing (Postgres 42703) |
| Prior C1 upload (`document_chunks.system_role`) | Tier only | Upload script did **not** persist Position into columns or `metadata` jsonb |

**Meaning change under new seed data:** Position is being treated as “department,” which collides with document ACL `department` enums (§3).

---

## 3. Department / team fields

There are **three different “department” meanings** in this project. Mixing them is the core schema-correction risk.

| Meaning | Vocabulary | Where it lives |
| --- | --- | --- |
| **A. Craft / org unit on employee docs** | Same labels as Position (`Production Manager`, `Actor`, …) | Source Markdown `**Department:**` often equals `**Position:**` (e.g. Mira Chen plan) |
| **B. C1 / Avery document ACL bag** | `Partnerships` · `Finance` · `HR` · `General` | `documents.department`, `document_chunks.department` (when populated); `mapping_table.md` |
| **C. Live `profiles.department` / `project_members.department`** | Currently **A** (job titles) | Seeded 2026-11-22 ~13:30Z with projects |

**FACT:** Live profile/member `department` values have **empty intersection** with C1 enum set B.

**Team:** No `team` column on profiles, documents, or chunks (42703). Season/production assignment is the real “team” proxy via `projects` + `season`/`production`/`venue`.

**`projects` (4 rows) — FACT, looks correct vs corpus seasons:**

| title | season | production | venue | budget_ceiling |
| --- | --- | --- | ---: |
| Season 1: Hamlet | 2023-2024 | Hamlet | WHACK Black Box Theater | 6200 |
| Season 2: A Midsummer Night's Dream | 2024-2025 | A Midsummer Night's Dream | WHACK Auditorium | 6200 |
| Season 3: The Glass Menagerie | 2025-2026 | The Glass Menagerie | WHACK Black Box Theater | 4800 |
| Season 4: Macbeth | 2026-2027 | Macbeth | WHACK Black Box Theater | 4800 |

`created_at` on all four: `2026-11-22T13:30:13.450359+00:00` (after prior C1 upload at ~10:45Z).

---

## 4. Access-control fields

| Layer | Fields | Live status | vs source / policy |
| --- | --- | --- | --- |
| Document ACL (C1) | `department`, `access_level`, `subcategory` | Columns exist on `documents` / `document_chunks`; **0 rows** | Enums documented in `mapping_table.md`; prior upload histograms were healthy |
| Chunk system tier | `document_chunks.system_role` | Column exists; **0 rows** | Source: Manager/Member only in employee chunks (no Admin in roster) |
| Profiles | `role` | `admin` / `project_lead` / `member` | **Not aligned** with architecture PDF tiers or chunk `system_role` mapping |
| Project membership | `project_role`, `department` | 3 rows on Hamlet only | `project_role` mirrors profile `role`; `department` = Position |
| Proxy JSONL | Admin/Manager/Member actions | File-only; all `proposed` | **Not** wired into live DB; still review-required |
| Ownership | `owner_employee_id`, `ownership_is_acl=false` | Not DB columns on chunks | Must not be treated as ACL |

**Director profile anomaly (FACT):** `WH-01-005` June Whitaker → directory Position=Director, chunk `system_role=Manager`, profile `role=admin`. That upgrades a Manager-mapped craft role to Admin in the seed — **incorrect** relative to Person C access handoff + proxy matrix.

---

## 5. Document metadata fields (live schema)

**Table `documents` — OpenAPI columns (unchanged vs prior C1 upload report shape):**  
`id`, `title`, `content`, `department`, `access_level`, `project_id`, `created_at`, `subcategory`, `source_doc_id`, `document_type`, `level`, `season`, `production`, `venue`, `lifecycle_stage`

| Check | Result |
| --- | --- |
| Row count now | **0** (HEAD `Prefer: count=exact` → `*/0`) |
| Prior C1 upload | **PRIOR:** 382 (378 WHACK `source_doc_id` + 4 seeds) at 2026-11-22 ~10:45Z |
| Missing vs chunk archive | No `author`, `path`, `employee_id`, `position` columns (by design of C1 mapping) |
| Required | `id`, `title`, `department`, `access_level` |

---

## 6. Chunk metadata fields (live schema)

**Table `document_chunks` — OpenAPI columns:**  
`id`, `document_id`, `chunk_index`, `content`, `embedding` (`extensions.vector(768)`), `metadata` jsonb, `department`, `access_level`, `subcategory`, `chunk_id`, `source_doc_id`, `chunk_type`, `level`, `season`, `production`, `venue`, `employee_id`, `system_role`, `lifecycle_stage`, `safety_critical`, `include_in_embedding`, `include_in_retrieval`, `embedding_text`, `created_at`

| Check | Result |
| --- | --- |
| Row count now | **0** |
| Prior C1 upload | **PRIOR:** **742** with `chunk_id` 742/742 vs local embeddings file |
| Still missing vs `chunks.jsonl` | `organizational_role` / `position` / `employee_name` / `owner_employee_id` / safety topic arrays / offsets — not first-class columns (some were never uploaded; path etc. only in `metadata`) |
| Embedding type | Still `extensions.vector(768)` — **no dim change observed** |

---

## 7. Changes to `documents` and `document_chunks`

| Aspect | Could verify live? | Finding |
| --- | --- | --- |
| Column set via PostgREST OpenAPI | **Yes** | Matches prior C1 upload inspection (WHACK metadata columns + 768 vector) |
| CHECK / enum constraints | **No** (no `information_schema` / SQL catalog via PostgREST) | Unknown whether DB enforces Partnerships/Finance/HR/General |
| Row data | **Yes** | **Wiped:** 0 documents, 0 chunks |
| `knowledge_chunks` | **Yes** | Still absent (PGRST205 / not in OpenAPI) |
| Migration notes / schema dump in store | **No dedicated Person B dump found** | Inferred from OpenAPI + row state + timestamps |

**Timeline (FACT):**

1. ~10:34Z — local full embed validation PASS (742)  
2. ~10:45Z — C1 upload progress `phase=done` (378 docs / 742 chunks)  
3. ~13:30Z — `projects` recreated; profiles/members seeded with Position-in-`department`  
4. This audit — documents/chunks empty; RPC match returns 0  

**ASSUMPTION:** Person B’s correction window truncated or rebuilt ACL-related seed data and cleared corpus tables. Column *shape* for documents/chunks looks stable; *contents* do not.

---

## 8. RLS policies and `match_document_chunks`

### `match_document_chunks` (FACT)

| Item | Observation |
| --- | --- |
| Exists | Yes (`/rpc/match_document_chunks`) |
| Args | Required `query_embedding`; optional `match_threshold`, `match_count`, `filter_subcategory` |
| Smoke (SERVICE_ROLE, zero vector, threshold 0) | **0 rows** (consistent with empty table) |
| Filters for `department` / `access_level` | **Not** in RPC args — still rely on RLS (ASSUMPTION) + optional subcategory |

### RLS (limited verification)

| Item | Observation |
| --- | --- |
| `pg_policies` / policy SQL | **NOT OBSERVED** — PostgREST does not expose catalog |
| `rpc/rls_auto_enable` | Still listed in OpenAPI (not invoked; inspection-only) |
| SERVICE_ROLE | Can read profiles/projects; sees 0 chunks |
| Whether policies changed | **Could not verify** vs prior state |

**Risk if profiles keep Position in `department`:** any RLS of the form “user.department must match document.department” would compare **Actor** to **General/HR/…** and systematically deny (or mis-allow) — **ASSUMPTION** pending policy paste from Person B.

---

## 9. Uploaded-records audit (local corpus vs DB)

### Counts

| Artifact | Count |
| --- | ---: |
| `docs/chunker_output/chunks.jsonl` | 1120 (378 headers + 742 embed-eligible) |
| `docs/rag_c1/chunks_with_embeddings.jsonl` | **742** (all dims=768, model=`gemini-embedding-001`) |
| Embed-eligible ∩ emb file | **742 / 742** |
| Live `documents` | **0** |
| Live `document_chunks` | **0** |
| Directory employees | 116 |
| Loader documents | 378 |

### Field-by-field: DB vs expected (when rows existed / when reloaded)

| Field | Expected source | Prior upload behavior | Live now | Correctness | Meaning shift? |
| --- | --- | --- | --- | --- | --- |
| `chunk_id` | chunks.jsonl | Stored; 742/742 | missing rows | **Missing in DB** | No |
| `content` / `embedding_text` | `chunk_text` / `embedding_text` | Stored | missing rows | Missing | No (local intact) |
| `embedding` | local 768 vectors | Stored | missing rows | Missing | No |
| Doc/chunk `department` | C1 map (General/HR/…) | Mapped; histograms PRIOR | missing rows | Was OK for C1 enums | Must **not** copy profile Position into this column on reload |
| Doc/chunk `access_level` | C1 map | Mapped | missing rows | Was OK | No |
| `employee_id` | chunks | Stored when employee-level | missing rows | Was OK | No |
| `system_role` | chunks Manager/Member | Stored | missing rows | Was OK | No |
| Position / `organizational_role` | directory + chunks | **Not stored** as column | still no column | **Missing** (gap, not wipe-caused) | Profiles wrongly used `department` instead |
| `profiles.department` | should be ACL bag **or** renamed | — | Job titles | **Incorrect** | **Yes — Position ≠ ACL department** |
| `profiles.role` | Admin/Manager/Member | — | admin/project_lead/member | **Incorrect/ambiguous** | **Yes** |
| Production assignment | season/production/venue | On chunks/docs | On `projects` OK; chunks empty | Projects OK | No |

### Distinguish the five concepts (required)

| Concept | WHACK meaning | Correct store today |
| --- | --- | --- |
| **Employee position** | Job title (Actor, PM, …) | Directory / CSV / chunk `organizational_role`=`position` — **not** `profiles.department` |
| **Department / team (craft)** | Often same string as Position on employee docs; also “scenic/costumes/…” deliverable language | Source Markdown only; no clean DB team column |
| **Document department** | C1 ACL bag General/HR/Finance/Partnerships | `documents.department` / `document_chunks.department` |
| **Access level** | C1 bag + “All employees” | `access_level` columns |
| **Production assignment** | Season + play + venue | `projects.*` and chunk/doc `season`/`production`/`venue` |

---

## 10. Embeddings impact (classes A–F) + migration options

### Classification of needed corrections

| Class | What it is | Applies here? | Existing local embeddings valid? |
| --- | --- | --- | --- |
| **A. Profile-only** | Fix `profiles` / `project_members` field meanings & values | **Yes — primary** | **Yes** (embeddings unrelated) |
| **B. Metadata-only** | Fix/re-write dept/access/system_role/etc. on docs/chunks without touching vectors | **Yes — on reload** use C1 enums, not Positions | **Yes** |
| **C. Access-control** | RLS / role mapping Admin·Manager·Member ↔ bags | **Yes — blocked until profiles corrected + policies confirmed** | **Yes** |
| **D. Chunk content** | `chunk_text` / `embedding_text` changes | **No evidence** | N/A |
| **E. Chunking / boundaries** | New splits / offsets / chunk_ids | **No** — still v2 1120 / 742 | N/A |
| **F. Embedding model / dims** | Model or vector width change | **No** — still `vector(768)` in OpenAPI; local file 768 | N/A |

**Chunk IDs needing re-embed:** **none** for schema/profile correction alone.  
If content/boundaries change later, re-embed only those `chunk_id`s — do not assume schema ⇒ re-embed.

### Migration options (evaluate only — do not execute)

| Option | Description | Fit now | Risks | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- |
| **1. Metadata update by stable `chunk_id`** | PATCH dept/access/… where rows exist | **Not usable while table empty** | Wrong enum writes | Rows must exist | Count + sample by `chunk_id` |
| **2. Migrate / re-insert preserving embeddings** | Insert parents + chunks from `chunks_with_embeddings.jsonl`, reuse vectors, stable `chunk_id` | **Best fit** | Duplicate if partial reload; mapping mistakes | Profile/ACL semantics fixed first; SERVICE_ROLE insert path | 742 `chunk_id`s present; dim=768; dept histogram matches `mapping_table.md` |
| **3. Partial re-embed** | Only IDs with changed `embedding_text`/boundaries | **Not indicated** | Cost / drift | Diff of texts | Compare hash of `embedding_text` |
| **4. Full reload + full regenerate** | Wipe + re-embed all | **Unsafe / unnecessary** | Cost, quota, irreversible churn | Only if vectors corrupt or model/dim change | Would need new validation report |

**Smallest safe path:** **A + B via Option 2** (correct profiles; re-insert 742 vectors unchanged). Skip 3–4.

---

## What this audit could / could not verify

| Verified live | Not verified |
| --- | --- |
| OpenAPI column lists for profiles, projects, project_members, documents, document_chunks | Actual `CREATE POLICY` / RLS SQL text |
| Row counts (0 / 0 / 3 / 4 / 3) | Historical DDL migration files (none in store) |
| Profile/member value semantics vs directory | Whether CHECK constraints enforce C1 enums |
| RPC signature + empty result | Whether wipe was intentional vs accidental |
| Local JSONL ↔ directory Position agreement | Auth anon/user path (placeholders unchanged) |

---

## Clear asks for Person B / owners

1. **Rename or split profile fields:** store Position in `position`/`job_title`/`organizational_role`; store ACL bag in `department` **or** stop using `department` for craft titles.  
2. **Normalize `profiles.role`** to architecture tiers (`Admin`/`Manager`/`Member`) — fix Director≠Admin, PM≠ad-hoc `project_lead`.  
3. Confirm whether emptying `documents`/`document_chunks` was intentional; authorize Option-2 re-insert from local embeddings (Person C will not upload in this audit).  
4. Paste RLS rules tying `profiles` → document `department`/`access_level`.  
5. Optionally add nullable `organizational_role` on chunks (metadata-only; still no re-embed).

---

## Sources

| Artifact | Absolute path |
| --- | --- |
| This report | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/schema_correction_impact_report.md` |
| Env (keys only) | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/.env` |
| Mapping | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/mapping_table.md` |
| Upload report (PRIOR 742) | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/supabase_upload_report.md` |
| Upload progress | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/supabase_upload_progress.json` |
| Embeddings file | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/chunks_with_embeddings.jsonl` |
| Chunks | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/chunker_output/chunks.jsonl` |
| Loader docs | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/loader_output/documents.jsonl` |
| Access handoff | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/access_policy/person_b_access_metadata_handoff.md` |
| Employee directory | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/internal/dataset/WHACK_Organizational_Memory/01_Organization_Core/ORG-002_Employee_Directory.md` |
| Employees CSV | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/internal/dataset/WHACK_Organizational_Memory/04_Indexes/employees.csv` |
| Schema handoff (knowledge_chunks proposal) | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/knowledge_chunks_schema_handoff.md` |
| Prior retrieval readiness | `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/semantic_retrieval_readiness_report.md` |

---

## Final recommendation

**Preserve embeddings. Do not full-regenerate. Do not partial-re-embed for this correction.**

1. Correct profile/membership semantics (Position ≠ `department` ACL bag; align `role` to Admin/Manager/Member).  
2. Re-load `documents` + `document_chunks` from local artifacts by stable `chunk_id`, **reusing** the 742 existing vectors (Option 2).  
3. Re-verify counts, enum histograms, and one SERVICE_ROLE `match_document_chunks` smoke — then user-JWT RLS once real anon/user keys exist.
