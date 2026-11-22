# Classification patch execution report

**Date:** 2026-11-22  
**Command:** `python3 patch_classification.py --apply` (from `docs/rag_c1/`)  
**Prior dry-run:** `docs/rag_c1/classification_patch_dry_run.md` (PASS)  
**Auth:** SERVICE_ROLE (secrets not printed)  
**Scope:** UPDATE `department` / `access_level` only by `source_doc_id` / `chunk_id`

---

## 1. Success gate

**YES — apply completed with integrity verified.**

Pre-checks re-ran and PASSED before apply. No rows needed changing (live already matched Person B plan from the earlier controlled upload). Zero failures.

---

## 2. Apply summary

| Target | Updated | Skipped (already match) | Failed |
| --- | ---: | ---: | ---: |
| `documents` | **0** | **378** | **0** |
| `document_chunks` | **0** | **742** | **0** |

No INSERT / DELETE / UPSERT / TRUNCATE. Embedding / metadata / `system_role` / profiles / RLS untouched.

---

## 3. Live counts

| Table | Count |
| --- | ---: |
| WHACK `documents` (`source_doc_id` set) | **378** |
| `document_chunks` | **742** |
| Planned docs / chunks in stamped JSONL | **378 / 742** |
| Missing planned IDs live | **0 / 0** |

---

## 4. Histograms (live = plan)

### Documents

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

### Chunks

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

`histograms_match_plan`: **true** · live vs plan mismatches: **0** docs / **0** chunks · legacy ACL leftovers: **0**

---

## 5. ID stability

| Check | Result |
| --- | --- |
| Apply changed any `documents.id` | **No** (0 PATCH bodies executed) |
| Apply changed any `document_chunks.id` | **No** |
| Coverage of all planned `source_doc_id` / `chunk_id` | **Complete** |

---

## 6. Embedding integrity

| Check | Result |
| --- | --- |
| Sampled live embeddings | **20 / 20** = 768-d |
| Embedding columns written | **No** (not in PATCH body; no PATCHes issued) |
| Bad dims in sample | **0** |

---

## 7. Non-goals preserved

| Guard | Result |
| --- | --- |
| `system_role` still Manager/Member/empty only | empty 326 · Member 324 · Manager 92 · permission leaks **0** |
| Enum violations (corpus rules) | **0** |
| `profiles` (3) | unchanged — PM→project_lead, Director→admin, Actor→member |
| `project_members` (3) | unchanged (same triad) |
| RLS / schema / SQL migration | not executed |

---

## 8. Final verdict

| Item | Status |
| --- | --- |
| Dry-run gate before apply | PASS |
| `--apply` exit | **0** |
| Updates needed | **None** (idempotent no-op) |
| Corpus classification aligned to Person B plan | **Yes** |
| Ready for downstream retrieval testing | **Yes** |

**Conclusion:** Approved `--apply` ran safely; live corpus already correct, so all rows skipped. Integrity checks confirm 378/742, plan match, 768-d vectors, and untouched profiles/`system_role`.
