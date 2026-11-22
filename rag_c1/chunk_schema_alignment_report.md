# Chunk ↔ live Supabase schema alignment

**Mode:** Audit + pipeline/mapping plan only — **no** DDL, RLS edits, truncates, re-embeds, or DB writes this turn  
**Date:** 2026-11-22  
**Live SoT:** PostgREST OpenAPI + table probes via `docs/rag_c1/.env` (`SUPABASE_SERVICE_ROLE_KEY`; secrets not printed)  
**Project host:** `ghuljonbyhwcnfpibiwk.supabase.co`

**Verdict:** Live schema already separates **access role** (`profiles.role` / `project_members.project_role`) from **organizational position** (stored in `profiles.department` / `project_members.department`). Corpus tables use a **different** `department` meaning (ACL bag). Local chunks + upload mostly match corpus columns, but **name collisions** (`department`, `role`/`system_role`) and missing local ACL fields are the real alignment gaps. Fix in **scripts / JSONL metadata / docs** — not by redesigning Supabase.

---

## Canonical vocabulary (do not conflate)

| Concept | Allowed values | Live SoT field | Local chunk field today |
| --- | --- | --- | --- |
| **Organizational position** | Director, Production Manager, Stage Manager, Actor, Costume Designer, Set & Prop Designer, Light Designer, Sound Designer, Publicity, Dramaturg | `profiles.department`, `project_members.department` | `position` **=** `organizational_role` (always equal in `chunks.jsonl`) |
| **Access role** | `admin`, `member`, `project_lead` | `profiles.role`, `project_members.project_role` | **absent** (do not invent from position) |
| **Corpus tier label** (architecture PDF Manager/Member) | `Manager`, `Member`, or empty | `document_chunks.system_role` | `system_role` |
| **Document ACL bag** | `Partnerships` \| `Finance` \| `HR` \| `General` | `documents.department`, `document_chunks.department` | **absent** on JSONL — applied at upload via `map_access` |
| **Document ACL visibility** | `Partnerships` \| `Finance` \| `HR` \| `All employees` | `documents.access_level`, `document_chunks.access_level` | **absent** on JSONL — via `map_access` |

**Hard rules:** Never treat position as access role. Never infer `profiles.role` from Position or from `system_role`. Never write Position titles into corpus `department`.

---

## Task A — Live schema (queried this turn)

### A.1 Employee profiles

**Table `profiles`** — OpenAPI required: `id`, `name`, `email`, `role`, `department`  
Columns: `id` (uuid), `employee_id` (text), `name`, `email`, `role`, `department`

| Live rows (3) | `employee_id` | `role` (access) | `department` (position) |
| --- | --- | --- | --- |
| Mira Chen | WH-01-001 | `project_lead` | Production Manager |
| June Whitaker | WH-01-005 | `admin` | Director |
| Caleb Ross | WH-01-006 | `member` | Actor |

**No** dedicated `position` / `organizational_role` / `system_role` / `job_title` columns on `profiles`.  
**Organizational position field = `profiles.department`** (live SoT naming; accept as-is).  
**Access role field = `profiles.role`** with observed values `{admin, member, project_lead}`.

**Table `project_members`** — required `project_id`, `user_id`; columns include `project_role` (default shown as `Member` in OpenAPI), `employee_id`, `department`.  
Live 3 rows (Hamlet): `project_role` mirrors profile access roles; `department` mirrors position titles.

### A.2 Documents / chunks

**`documents`** (required `id`, `title`, `department`, `access_level`) — 15 cols:  
`id`, `title`, `content`, `department`, `access_level`, `project_id`, `created_at`, `subcategory`, `source_doc_id`, `document_type`, `level`, `season`, `production`, `venue`, `lifecycle_stage`

**`document_chunks`** (required `id`, `document_id`, `chunk_index`, `content`) — 24 cols:  
above ACL trio + `embedding` `extensions.vector(768)`, `chunk_id`, `source_doc_id`, `chunk_type`, `level`, `season`, `production`, `venue`, `employee_id`, `system_role`, `lifecycle_stage`, `safety_critical`, `include_in_embedding`, `include_in_retrieval`, `embedding_text`, `metadata` jsonb, `created_at`

