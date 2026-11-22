# Demo retrieval validation (Actor E2E)

**Date:** 2026-11-22  
**Mode:** Emergency validation — no schema/RLS/embedding/chunk/classification changes  
**Store:** `/cursor/stores/bc-afe852e3-2de1-4b0c-9c98-20338788c02b/`  
**Priority:** One successful Actor workflow

---

## Verdict

**PASS — Actor retrieval workflow succeeded end-to-end.**

| Step | Result |
| --- | --- |
| Actor session (Caleb Ross / WH-01-006) | OK |
| Query embed (`gemini-embedding-001`) | OK — **768-d**, L2≈1.0 |
| `match_document_chunks` (user JWT + anon) | OK — **6** hits @ threshold 0.2 |
| Sources present | OK — `chunk_id`, `source_doc_id`, `content`, `similarity` |
| Passed to generator | OK |
| Final response format | OK — answer + citations `[n]` + chunks payload |

---

## Pipeline inspected

`docs/rag_c1/rag_chat.py`:

1. NL query → `embed_query` (RETRIEVAL_QUERY, 768, L2)  
2. `user_supabase_client(anon, user_jwt)` → `match_chunks` / RPC `match_document_chunks`  
3. Evidence block with source ids → `answer_with_gemini`  
4. Frontend shape: `{question, answer, chunks}` (`ChatResponse`)

---

## Actor account used

| Field | Value |
| --- | --- |
| Name | Caleb Ross |
| employee_id | WH-01-006 |
| email | calebross@whack.example |
| profiles.role | `member` |
| profiles.department | `Actor` |
| auth user id | `b263e937-f9c8-41ab-af07-f60aaebd17b3` |

**Session mint (demo-only, not stored in report):** admin `generate_link` + `/auth/v1/verify` with publishable anon key → short-lived access JWT.  
Note: `.env` `SUPABASE_USER_JWT` remains a non-JWT placeholder (len 36); E2E minted a live token in-process instead of relying on that value.

**Query:**  
“I'm preparing for a new production. What previous production experience, decisions, and practical guidance should I learn from?”

---

## Retrieved sources (6)

| # | source_doc_id | subcategory | similarity | type |
| --- | --- | ---: | ---: | --- |
| 1 | S3-02 | previous_season_lessons | 0.733 | Previous Season Proposal and Lessons |
| 2 | S2-02 | previous_season_lessons | 0.731 | Previous Season Proposal and Lessons |
| 3 | S4-02 | previous_season_lessons | 0.726 | Previous Season Proposal and Lessons |
| 4 | ORG-005 | institutional_lessons | 0.717 | Four Season Institutional Lessons |
| 5 | S1-02 | previous_season_lessons | 0.715 | Previous Season Proposal and Lessons |
| 6 | ORG-005 | institutional_lessons | 0.713 | Four Season Institutional Lessons |

These are **General / All employees** institutional & season-lesson docs (appropriate for a cross-production prep question). Actor craft rows were not the top semantic hits for this wording; RLS still allowed the Actor JWT to retrieve them.

---

## Failures encountered & smallest safe fix

### A. Missing Python deps in environment
- **Step:** import / embed  
- **Error:** `ModuleNotFoundError: google` / `fastapi`  
- **File:** runtime env (not code defect)  
- **Category:** environment  
- **Fix:** `pip install -r docs/rag_c1/requirements.txt` (no product code change)

### B. Answer model unavailable
- **Step:** `answer_with_gemini` / generator  
- **Error:** `404` `gemini-2.5-flash` “no longer available to new users”; `gemini-3.8-flash` often `503` high demand  
- **File/function:** `rag_chat.py` → `ANSWER_MODEL` / `answer_with_gemini`  
- **Category:** external model availability  
- **Smallest safe fix applied:**  
  - Default `ANSWER_MODEL = "gemini-3.5-flash-lite"`  
  - Fallback list + short retries on 503 in `answer_with_gemini`  
  - No schema/RLS/embedding/classification changes

### C. Placeholder user JWT in `.env`
- **Step:** CLI auth if using `SUPABASE_USER_JWT` as-is  
- **Error:** value is UUID-shaped (len 36), not an access token  
- **Category:** config  
- **Fix for this demo:** mint Actor session via Auth admin API for the test run (not written into reports). For lasting CLI demos, replace `SUPABASE_USER_JWT` with a real access token or a small mint helper.

---

## Response format check

- Answer length: **~3309** chars  
- Citations present: **yes** (`[1]`, `[2]`, …)  
- Chunks returned to caller: **6**, each with non-empty `content`  
- Matches FastAPI `ChatResponse` contract used by frontend

---

## Out of scope / unchanged

No changes to: Supabase schema, RLS, embeddings, chunk text, classification columns, profiles, project_members.
