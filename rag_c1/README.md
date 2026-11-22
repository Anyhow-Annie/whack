# C1 RAG ingest + chat (Person B `document_chunks` @ 768)

Beginner path: turn WHACK Markdown / `documents.jsonl` into Supabase `documents` + `document_chunks` rows with **768-dim** Gemini embeddings, then ask questions with RLS-aware retrieval.

> **Separate from** the Person C `knowledge_chunks` handoff (that proposal used **1536**).  
> **This C1 path follows Person B’s live schema: `vector(768)`.**

## What you get

| File | Role |
| --- | --- |
| `ingest_documents.py` | Chunk (~800 / overlap 100), map enums, dry-run by default; `--upload` inserts |
| `rag_chat.py` | CLI + FastAPI `/chat` — embed query, `match_document_chunks`, `gemini-2.5-flash` |
| `mapping_table.md` | WHACK → `department` / `access_level` / `subcategory` rules |
| `.env.example` | Placeholders only |
| `requirements.txt` | Python deps |

## Person B schema (do not invent columns)

- **documents:** `id`, `title`, `content`, `department`, `access_level`, `subcategory`
- **document_chunks:** `id`, `document_id`, `chunk_index`, `content`, `embedding vector(768)`, `department`, `access_level`, `subcategory`
- **RPC:** `match_document_chunks(query_embedding vector(768), match_threshold float, match_count int, filter_subcategory text)`

**Enums**

- `department`: Partnerships · Finance · HR · General  
- `access_level`: Partnerships · Finance · HR · All employees  

## Setup (once)

```bash
cd /cursor/stores/self/docs/rag_c1
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# fill GEMINI_API_KEY, SUPABASE_URL, keys — never commit .env
```

Person B must enable **pgvector** and create the tables/RPC before `--upload` can succeed. This package does **not** run DDL or change RLS.

## Dry-run (default — safe)

No Gemini calls, no Supabase writes:

```bash
python3 ingest_documents.py
python3 ingest_documents.py --limit 5
```

Reads `../loader_output/documents.jsonl` by default. Optional Markdown walk:

```bash
python3 ingest_documents.py --from-markdown --dataset ../../internal/dataset/WHACK_Organizational_Memory
```

Writes `dry_run_report.json` with mapping counts and unresolved docs.

## Upload (only with keys)

```bash
# .env must have GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
python3 ingest_documents.py --upload
python3 ingest_documents.py --upload --limit 2   # small smoke test
```

Flow: insert **documents** with service role → embed chunks (`RETRIEVAL_DOCUMENT`, 768, **L2-normalize**) → insert **document_chunks**.

Unresolved mappings are **skipped** (never invented). See `mapping_table.md`.

## Chat / retrieve

Retrieval uses **anon key + user JWT** (not service role) so RLS can hide other departments.

```bash
export SUPABASE_USER_JWT='eyJ...'   # signed-in user access token
python3 rag_chat.py "Who approves purchases over \$250?"
```

API:

```bash
uvicorn rag_chat:app --reload --app-dir .
curl -s localhost:8000/chat \
  -H "Authorization: Bearer $SUPABASE_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"question":"What venues does WHACK use?","match_count":6}'
```

Query embeddings use task type **`RETRIEVAL_QUERY`**, same 768 dims + L2 normalize. Answers use **`gemini-2.5-flash`** with chunk citations.

## Mapping rules (summary)

| Kind | department | access_level |
| --- | --- | --- |
| Donors/vendors (`ORG-003`) | Partnerships | Partnerships |
| Purchase/sponsorship approval (`ORG-004`) | Finance | Finance |
| Directory / season roster | HR | HR |
| Publicity employee docs | Partnerships | All employees |
| Most org/season/employee production docs | General | All employees |
| No confident rule | **unresolved — skip** | |

Full table: [`mapping_table.md`](./mapping_table.md).

## Open gaps

1. Supabase tables/RPC/pgvector must already exist (Person B) — this repo only talks to them.  
2. `subcategory` slugs are Person C proposals; rename if Person B prefers different filters.  
3. WHACK Admin/Manager/Member tiers ≠ `department`/`access_level` enums — C1 does not implement those tiers.  
4. No automatic sign-in helper; you must supply a real user JWT for chat.  
5. Does not read or overwrite `chunker_output/chunks.jsonl` (that archive stays separate).  
6. Sensitive paragraphs inside otherwise “All employees” docs are not split into stricter rows (would invent ACLs).

## Related docs

- Schema handoff (knowledge_chunks / 1536 proposal): `../knowledge_chunks_schema_handoff.md`  
- Loader output: `../loader_output/documents.jsonl`  
- Access metadata (proxy, not RLS): `../access_policy/person_b_access_metadata_handoff.md`