OpenAPI shows **no enum lists** on these text columns (app/convention enums, not visible CHECK in OpenAPI).

**Live corpus counts:** `documents` 378 · `document_chunks` 742 · `projects` 4 · `profiles` 3

**Live ACL histograms (corpus `department` ≠ profile position):**

| | documents | document_chunks |
| --- | ---: | ---: |
| General | 323 | 445 |
| Partnerships | 49 | 58 |
| HR | 5 | 236 |
| Finance | 1 | 3 |

**Position titles in corpus `department`:** **0** (upload correctly kept ACL bag).  
**`system_role` on chunks:** Manager 92 · Member 324 · null 326  
**Position on chunks:** only in `metadata.position` / `metadata.organizational_role` (416 rows); values match canonical Position set.

### A.3 Retrieval RPC

**`match_document_chunks`** args: required `query_embedding`; optional `match_threshold`, `match_count`, `filter_subcategory`.  
Smoke return keys: `id`, `document_id`, `chunk_id`, `source_doc_id`, `content`, `metadata`, `subcategory`, `similarity` (no `department`/`access_level` in RPC payload — RLS still applies server-side).

---

## Task B — Local chunk / ingest audit

### B.1 Files inspected

| Path | Rows / role |
| --- | --- |
| `docs/chunker_output/chunks.jsonl` | 1120 (includes 378 `document_header`) |
| `docs/rag_c1/chunks_with_embeddings.jsonl` | 742 embed-eligible (`include_in_embedding=true`) |
| `docs/rag_c1/mapping_table.md` | WHACK → ACL `department` / `access_level` / `subcategory` |
| `docs/rag_c1/ingest_documents.py` | `map_access` + dry-run/upload path |
| `docs/rag_c1/supabase_upload_run.py` | recovery upload: ACL columns + position → `metadata` |
| `internal/dataset/.../ORG-002_Employee_Directory.md` | 116 employees; 10 Positions = canonical set |

### B.2 Local position / system_role

- Directory Positions: exact canonical 10 titles; counts Actor 28, Set & Prop Designer 20, Publicity 16, PM/SM/Costume/Light/Sound/Dramaturg 8 each, Director 4.
- In both JSONLs: `position` **always equals** `organizational_role` (0 mismatches).
- `system_role` ∈ {`Manager`, `Member`, ``} — **never** `admin` / `project_lead`.
- `ownership_is_acl` always `false`; `access_policy` / `access_classification` empty on embedded set.

### B.3 Upload script behavior (already partially aligned)

`supabase_upload_run.py` today:

| Source | Destination | Correct vs live SoT? |
| --- | --- | --- |
| `map_access` → ACL enums | `documents.department` / `document_chunks.department` (+ access_level, subcategory) | **Yes** (ACL bag) |
| `system_role` | `document_chunks.system_role` | **Yes** (corpus tier column exists) |
| `position` / `organizational_role` / `employee_name` / `owner_employee_id` | `metadata` jsonb only | **Yes** (no position columns on chunks) |
| `employee_id` | `document_chunks.employee_id` | **Yes** |
| Does **not** write profiles | — | Correct for chunk ingest |

### B.4 Seed profile vs same employees’ chunks (vocabulary clash — not a Position bug)

| Person | Position (directory / chunk / `profiles.department`) | Chunk `system_role` | `profiles.role` |
| --- | --- | --- | --- |
| Mira Chen | Production Manager | Manager | **project_lead** |
| June Whitaker | Director | Manager | **admin** |
| Caleb Ross | Actor | Member | **member** |

Position columns already agree. Access role ≠ system_role vocabulary; only Caleb’s access role string coincides with a tier-ish label (`member` vs `Member`).

---

## Mismatches (local metadata ↔ live field names/values)

