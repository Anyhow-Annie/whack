# Person B classification upload report

**Date:** 2026-11-22  
**Mode:** Controlled UPDATE only — `department` / `access_level` / `subcategory`  
**Source plan:** stamped `chunks_with_embeddings.jsonl` + `person_b_mapping_dry_run_report.md`  
**Auth:** SERVICE_ROLE (secrets not printed)  
**Not done:** re-chunk, re-embed, truncate, delete, RLS/schema changes, profiles/project_members edits, Person B SQL migration

---

## Success

**YES.** Histograms match dry-run; IDs stable; sampled embeddings unchanged (768-d); counts **378 documents / 742 chunks**; **0** failures.

---

## Apply summary

| Target | Updated | Already matched (skip) | Failed |
| --- | ---: | ---: | ---: |
| `documents` (by `source_doc_id`) | **355** | 23 | **0** |
| `document_chunks` (by `chunk_id`) | **665** | 77 | **0** |

Fields written per row: `department`, `access_level`, `subcategory` only.

---

## Before → after

### Documents (378)

| | Before | After (= dry-run plan) |
| --- | --- | --- |
| **department** | General 323 · Partnerships 49 · HR 5 · Finance 1 | General 30 · Actor 84 · Set & Prop Designer 60 · Publicity 48 · PM/SM/Costume/Light/Sound/Dramaturg 24 each · Director 12 |
| **access_level** | All employees 371 · HR 5 · Partnerships 1 · Finance 1 | All employees 30 · same Position titles as department for the 348 position docs |

### Chunks (742)

| | Before | After (= dry-run plan) |
| --- | --- | --- |
| **department** | General 445 · HR 236 · Partnerships 58 · Finance 3 | General 326 · Actor 112 · Set & Prop Designer 60 · Publicity 48 · Stage Manager 40 · PM 32 · Dramaturg 32 · Costume/Light/Sound 24 · Director 20 |
| Legacy ACL leftovers | present | **0** docs / **0** chunks |

---

## Verification

| Check | Result |
| --- | --- |
| Document count | **378** |
| Chunk count | **742** |
| `source_doc_id` → `documents.id` unchanged | **0** changes |
| `chunk_id` → `document_chunks.id` unchanged | **0** changes |
| Live vs plan mismatches | **0** docs / **0** chunks |
| Histograms match dry-run plan | **true** |
| Embedding fingerprints (20 sampled chunks: dims + 3 probes) | **0** changed; all **768**-d |
| `profiles` / `project_members` | Unchanged (3/3 seed rows still PM→project_lead, Director→admin, Actor→member) |
| Failures / error list | **empty** |

---

## Notes

- Updates used PostgREST `PATCH` filtered by stable `source_doc_id` / `chunk_id`.
- Embedding columns were never included in PATCH bodies.
- Ready state from dry-run is now reflected in live corpus classification columns.
