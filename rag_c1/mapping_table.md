# WHACK → live Supabase field mapping (C1)

**Source of truth:** live Supabase schema + Person B confirmed auth contract.  
**Rule:** Position ≠ permission. Classify every document explicitly before upload. Never invent `General` merely because position is missing — flag ambiguous for review.

## Canonical concepts

| Concept | Values | Live location |
| --- | --- | --- |
| **Organizational position** | Director, Production Manager, Stage Manager, Actor, Costume Designer, Set & Prop Designer, Light Designer, Sound Designer, Publicity, Dramaturg | `profiles.department`, `project_members.department`; chunk `metadata.position` = `metadata.organizational_role` |
| **Permission / access role** | `admin` \| `member` \| `project_lead` | `profiles.role`, `project_members.project_role` |
| **Live position→permission** | see table | `position_role_map(position PK, system_role)` — values are **permissions** |
| **Legacy chunk tier** | `Manager` \| `Member` \| empty | `document_chunks.system_role` — **never** overwrite / convert / use for ACL |
| **Corpus department** (required) | Position title **or** `General` | `documents.department`, `document_chunks.department` |
| **Corpus access_level** (required) | Position title (restricted) **or** `All employees` | `documents.access_level`, `document_chunks.access_level` |
| **Production context** | season + production (+ venue) | columns + `documents.project_id` → `projects.id` |

### Confirmed `position_role_map`

| position | permission (`system_role` column) |
| --- | --- |
| Director | `admin` |
| Production Manager | `project_lead` |
| Stage Manager | `project_lead` |
| Actor | `member` |
| Costume Designer | `member` |
| Set & Prop Designer | `member` |
| Light Designer | `member` |
| Sound Designer | `member` |
| Publicity | `member` |
| Dramaturg | `member` |

Use **only** for employee permission seeding. Never copy onto chunks as ACL. Never derive from chunk `system_role` (Manager/Member).

## Corpus `department` / `access_level` rules (Person B confirmed)

| Knowledge type | `department` | `access_level` |
| --- | --- | --- |
| Position-specific craft knowledge | that Position title | same Position title |
| Season-wide / org-wide general institutional | `General` | `All employees` |

Classification must use **source content + metadata** (`level`, `document_type`, `position` / `organizational_role`, path).  
Do **not** rely on DB defaults. Do **not** invent `General` just because position is empty — **flag ambiguous**.  
Chunks **inherit** the parent document’s classification.

### Resolved patterns

| Source pattern | department | access_level | subcategory |
| --- | --- | --- | --- |
| ORG-001…ORG-006 (org institutional) | General | All employees | org_* / donors_vendors / … |
| Season Event Brief / lessons / meeting / status / change log | General | All employees | event_brief / … |
| Season Employee Roster | General | All employees | season_roster |
| Employee artifacts with Position | Position | Position | employee_* / publicity |

### Ambiguous → review (no upload invent)

Employee-level without usable Position; season-level without general-type match and without Position; unknown Position strings.

## Chunk → `document_chunks` mapping

| Local field | Live destination | Notes |
| --- | --- | --- |
| classified `department` / `access_level` / `subcategory` | same columns | Inherit from document |
| `position` | `metadata.position` | Must equal `organizational_role` |
| `organizational_role` | `metadata.organizational_role` | Relevance, not permission |
| `employee_id` | `employee_id` | |
| `owner_employee_id` | `metadata.owner_employee_id` | Not ACL (`ownership_is_acl=false`) |
| `season` / `production` / `venue` | same columns | Project context |
| `system_role` | `system_role` | Legacy Manager/Member only |
| `chunk_id` / `document_id` | `chunk_id` / `source_doc_id` | Stable ids |
| embedding vector | `embedding` | Reuse; no silent overwrite |

**Never:** map Manager/Member → admin/member/project_lead; put permission on chunk metadata; treat `owner_employee_id` as ACL; modify profiles/project_members from chunk ingest.

## Retrieval design

| Permission | Access scope | Relevance | Project context |
| --- | --- | --- | --- |
| `member` | assigned production + general institutional | own craft via department/position metadata across seasons | `project_members` + `production` / `project_id` |
| `project_lead` | broader across positions within assigned production | position still relevance | same |
| `admin` | org-wide | optional ranking | all projects |

Security split: **position = relevance**, **permission = access scope**, **production = project context**.

## SQL migration (Person B SELECT policy)

Person B supplied a SELECT-policy migration for cross-season position retrieval. **Inspect only** in this workstream — do not execute/modify. See dry-run report for locate/mismatch notes.