| # | Mismatch | Detail |
| --- | --- | --- |
| M1 | **Homonym `department`** | Profiles/members: Position titles. Documents/chunks: ACL bag (`Partnerships`/`Finance`/`HR`/`General`). Same column name, different domains. |
| M2 | **`system_role` ≠ access role** | Chunks use Manager/Member; live access roles are admin/member/project_lead. Mapping tables/scripts must not equate them. |
| M3 | **Local JSONL lacks ACL fields** | No `department` / `access_level` / `subcategory` on chunks — only derived at upload. Risk: readers treat JSONL `position` as if it were DB `department`. |
| M4 | **`position` / `organizational_role` not first-class DB cols** | Live stores them in `metadata`; profiles store Position in `profiles.department`. Dual naming is easy to mis-wire on next ingest. |
| M5 | **`mapping_table.md` scope gap** | Documents Person B ACL enums only; does not state that `profiles.department` is the live Position field or that `profiles.role` is the access-role field. |
| M6 | **Older “schema correction” narrative** | Prior reports treat Position-in-`profiles.department` as wrong and propose DDL. **Out of scope** — live schema is SoT; pipeline must adapt. |
| M7 | **Local-only policy fields** | `access_policy*`, ownership flags, safety topic strings, heading paths, etc. are not corpus columns (except `safety_critical` + includes). Keep in JSONL/`metadata` as needed; do not invent columns. |
| M8 | **Header chunks** | 378 `document_header` in `chunks.jsonl` not in embeddings/DB. Acceptable for search; provenance stays local. |

**Not mismatches (already good on live corpus):** ACL `department` never holds Position titles; position present in `metadata` for employee chunks; embeddings 768-d reused; `match_document_chunks` present.

---

## Pipeline / mapping changes only (no DDL)

### Target field dictionary for next ingest / update

```
# Employee identity (profiles — seed/admin path only; not chunk upload)
directory.Position          → profiles.department
explicit access assignment  → profiles.role ∈ {admin, member, project_lead}
                            → project_members.project_role (same set)
NEVER: Position → profiles.role
NEVER: system_role → profiles.role
NEVER: infer role from position

# Document / chunk ACL (upload path)
map_access(document_id, document_type, path, title)
  → documents.department / document_chunks.department     ∈ {Partnerships, Finance, HR, General}
  → documents.access_level / document_chunks.access_level ∈ {Partnerships, Finance, HR, All employees}
  → *.subcategory (slug)
NEVER: chunk.position → *.department

# Chunk craft / tier
chunk.position              → metadata.position
chunk.organizational_role   → metadata.organizational_role  (= position; keep both for parity)
chunk.system_role           → document_chunks.system_role   (Manager|Member|null only)
chunk.employee_id           → document_chunks.employee_id
chunk.owner_employee_id     → metadata.owner_employee_id
chunk.employee_name         → metadata.employee_name
```

### Concrete script / JSONL changes (recommended next implementation turn)

1. **`mapping_table.md`** — Add a top “three meanings of department / two meanings of role” callout; keep ACL table as-is; link Position → `profiles.department`, access role → `profiles.role`.
2. **`supabase_upload_run.py` / `ingest_documents.py`** — Assert before insert: `department` ∈ ACL bag and **∉** Position title set; comment that `system_role` is not `profiles.role`; keep position exclusively in `metadata`.
3. **Optional local JSONL enrichment (non-breaking):** add explicit aliases for humans/tools, e.g. `acl_department` / `acl_access_level` / `acl_subcategory` copied from `map_access`, and/or `access_role: null` with a note that access roles live on profiles — **do not** backfill inventing admin/member/project_lead onto chunks.
4. **Do not** rename live DB columns; do not migrate profile Position out of `profiles.department` in this workstream.
5. **Do not** re-embed or truncate; current 742 vectors remain valid under this mapping.

### Validation checklist (safe, read-only or dry-run)

- [ ] Dry-run upload: 0 rows where planned `department` ∈ Position set  
- [ ] Dry-run: every employee chunk with non-empty position has `metadata.position` set  
- [ ] Dry-run: `system_role` ∈ {Manager, Member, null/empty} only  
- [ ] Profile seed (if touched later): Position → `department`; role only from explicit access-role source  

---

## Next safe step

**Update mapping docs + upload/ingest guards** (`mapping_table.md`, asserts/comments in `supabase_upload_run.py` / `ingest_documents.py`) so Position / access role / ACL bag cannot be confused on the next ingest. **No live DB modification** until a later message explicitly asks for an ingest/update run.

Optional follow-on (needs explicit ask): re-run upload dry-run against live counts (378 docs / 742 chunks already loaded) to confirm skip-by-`chunk_id` behavior, or PATCH `metadata` only if local JSONL gains clearer ACL alias fields.
