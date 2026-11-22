# Classification patch dry-run

**Generated:** 2026-11-22T16:18:04.536246+00:00
**Mode:** dry-run — no Supabase writes
**Patch fields:** `department`, `access_level` only
**Keys:** `source_doc_id` (documents), `chunk_id` (document_chunks)

## Gate

**PASS — safe for --apply after explicit approval**

## Env shapes (no secrets)

- SUPABASE_URL host: `ghuljonbyhwcnfpibiwk.supabase.co`
- SUPABASE_SERVICE_ROLE_KEY len=219 jwt=True

## Planned histograms (from stamped JSONL)

### Documents

| department | count | access_level | count |
| --- | ---: | --- | ---: |
| Actor | 84 | Actor | 84 |
| Costume Designer | 24 | Costume Designer | 24 |
| Director | 12 | Director | 12 |
| Dramaturg | 24 | Dramaturg | 24 |
| General | 30 | All employees | 30 |
| Light Designer | 24 | Light Designer | 24 |
| Production Manager | 24 | Production Manager | 24 |
| Publicity | 48 | Publicity | 48 |
| Set & Prop Designer | 60 | Set & Prop Designer | 60 |
| Sound Designer | 24 | Sound Designer | 24 |
| Stage Manager | 24 | Stage Manager | 24 |

### Chunks

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

## Live histograms (before patch)

- documents department: `{'General': 30, 'Stage Manager': 24, 'Production Manager': 24, 'Actor': 84, 'Director': 12, 'Set & Prop Designer': 60, 'Costume Designer': 24, 'Light Designer': 24, 'Sound Designer': 24, 'Publicity': 48, 'Dramaturg': 24}`
- documents access_level: `{'All employees': 30, 'Stage Manager': 24, 'Production Manager': 24, 'Actor': 84, 'Director': 12, 'Set & Prop Designer': 60, 'Costume Designer': 24, 'Light Designer': 24, 'Sound Designer': 24, 'Publicity': 48, 'Dramaturg': 24}`
- chunks department: `{'General': 326, 'Light Designer': 24, 'Sound Designer': 24, 'Production Manager': 32, 'Publicity': 48, 'Stage Manager': 40, 'Dramaturg': 32, 'Actor': 112, 'Director': 20, 'Costume Designer': 24, 'Set & Prop Designer': 60}`
- chunks access_level: `{'All employees': 326, 'Light Designer': 24, 'Sound Designer': 24, 'Production Manager': 32, 'Publicity': 48, 'Stage Manager': 40, 'Dramaturg': 32, 'Actor': 112, 'Director': 20, 'Costume Designer': 24, 'Set & Prop Designer': 60}`

## Update plan

| Target | To UPDATE | Already match (skip) |
| --- | ---: | ---: |
| documents | 0 | 378 |
| document_chunks | 0 | 742 |

### Sample doc updates (first 15)

_None — live already matches plan._

### Sample chunk updates (first 15)

_None — live already matches plan._

## Guarantees

- No INSERT / DELETE / UPSERT / TRUNCATE
- No writes to embedding / embedding_text / metadata / system_role / content
- No profiles / project_members / RLS / schema changes
- `--apply` requires explicit approval after this dry-run
