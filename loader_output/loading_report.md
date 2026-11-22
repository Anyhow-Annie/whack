# WHACK document loader — loading report

**Generated:** 2026-11-22 03:28 UTC  
**Dataset:** `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/internal/dataset/WHACK_Organizational_Memory`  
**Corrected CSV:** `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/documents_fixed.csv`  

## Plain-language summary

All indexed Markdown documents loaded cleanly. Document IDs match the corrected CSV. Output is ready for the next stage (chunking / embeddings later).

## Counts

| Metric | Count |
|--------|------:|
| Markdown files discovered (in scope) | 378 |
| Documents loaded into JSONL | 378 |
| Unique Document IDs | 378 |
| Rows in corrected CSV | 378 |
| Helper / out-of-scope Markdown skipped | 2 |
| Missing metadata (partial) | 0 |
| Duplicate Document IDs | 0 |
| CSV ↔ Markdown mismatches (all kinds) | 0 |
| Parse / load failures | 0 |
| Employee docs resolved via employees.csv | 348 |
| Unknown Employee IDs (not in employees.csv) | 0 |

### By level

| Level | Count |
|-------|------:|
| organization | 6 |
| season | 24 |
| employee | 348 |
| unknown | 0 |

## Skipped helpers (no Document ID / navigation only)

- `00_Organization/README_START_HERE.md`
- `04_Indexes/MASTER_INDEX.md`

## Duplicate Document IDs

_None._

## Parse / load failures

_None._

## Missing metadata (expected blanks on ORG docs are still listed if flagged)

_None._

## CSV ↔ Markdown mismatches

- IDs only in Markdown (not in CSV): **0**
- IDs only in CSV (not loaded from Markdown): **0**
- Same ID, different path: **0**
- Shared field value differences: **0**
- Paths only in CSV: **0**
- Paths only in Markdown: **0**

### IDs only in Markdown

_None._

### IDs only in CSV

_None._

## Unknown Employee IDs

_None — every Employee ID matched employees.csv._

## Output files

- `documents.jsonl` — one JSON object per loaded document (includes `document_id` for citation)
- `loading_report.md` — this file

**Ready for next stage (chunking / embeddings):** YES
