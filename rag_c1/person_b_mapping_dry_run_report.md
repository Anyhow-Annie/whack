# Person B mapping dry-run report

**Date:** 2026-11-22  
**Mode:** Dry-run only — **no upload**, no re-chunk/re-embed/truncate/delete/overwrite vectors, no RLS/schema changes, no profiles/project_members edits  
**Contract:** Person B confirmed position_role_map + corpus department/access_level rules  
**Keys:** `docs/rag_c1/.env` (shapes only; secrets not printed)

---

## 1. Ready for controlled upload?

**YES — classification-complete, with two pre-apply notes.**

| Gate | Result |
| --- | --- |
| All 378 docs classified | **378 resolved / 0 ambiguous** |
| Vectors untouched | **742 × 768** still valid (`emb_ok`) |
| Legacy `system_role` preserved | Manager 92 · Member 324 · empty 326 — not converted |
| Permission kept off chunks | No admin/member/project_lead in chunk `system_role` or permission metadata keys |
| Old ACL upload STOP removed | Scripts use Person B classifier |
| Live rows still on legacy ACL | **355/378** docs differ from new plan → controlled apply = **UPDATE** `department`/`access_level` (not re-insert) |
| SELECT-policy SQL in store | **NOT FOUND** (inspect-only; see §6) |

Do **not** auto-upload. Next step (explicit ask): dry-run UPDATE plan for existing `source_doc_id` / `chunk_id` rows, then controlled PATCH.

---

## 2. Live position ↔ permission (confirmed)

Inspected `position_role_map` via SERVICE_ROLE: **10/10 rows**, matches Person B table exactly.

| position | permission |
| --- | --- |
| Director | admin |
| Production Manager | project_lead |
| Stage Manager | project_lead |
| Actor / Costume Designer / Set & Prop Designer / Light Designer / Sound Designer / Publicity / Dramaturg | member |

Field distinctions honored in pipeline:

| Field | Meaning |
| --- | --- |
| `profiles.department` / `project_members.department` | position |
| `profiles.role` / `project_members.project_role` | permission |
| `position_role_map.system_role` | permission |
| `document_chunks.system_role` | legacy Manager/Member only |

---

## 3. Field mapping implemented

| Source | Destination | Rule |
| --- | --- | --- |
| Position-specific docs | `department` = Position; `access_level` = Position | Craft knowledge |
| Org/season general | `department` = `General`; `access_level` = `All employees` | Institutional / season-wide |
| `position` / `organizational_role` | `metadata.*` (must agree) | Relevance; not permission |
| `employee_id` | column | Preserved |
| `owner_employee_id` | metadata; `ownership_is_acl=false` | Not ACL |
| `season` / `production` / `venue` / `project_id` | columns | Project context (372 docs already linked) |
| `system_role` | column unchanged | Never overwrite/convert/use for ACL |
| Permission | profiles / `position_role_map` only | Never on chunk metadata |

Chunks inherit document classification.

---

## 4. What changed (pipeline / local JSONL only)

| Artifact | Change |
| --- | --- |
| `mapping_table.md` | Rewritten to Person B confirmed contract |
| `ingest_documents.py` | `classify_corpus` / updated `map_access`; removed old ACL STOP; enums = Position\|General / Position\|All employees |
| `supabase_upload_run.py` | Uses new classifier; removed Person B ACL invent STOP; dry-run histograms updated |
| `docs/chunker_output/chunks.jsonl` | Added `department`, `access_level`, `subcategory`, `classification_status`, `classification_reason` (**1120** rows; text/embeddings untouched) |
| `docs/rag_c1/chunks_with_embeddings.jsonl` | Same classification fields (**742** rows; **vectors unchanged**) |
| Live Supabase | **No writes this turn** |

---

## 5. Classification histograms (planned)

### Documents (378)

