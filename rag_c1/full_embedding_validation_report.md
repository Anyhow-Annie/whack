# Full embedding validation report

**Generated:** 2026-11-22 10:34:51 UTC  
**Model:** `gemini-embedding-001` · dims=768 · task=`RETRIEVAL_DOCUMENT` · L2-normalized  
**Source:** `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/chunker_output/chunks.jsonl` (`include_in_embedding==true` only)  
**Output:** `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/chunks_with_embeddings.jsonl`  
**Checkpoint:** `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/full_embedding_checkpoint.json`  
**Failures file:** `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/docs/rag_c1/full_embedding_failures.jsonl`  
**Supabase upload:** no  
**chunks.jsonl:** unchanged  

## Preflight

| Check | Result |
| --- | --- |
| Pilot PASS (5×768, L2≈1) | PASS |
| GEMINI_API_KEY present in `.env` | PASS (value not logged) |
| Total chunks | 1120 |
| Embed-eligible | 742 |
| Excluded (headers / flag false) | 378 |

## Results

| Metric | Count |
| --- | ---: |
| Success (valid embedding written) | 742 |
| Failed (recorded, not silent) | 0 |
| Missing (neither success nor failed) | 0 |
| Excluded from job | 378 |
| Oversized / truncation notes | 7 |
| Resume skipped (already valid) | 521 |
| Newly embedded this run | 221 |

## Vector checks (success rows)

| Check | Result | Count bad |
| --- | --- | ---: |
| dims == 768 | PASS | 0 |
| all finite | PASS | 0 |
| L2 norm ≈ 1 | PASS | 0 |
| secret pattern scan (metadata sample) | CLEAN | — |

## Failed chunk_ids

_None._

## Oversized / truncation notes

- `S1-EMP-WH-01-029-03__c001_3a910b2ddbcc` — 429 RESOURCE_EXHAUSTED. {'error': {'code': 429, 'message': 'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://aistudio.google.com/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Q (chars=1461)
- `S2-01__c001_177c37855f11` — 429 RESOURCE_EXHAUSTED. {'error': {'code': 429, 'message': 'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://aistudio.google.com/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Q (chars=1904)
- `S2-01__c002_2cfb0986f536` — 429 RESOURCE_EXHAUSTED. {'error': {'code': 429, 'message': 'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://aistudio.google.com/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Q (chars=1017)
- `S2-01__c003_2439cc971f5f` — 429 RESOURCE_EXHAUSTED. {'error': {'code': 429, 'message': 'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://aistudio.google.com/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Q (chars=955)
- `S2-02__c001_dcdc91041944` — 429 RESOURCE_EXHAUSTED. {'error': {'code': 429, 'message': 'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://aistudio.google.com/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Q (chars=944)
- `S2-02__c002_c9936a65f8a5` — 429 RESOURCE_EXHAUSTED. {'error': {'code': 429, 'message': 'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://aistudio.google.com/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Q (chars=1263)
- `S2-02__c003_b99a21575f31` — 429 RESOURCE_EXHAUSTED. {'error': {'code': 429, 'message': 'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://aistudio.google.com/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Q (chars=1054)

## Overall

**PASS — ready for human approval before any Supabase upload**

Elapsed this run: 336.1s
