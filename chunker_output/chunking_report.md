# WHACK multi-strategy chunker — report

**Generated:** 2026-11-22 08:04 UTC  
**Input:** `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/loader_output/documents.jsonl`  
**Chunks:** `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/chunker_output/chunks.jsonl`  
**Classification:** `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/document_classification.jsonl`  

## Plain-language summary

Every loaded document was classified from its real structure, then split with a matching strategy. Chunks stay inside one document, keep required metadata (blank when unknown — never invented), and are evidence-only for later `source_ids`. Access labels are missing on this corpus: every document is flagged for review and **not** treated as public.

## What changed vs the simple chunker?

The first chunker mostly cut on `##` headings. This upgrade **chooses a strategy per document** (directory rows, approval rules, meeting decisions+actions, status workstreams, change-log decisions, reflections, structured sections, or adaptive paragraphs) so related evidence stays together for later retrieval and relationship work.

## Strategies (beginner guide)

| Strategy | Best for | How chunks look |
|----------|----------|-----------------|
| `record_based` | Directories, donor/vendor registers, rosters | One row/entry = one chunk |
| `rule_based` | Approval workflows / procedures | Rule blocks kept whole |
| `topic_based` | Meeting minutes | Decisions + action items kept together when size allows |
| `workstream_based` | Status / progress reports | Status, blockers, next actions stay coherent |
| `decision_based` | Change-control logs | One change row = request/decision/rationale/owner |
| `experience_based` | Reflections / lessons | Situation→lesson clusters when short |
| `section_based` | Briefs, plans, structured docs | One `##` section (split only if huge) |
| `adaptive_paragraph` | Unstructured narrative | Paragraph windows; light overlap only here |

Target size is flexible (~300–600 tokens). **Short complete records stay intact** even when under the band. Overlap is used only for continuous narrative (`adaptive_paragraph`).

## Classification summary (documents)

| Chosen strategy | Documents |
|-----------------|----------:|
| `record_based` | 6 |
| `rule_based` | 1 |
| `topic_based` | 4 |
| `workstream_based` | 120 |
| `decision_based` | 4 |
| `experience_based` | 117 |
| `section_based` | 126 |
| `adaptive_paragraph` | 0 |

## Chunk counts by strategy

| Strategy | Chunks |
|----------|-------:|
| `record_based` | 252 |
| `rule_based` | 8 |
| `topic_based` | 16 |
| `workstream_based` | 524 |
| `decision_based` | 28 |
| `experience_based` | 605 |
| `section_based` | 774 |
| `adaptive_paragraph` | 0 |

### Chunk types

| Chunk type | Count |
|------------|------:|
| `section` | 1209 |
| `document_header` | 378 |
| `experience_block` | 256 |
| `record_row` | 241 |
| `workstream_block` | 84 |
| `decision_record` | 16 |
| `topic_block` | 12 |
| `rule_block` | 11 |

## Counts & size

| Metric | Value |
|--------|------:|
| Documents read | 378 |
| Documents with ≥1 chunk | 378 |
| Total chunks | 2207 |
| Unique chunk_ids | 2207 |
| Duplicate chunk_ids | 0 |
| Approx tokens min / avg / max | 35 / 79 / 485 |
| Chunks in ~300–600 token band | 16 |
| Chunks below band (often short records — OK) | 2191 |
| Chunks above band | 0 |
| Docs missing access_policy/classification | 378 |

### Chunks by level

| Level | Chunks |
|-------|-------:|
| organization | 153 |
| season | 247 |
| employee | 1807 |

## Access policy flags

This dataset does **not** currently carry `access_policy` / `access_classification` on documents. The chunker therefore:

1. Leaves those fields **blank** on every chunk (does not invent a label).
2. Sets `access_policy_missing` / `access_review_required` to **true**.
3. Sets `access_assumed_public` to **false** — missing ≠ public.

**Documents flagged for access review:** 378 (all loaded docs in this run).

<details><summary>Document IDs flagged (click to expand)</summary>

_Every document_id in this corpus is flagged. See `document_classification.jsonl` field `access_review_required`._

</details>

## Validation

- Unique chunk_ids == total: **YES**
- All documents covered: **YES**
- Required fields present on every chunk: **YES**
- source_location.document_id matches: **YES**
- No missing-access chunk marked public: **YES**

### Duplicate chunk_ids

_None._

### Documents with no chunks

_None._

## Evidence only (PART 7 reminder)

| Term | Meaning |
|------|---------|
| Evidence chunk | Source text + location — **this output** |
| Proposed relationship | Later hypothesis; needs review — **not emitted** |
| Confirmed relationship | Accepted against evidence — **not emitted** |
| Unresolved | Missing/unclear endpoints — leave open |

High AI confidence ≠ confirmed. See `docs/downstream-relationship-architecture.md` for later-stage schemas.

## Readiness gate (formal)

See `chunk_validation_report.md`. Allowed categories: `NOT_READY` or `READY_FOR_REVIEW` only — never `APPROVED_FOR_EMBEDDING`.

Integrity snapshot in this report: **PASS** (human review still required for access labels + semantic judgment).

Next stage (out of scope here): embed `embedding_text`, filter by metadata (season, employee_id, strategy, access flags), cite `chunk_id` in any later `source_ids`. Do not extract graph edges in the embedding step.

## Output files

- `document_classification.jsonl` — one classification row per document
- `chunks.jsonl` — one evidence chunk per line (`chunk_text` + `embedding_text`)
- `chunking_report.md` — this file
- `chunking_samples.md` — before/after + strategy samples
- `chunk_validation_report.md` — integrity, retrieval dry-run, readiness