| department | count | access_level | count |
| --- | ---: | --- | ---: |
| General | 30 | All employees | 30 |
| Actor | 84 | Actor | 84 |
| Set & Prop Designer | 60 | Set & Prop Designer | 60 |
| Publicity | 48 | Publicity | 48 |
| Production Manager | 24 | Production Manager | 24 |
| Stage Manager | 24 | Stage Manager | 24 |
| Costume Designer | 24 | Costume Designer | 24 |
| Light Designer | 24 | Light Designer | 24 |
| Sound Designer | 24 | Sound Designer | 24 |
| Dramaturg | 24 | Dramaturg | 24 |
| Director | 12 | Director | 12 |

### Embed-eligible chunks (742)

| department | count |
| --- | ---: |
| General | 326 |
| Actor | 112 |
| Set & Prop Designer | 60 |
| Publicity | 48 |
| Stage Manager | 40 |
| Production Manager | 32 |
| Dramaturg | 32 |
| Costume / Light / Sound Designer | 24 each |
| Director | 20 |

### Sample resolutions

| doc | department | access_level |
| --- | --- | --- |
| ORG-001 Profile | General | All employees |
| ORG-002 Directory | General | All employees |
| ORG-003 Donors | General | All employees |
| ORG-004 Approval | General | All employees |
| S1-01 Event Brief | General | All employees |
| S1-06 Season Roster | General | All employees |
| S1-EMP-WH-01-001-01 (PM) | Production Manager | Production Manager |
| S1-EMP-WH-01-005-01 (Director) | Director | Director |
| S1-EMP-WH-01-006-01 (Actor) | Actor | Actor |

**Note:** ORG-002/003/004 and season rosters move off legacy HR/Partnerships/Finance bags to General/All employees under the confirmed org/season-general rule (not “invented for missing position”).

---

## 6. SQL migration inspection (no execute)

**Search:** store-wide for `*.sql`, `*migrat*`, `*rls*`, and Markdown containing `CREATE POLICY` + documents/chunks.

**Result:** **No Person B SELECT-policy migration file found** in `docs/`, `docs/access_policy/`, `uploads/`, `artifacts/`, or `internal/`.  
Only narrative mentions (e.g. `schema_correction_impact_report.md` noting missing policy SQL).

**Ingestion vs expected RLS (inferred from contract, not from SQL text):**

| Ingestion produces | Assumed RLS need |
| --- | --- |
| `department` ∈ Position titles for craft docs | Cross-season position match for members |
| `department=General` + `access_level=All employees` | Readable as general institutional |
| `production` / `project_id` | Assigned-production scope |
| `metadata.position` | Relevance ranking / optional filters |
| `system_role` Manager/Member | **Must not** drive ACL |

**Mismatch risk without SQL:** cannot verify predicates (e.g. whether RLS reads `department` vs `metadata.position`, or still expects legacy Partnerships/HR/Finance). **Flag for Person B:** paste/locate the SELECT-policy migration in the store before apply.

---

## 7. Ambiguous docs for review

**None.** `ambiguous_docs = 0` on both JSONL files.

---

## 8. Dry-run validation checklist

| Check | Result |
| --- | --- |
| position == organizational_role | **0** disagreements (1120 / 742) |
| system_role ∈ {Manager, Member, empty} | **Pass** |
| No permission values in chunk system_role | **Pass** |
| No Partnerships/Finance/HR written by new classifier | **Pass** |
| General always paired with All employees | **Pass** |
| Position-restricted: department == access_level | **Pass** |
| ownership_is_acl false | **Pass** (0 true) |
| Embedding dims 768 / vectors_ok | **Pass** |
| `supabase_upload_run.py --dry-run` | compatible=True; docs_insert=0; chunks_insert=0; ambiguous_docs=0 |
| Live vs planned department/access_level | **355** docs differ (expected until UPDATE apply) |
| profiles / project_members | **Not modified** |

---

## Next controlled step (not done)

1. Obtain/confirm Person B SELECT-policy SQL in store (or confirm live RLS already matches §3).  
2. Dry-run PATCH plan: UPDATE `documents`/`document_chunks` `department`+`access_level`(+`subcategory`) by `source_doc_id`/`chunk_id` — **no embedding column touches**.  
3. Apply only after explicit approval.
