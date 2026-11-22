# Embedding recovery dry-run

**Generated:** 2026-11-22T15:44:58.190761+00:00
**Mode:** dry-run — no Supabase writes
**Vectors:** reused from `chunks_with_embeddings.jsonl` (no embedding API)

## Compatibility

**COMPATIBLE — safe to upload**

## Local vectors

| Check | Value |
| --- | ---: |
| Rows | 742 |
| Unique chunk_ids | 742 |
| Dupes | 0 |
| Missing embedding | 0 |
| dims ≠ 768 | 0 |
| Non-finite | 0 |
| L2 off | 0 |
| vectors_ok | True |

## Live DB (before upload)

- Existing `documents` with `source_doc_id`: **378**
- Existing `document_chunks.chunk_id`: **742**

## Planned writes

| Action | Count |
| --- | ---: |
| Documents to insert | 0 |
| Documents to reuse (skip) | 378 |
| Documents unresolved | 0 |
| Chunks to insert | 0 |
| Chunks to skip (already present) | 742 |
| Chunks unresolved | 0 |
| Chunks missing parent | 0 |

## Required metadata mappings (Person B confirmed)

| Field | Source | Notes |
| --- | --- | --- |
| `department` | classify_corpus | Position title OR `General` |
| `access_level` | classify_corpus | Position title (restricted) OR `All employees` |
| `subcategory` | classify_corpus | Stable filter slug |
| `system_role` | chunk field | Legacy Manager/Member only — never convert |
| `employee_id` | chunk field | When employee-level |
| `season`/`production`/`venue` | chunk field | Production assignment |
| `organizational_role` / `position` | chunk → `metadata` jsonb | Relevance; not permission |
| `embedding` | local JSONL vector | Reused; not regenerated |
| `chunk_id` / `source_doc_id` | preserved | Stable IDs |

### Document department histogram (classified)

| department | count |
| --- | ---: |
| Actor | 84 |
| Costume Designer | 24 |
| Director | 12 |
| Dramaturg | 24 |
| General | 30 |
| Light Designer | 24 |
| Production Manager | 24 |
| Publicity | 48 |
| Set & Prop Designer | 60 |
| Sound Designer | 24 |
| Stage Manager | 24 |

### Document access_level histogram (classified)

| access_level | count |
| --- | ---: |
| Actor | 84 |
| All employees | 30 |
| Costume Designer | 24 |
| Director | 12 |
| Dramaturg | 24 |
| Light Designer | 24 |
| Production Manager | 24 |
| Publicity | 48 |
| Set & Prop Designer | 60 |
| Sound Designer | 24 |
| Stage Manager | 24 |

### Chunk department histogram (all classified rows)

| department | count |
| --- | ---: |
| Actor | 112 |
| Costume Designer | 24 |
| Director | 20 |
| Dramaturg | 32 |
| General | 326 |
| Light Designer | 24 |
| Production Manager | 32 |
| Publicity | 48 |
| Set & Prop Designer | 60 |
| Sound Designer | 24 |
| Stage Manager | 40 |

### Chunk access_level histogram (all classified rows)

| access_level | count |
| --- | ---: |
| Actor | 112 |
| All employees | 326 |
| Costume Designer | 24 |
| Director | 20 |
| Dramaturg | 32 |
| Light Designer | 24 |
| Production Manager | 32 |
| Publicity | 48 |
| Set & Prop Designer | 60 |
| Sound Designer | 24 |
| Stage Manager | 40 |

## Schema notes

- OpenAPI: documents + document_chunks + position_role_map present; embedding=vector(768)
- Corpus department = position title OR General (Person B confirmed)
- Corpus access_level = position title OR All employees (Person B confirmed)
- Position also in metadata.position = metadata.organizational_role
- profiles.department = position; profiles.role = permission (admin|member|project_lead)
- position_role_map (live): {'Director': 'admin', 'Production Manager': 'project_lead', 'Stage Manager': 'project_lead', 'Actor': 'member', 'Set & Prop Designer': 'member', 'Publicity': 'member', 'Costume Designer': 'member', 'Light Designer': 'member', 'Sound Designer': 'member', 'Dramaturg': 'member'}
- chunk system_role = legacy Manager|Member — never overwrite/convert/use for ACL
- Permission never written to chunk metadata
- match_document_chunks RPC present (query_embedding required)
- Allowed corpus departments: ['Actor', 'Costume Designer', 'Director', 'Dramaturg', 'General', 'Light Designer', 'Production Manager', 'Publicity', 'Set & Prop Designer', 'Sound Designer', 'Stage Manager']
- Allowed corpus access_levels: ['Actor', 'All employees', 'Costume Designer', 'Director', 'Dramaturg', 'Light Designer', 'Production Manager', 'Publicity', 'Set & Prop Designer', 'Sound Designer', 'Stage Manager']
- Permission roles (profiles only): ['admin', 'member', 'project_lead']

## Vectors reused confirmation

- Embeddings read only from `chunks_with_embeddings.jsonl`
- No Gemini / embedding API call in this script path
- `metadata.vectors_reused=true` stamped on planned chunk rows
