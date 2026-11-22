# Embedding pilot report (C1 / 768)

**Generated:** 2026-11-22 10:15:16 UTC  
**Model:** `gemini-embedding-001` · `output_dimensionality=768` · task=`RETRIEVAL_DOCUMENT` · **L2-normalized**  
**Source:** reviewed `chunks.jsonl` embed-eligible rows (`include_in_embedding=true`)  
**Output:** `embedding_pilot.jsonl` (5 lines)  
**Supabase upload:** **no**  
**chunks.jsonl:** **unchanged**

## Selection (5 representatives)

| Label | chunk_id | document_type | chunk_type |
| --- | --- | --- | --- |
| org_policy | `ORG-001__c001_b64f917c59ed` | Organization Profile | section |
| meeting | `S1-03__c002_162f8ffff911` | Kickoff and Design Meeting Notes | topic_block |
| status | `S1-04__c001_cbd2645cf833` | Project Status Report | workstream_block |
| employee | `S1-EMP-WH-01-001-01__c001_88681d92ebe7` | Planning: Production Plan and Responsibility Agreement | section |
| closeout | `S1-EMP-WH-01-001-03__c001_07ab6e554ef5` | Closeout: Strike Closeout and Lessons Learned Memo | experience_block |

## Validation

| Label | dims=768 | finite | pre-L2 ‖v‖ | post-L2 ‖v‖ | L2≈1 |
| --- | --- | --- | ---: | ---: | --- |
| org_policy | PASS | PASS | 0.583391 | 1.0 | PASS |
| meeting | PASS | PASS | 0.583554 | 1.0 | PASS |
| status | PASS | PASS | 0.583451 | 1.0 | PASS |
| employee | PASS | PASS | 0.585814 | 1.0 | PASS |
| closeout | PASS | PASS | 0.584293 | 1.0 | PASS |

**Overall:** PASS

## Secret hygiene

- Loaded `GEMINI_API_KEY` from `.env` only (presence checked; value never logged).
- Pattern scan for Google API key / JWT-like strings in pilot JSONL: **CLEAN**.
- No Supabase keys written into pilot artifacts.

## Notes

- Vectors stored are **post-L2-normalization** (required for dims &lt; 3072).
- `embedding_text_used` truncated to 500 chars in JSONL for readability; full vector is complete.
- This pilot does **not** insert into `documents` / `document_chunks`.
