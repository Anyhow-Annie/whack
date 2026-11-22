# Employee ownership metadata review (U-1)

**Audience:** reviewers who are new to this archive  
**Status:** Metadata for Person B — **not** live ACLs, auth, or RLS  
**Architecture:** `docs/WHACK_Theater_Role_Permission_Architecture.pdf` (Employee Artifacts + role tiers)

## Plain-language takeaway

Every employee artifact now carries clear labels for **who the record is about**, **who authored/owns it** (when the source says so), **job title**, and (when the PDF maps that title) **system tier**. Nothing here grants or denies login access. Peer-read of other people’s artifacts stays an **open policy decision** for Person B / the team.

## Field dictionary (keep these separate)

| Field | Meaning | Example |
| --- | --- | --- |
| `employee_id` | Assignment folder id the record is filed under | `WH-01-001` |
| `owner_employee_id` | Author/owner **only if** the document establishes it | same as `employee_id` when author names Mira Chen |
| `employee_name` | Display name from loader | `Mira Chen` |
| `organizational_role` | Job title (not a login tier) | `Production Manager` |
| `system_role` | Admin / Manager / Member **only** when the PDF maps that title | `Manager` |
| `production` | Show name | `Hamlet` |
| `project_id` | Explicit project id — **blank** in this corpus (titles exist; ids do not) | `""` |
| `season` | Production season | `2023-2024` |
| `document_type` | Artifact type | `Planning: Production Plan…` |
| `lifecycle_stage` | `01_Planning` / `02_Working` / `03_Closeout` from path/type | `01_Planning` |
| `source_path` | Relative Markdown path | `03_Employee_Records/…` |
| `ownership_unclear` | `true` + reason when owner cannot be established | none on this run for employee chunks |
| `ownership_is_acl` | Always `false` — reminder this is not an ACL | `false` |
| `peer_output_coordination_policy` | Always `open_decision` until Person B decides | `open_decision` |

Chunks **inherit** parent ownership context. No per-chunk ACL. No broader access than the parent document.

## Counts

| Metric | Count |
| --- | --- |
| Total chunks | **2207** |
| Employee-level chunks | **1807** |
| Employee chunks with `owner_employee_id` set | **1807** |
| Employee chunks with mapped `system_role` | **1807** |
| Chunks with `ownership_unclear=true` | **0** |
| `project_id` non-blank | **0** (none explicit in source) |
| Employee documents in loader | **348** |

### System role among employee chunks

| system_role | Chunks |
| --- | ---: |
| Manager | 339 |
| Member | 1468 |

### Lifecycle stage among employee chunks

| lifecycle_stage | Chunks |
| --- | ---: |
| 01_Planning | 699 |
| 02_Working | 508 |
| 03_Closeout | 600 |

## How ownership was decided (no invented IDs)

1. Start from loader metadata (`employee_id`, `employee_name`, `position`, `author`, `path`).
2. If `employee_name` (or id) appears in the **Author** line → set `owner_employee_id = employee_id`.
3. If the employee folder is present but author does not establish ownership → leave `owner_employee_id` blank and set `ownership_unclear=true` with a reason.
4. Map `organizational_role` → `system_role` **only** via the Architecture PDF’s explicit title→tier list. Never invent Admin/Manager/Member from guesswork.
5. Org- and season-level chunks keep blank employee ownership (they are not single-employee artifacts).

On this corpus, all 348 employee documents name the employee in the author line, so every employee chunk received a clear `owner_employee_id`.

## What was deliberately *not* done

- No auth, RLS, or per-employee permission rows.
- No change to proxy `permissions` / `access_scope` / `permission_status` because of ownership.
- No invented `project_id` values from free-text Project titles.
- No claim that Member may (or may not) read peer artifacts — left open for Person B.

## Unresolved policy items (for Person B / team)

| ID | Topic | Why open |
| --- | --- | --- |
| U-1-P1 | **Peer-output coordination** | PDF says Members may view peer outputs needed for coordination. Document-level Member `read` is a proxy pattern only; binding “own vs peer” needs a login model Person B owns. |
| U-1-P2 | **Own-record edit enforcement** | Member edit on member-tier artifacts means “authorship pattern,” not a named employee ACL. |
| U-1-P3 | **project_id** | No explicit project ids in source; free-text `project` remains informational only. |

## Outputs touched

| File | Role |
| --- | --- |
| `/cursor/stores/self/docs/chunker_output/chunks.jsonl` | Ownership fields on every chunk |
| `/cursor/stores/self/docs/chunker.py` | Deterministic enrichment on re-run |
| `/cursor/stores/self/docs/access_policy/proxy_access_assignments.jsonl` | Ownership **notes** only (permissions unchanged) |
| This report | Review summary |

## Beginner check

Ask: “If we deleted every permission matrix tomorrow, would these fields still be useful labels?”  
**Yes** — they describe filing ownership. They do **not** answer “may user X open this file?”
