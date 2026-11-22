# Chunk → Supabase mapping fix report

**Date:** 2026-11-22  
**Mode:** Implement/fix against **live schema as SoT** — no DDL/RLS redesign, no truncate, no re-embed, no silent vector overwrite  
**Prior audit:** `docs/rag_c1/chunk_schema_alignment_report.md`  
**Keys:** `docs/rag_c1/.env` (secrets not printed)

---

## Verdict

| Item | Result |
| --- | --- |
| Live position↔permission | **Found** in `position_role_map` + matching `profiles` / `project_members` |
| Craft fields on chunks | **OK** — `metadata.position` = `metadata.organizational_role` on all 416 employee chunks |
| Legacy chunk `system_role` | **Left as Manager/Member** — not mapped to permission |
| Corpus `department` / `access_level` | **STOP — Person B blocker** (no live auth contract for new values) |
| Safe DB change applied | **`documents.project_id` linked for 372/378** WHACK docs (factual FK to `projects`) |
| Embeddings | **Unchanged** (742 vectors reused / skipped) |

---

## 1. Live position ↔ permission (inspected, not invented)

### Table `position_role_map`

OpenAPI: PK `position`, column `system_role` (text).  
**Naming trap:** `system_role` here holds **permission** values, not chunk Manager/Member.

| position | permission (`position_role_map.system_role`) |
| --- | --- |
| Director | `admin` |
| Production Manager | `project_lead` |
| Stage Manager | `project_lead` |
| Actor | `member` |
| Costume Designer | `member` |
| Set & Prop Designer | `member` |
| Light Designer | `member` |
| Sound Designer | `member` |
| Publicity | `member` |
| Dramaturg | `member` |

### Seeded profiles / project_members (agree with the map)

| employee_id | position (`*.department`) | permission (`role` / `project_role`) |
| --- | --- | --- |
| WH-01-001 Mira Chen | Production Manager | `project_lead` |
| WH-01-005 June Whitaker | Director | `admin` |
| WH-01-006 Caleb Ross | Actor | `member` |

No other mapping tables, triggers, or RLS SQL bodies are exposed via PostgREST (only `match_document_chunks` + `rls_auto_enable` RPCs). Anon without user JWT sees empty rows (RLS on).

**Do not** copy `position_role_map` onto chunks as ACL. Permission stays on profiles/members; position on chunks is **relevance**.

---

## 2. Field mapping (correct columns)

| Concept | Source | Live destination | Status |
| --- | --- | --- | --- |
| Position / organizational_role | JSONL (always equal) | `metadata.position`, `metadata.organizational_role` | Preserved; 416/416 employee chunks |
| employee_id | JSONL | `document_chunks.employee_id` | OK |
| owner_employee_id | JSONL | `metadata.owner_employee_id` (`ownership_is_acl=false`) | OK — **not ACL** |
| season / production / venue | JSONL | same columns | OK |
| Production → project | `production` + live `projects` | `documents.project_id` | **Fixed** 372 docs |
| Legacy tier | JSONL `system_role` Manager/Member | `document_chunks.system_role` | Kept; guards reject permission values |
| Permission | `position_role_map` / profiles | **not written on chunks** | Correct |
| Corpus department/access_level | legacy ACL bag still on rows | required on `documents` | **Blocked for new inventing** |

**Explicit refusals encoded in scripts:**

- No Position titles → `documents` / `document_chunks`.`department`
- No Manager/Member → admin/member/project_lead
- No deriving permission from chunk `system_role`
- No treating `owner_employee_id` / `access_level` as author permission

---

## 3. Dry-run evidence (before writes)

```
Loaded 742 embedded chunks — vectors_ok=True
Existing docs with source_doc_id=378; existing chunk_ids=742
docs_insert=0; chunks_insert=0 (skip-only; no vector overwrite)
project_id link plan: to_link=372 already=0 no_production=6 unknown=0
```

Artifacts: `embedding_recovery_dry_run.md`, `project_id_link_dry_run.md`.

---

## 4. What changed

### Docs

- Rewrote `docs/rag_c1/mapping_table.md` around live SoT (`position_role_map`, permission vs position vs legacy ACL, retrieval design, Person B blocker).

### Pipeline

- `ingest_documents.py`: Position/permission/legacy-tier constants; `assert_chunk_role_fields`; `map_access` labeled legacy-only; **`--upload` exits with Person B STOP** (no invented department/access_level).
- `supabase_upload_run.py`: same guards; reads live `position_role_map` into dry-run notes; refuses new ACL-bag inserts when pending > 0; adds `--link-project-ids`.

### DB (safe, non-embedding)

| Change | Count | Notes |
| --- | --- | --- |
| `documents.project_id` UPDATE | **372** | From live `projects.production`; 6 org docs without production left null |
| Chunk inserts / embedding updates | **0** | All 742 skipped by `chunk_id` |
| `department` / `access_level` PATCH | **0** | Person B blocker |
| Truncate / DDL / RLS | **0** | |

Post-apply check: linked 372/378; department histogram unchanged (still legacy ACL bag); employee metadata still has Position + owner fields.

---

## 5. Person B blockers (must resolve before further corpus auth writes)

1. **`documents.department` + `documents.access_level` (required)** — Live auth is `profiles.role` / `project_members.project_role` / `position_role_map`, not Partnerships/Finance/HR/General. C1 will **not** invent replacements, put craft titles into `department`, or empty required fields. Need the live expected vocabulary **or** confirmation these columns are deprecated leftovers under RLS.
2. **RLS policy text** — Not readable via PostgREST. Need how member / project_lead / admin scopes use `project_id` / `production` / `metadata.position` / legacy department columns.
3. **`document_chunks.system_role` vs `position_role_map.system_role`** — Same column name, different domains (Manager/Member vs admin/member/project_lead). Confirm whether chunk column should be ignored, cleared, or renamed later (DDL = Person B).

Until (1) is answered: **no new document/chunk uploads** that set department/access_level; metadata + `project_id` alignment only.

---

## 6. Retrieval design support (current)

| Need | Supported by |
| --- | --- |
| member: assigned production | `project_members` + `documents.project_id` / `production` |
| member: historical position-relevant knowledge | `metadata.position` / `organizational_role` across seasons |
| member: general institutional | org-level chunks (no position; 6 org docs without project_id) |
| project_lead: broader within production | permission on profile + production/`project_id` filter (RLS TBD by Person B) |
| admin: org-wide | `profiles.role=admin` (RLS TBD) |

Security split preserved in mapping docs/scripts: **position = relevance**, **permission = access scope**, **production = project context**.

---

## Next ask for Person B

Paste or document: (a) required values for corpus `department`/`access_level` under current RLS, or “ignore these columns”; (b) RLS predicates for the three permissions. Then C1 can resume uploads without inventing auth.
