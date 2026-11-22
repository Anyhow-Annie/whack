# Chunk refinement audit (v1 → v2)

**Generated:** 2026-11-22 08:21 UTC  
**Promotion:** 2026-11-22 08:36 UTC — **user-approved v2 promoted to main path**  

> **Promoted:** `chunks_v2.jsonl` → `chunks.jsonl` (1120 chunks).  
> **Backup:** pre-promotion v1 saved as `chunks_v1_backup.jsonl` (2207 chunks).  
> `chunks_v2.jsonl` retained as a copy of the promoted set.  
> No embeddings / Supabase. Original Markdown and `documents.jsonl` unchanged.

## Counts

| Metric | v1 backup (`chunks_v1_backup.jsonl`) | v2 / main (`chunks.jsonl` = `chunks_v2.jsonl`) |
|--------|--------------------:|-----------------------:|
| Total chunks | 2207 | 1120 |
| Unique chunk_ids | 2207 | 1120 |
| Token min | 35 | 35 |
| Token median | 61 | 84 |
| Token avg | 80.0 | 157.2 |
| Token max | 485 | 485 |
| Tokens < 75 | 1296 | 277 |
| Tokens > 500 | 0 | 0 |
| Tokens in 150–300 | 162 | 237 |
| document_header chunks | 378 | 378 |
| Headers with include_in_embedding=false | 0 | 378 |
| Non-header median tokens | 60 | 239 |
| Non-header avg tokens | 79.7 | 195.8 |
| Retrieval-flagged chunks (v2) | — | 742 |
| Retrieval-flagged median tokens | — | 239 |

## Integrity checks (v2)

| Check | Result |
|-------|--------|
| Unique chunk_ids | PASS (1120/1120) |
| All loader docs covered | PASS |
| No unknown document_ids | PASS |
| No cross-employee id mixes | PASS |
| `safety_topic` always list | PASS |
| Employee chunks keep employee_id | PASS (764/764) |

## What changed (refinement rules)

- Fold leading stubs (`Employee and assignment`, `Attendees`, `Purpose`, `Assigned role`, `Scope of responsibility`) into the next related section.
- Fold trailing completers (`Recordkeeping note`, `Questions for next rehearsal`, `Learning carried forward`, recommendations, `Open questions`, `Risks and controls`, `Care and return`, `Coordination and deadlines`) into the previous section.
- Merge adjacent undersized ordinary pairs when both are under ~150 tokens and combined ≤ ~450-token soft max.
- **Never** merge `document_header`, `record_row`, or `decision_record` (keeps decision+rationale / approval rows / directory rows intact).
- Strategies unchanged: employee section/record; org rule-based; meeting topic; status workstream; closeout experience.
- `safety_topic` normalized to always a list; no safety notification fields.
- `include_in_embedding` / `include_in_retrieval` = false on `document_header` (provenance kept; recommend exclude from embedding).

## Document header recommendation

All **378** `document_header` chunks are retained for provenance (title, document id, author, date, approval). **378** are flagged `include_in_embedding: false` and `include_in_retrieval: false`. Reviewers should keep them in the archive JSONL but omit them from embedding indexes unless a provenance-only retrieval path is desired.

## Representative before / after

### Employee planning (section) — `S1-EMP-WH-01-001-01`

**v1:**
_n=7_
- `S1-EMP-WH-01-001-01__c000_c9d3ba2f6388` tok=81 type=`document_header` | Production Plan and Responsibility Agreement — Mira Chen
- `S1-EMP-WH-01-001-01__c001_88681d92ebe7` tok=60 type=`section` | Employee and assignment
- `S1-EMP-WH-01-001-01__c002_1d38da953f3e` tok=82 type=`section` | Role alignment
- `S1-EMP-WH-01-001-01__c003_93c95faae072` tok=160 type=`section` | Production-specific operating plan
- `S1-EMP-WH-01-001-01__c004_0ef649a1b317` tok=124 type=`section` | Department deliverables
- `S1-EMP-WH-01-001-01__c005_5b3c399e7969` tok=62 type=`section` | Risks and controls
- `S1-EMP-WH-01-001-01__c006_03319b500828` tok=55 type=`section` | Recordkeeping note

**v2:**
_n=3_
- `S1-EMP-WH-01-001-01__c000_c9d3ba2f6388` tok=81 type=`document_header` | Production Plan and Responsibility Agreement — Mira Chen
- `S1-EMP-WH-01-001-01__c001_88681d92ebe7` tok=301 type=`section` | Employee and assignment
- `S1-EMP-WH-01-001-01__c002_8496ffd13671` tok=239 type=`section` | Department deliverables

### Employee working journal (workstream) — `S1-EMP-WH-01-006-02`

**v1:**
_n=5_
- `S1-EMP-WH-01-006-02__c000_53124f6ce079` tok=77 type=`document_header` | Scene and Rehearsal Journal — Caleb Ross
- `S1-EMP-WH-01-006-02__c001_d7244949df69` tok=53 type=`section` | Employee and assignment
- `S1-EMP-WH-01-006-02__c002_491e7b17e4e9` tok=160 type=`section` | Rehearsal focus
- `S1-EMP-WH-01-006-02__c003_631a64ef3b4d` tok=61 type=`section` | Questions for next rehearsal
- `S1-EMP-WH-01-006-02__c004_c17dee3e3f7a` tok=55 type=`section` | Recordkeeping note

**v2:**
_n=2_
- `S1-EMP-WH-01-006-02__c000_53124f6ce079` tok=77 type=`document_header` | Scene and Rehearsal Journal — Caleb Ross
- `S1-EMP-WH-01-006-02__c001_d7244949df69` tok=328 type=`section` | Employee and assignment

### Employee closeout (experience) — `S1-EMP-WH-01-006-03`

**v1:**
_n=5_
- `S1-EMP-WH-01-006-03__c000_5877e9781970` tok=77 type=`document_header` | Performance Reflection and Character Handoff — Caleb Ross
- `S1-EMP-WH-01-006-03__c001_d18643a94bd6` tok=53 type=`section` | Employee and assignment
- `S1-EMP-WH-01-006-03__c002_657c2f0272ea` tok=108 type=`experience_block` | Performance reflection
- `S1-EMP-WH-01-006-03__c003_67add3b30570` tok=58 type=`experience_block` | Learning carried forward
- `S1-EMP-WH-01-006-03__c004_f4bd196d05a9` tok=55 type=`section` | Recordkeeping note

**v2:**
_n=2_
- `S1-EMP-WH-01-006-03__c000_5877e9781970` tok=77 type=`document_header` | Performance Reflection and Character Handoff — Caleb Ross
- `S1-EMP-WH-01-006-03__c001_3fb09b4c38ce` tok=273 type=`experience_block` | Employee and assignment

### Org policy (rule) — `ORG-004`

**v1:**
_n=8_
- `ORG-004__c000_415f5cad26ce` tok=65 type=`document_header` | Sponsorship, Purchase, and Reimbursement Approval Workflow
- `ORG-004__c001_1fbb6c34a629` tok=40 type=`rule_block` | Purpose
- `ORG-004__c002_d8cc02266c26` tok=292 type=`rule_block` | Roles and decision rights
- `ORG-004__c003_11aae6e37166` tok=107 type=`rule_block` | Approval thresholds
- `ORG-004__c004_c0b4a9406094` tok=95 type=`rule_block` | Donor acknowledgment
- `ORG-004__c005_daf185da08e3` tok=64 type=`rule_block` | Required record fields
- `ORG-004__c006_bf474763618a` tok=109 type=`rule_block` | Exception handling
- `ORG-004__c007_1f191ad41aee` tok=81 type=`rule_block` | Institutional rationale

**v2:**
_n=4_
- `ORG-004__c000_415f5cad26ce` tok=65 type=`document_header` | Sponsorship, Purchase, and Reimbursement Approval Workflow
- `ORG-004__c001_1fbb6c34a629` tok=438 type=`rule_block` | Purpose
- `ORG-004__c002_224d057bb9ba` tok=158 type=`rule_block` | Donor acknowledgment
- `ORG-004__c003_ea598354e7c8` tok=190 type=`rule_block` | Exception handling

### Meeting notes (topic) — `S1-03`

**v1:**
_n=4_
- `S1-03__c000_fa19ffac6256` tok=75 type=`document_header` | Kickoff and Design Meeting Notes — Hamlet
- `S1-03__c001_d44b561e1d31` tok=36 type=`topic_block` | Attendees
- `S1-03__c002_162f8ffff911` tok=480 type=`topic_block` | Discussion and decisions
- `S1-03__c003_551e4ee722ac` tok=65 type=`topic_block` | Open questions

**v2:**
_n=4_
- `S1-03__c000_fa19ffac6256` tok=75 type=`document_header` | Kickoff and Design Meeting Notes — Hamlet
- `S1-03__c001_d44b561e1d31` tok=36 type=`topic_block` | Attendees
- `S1-03__c002_162f8ffff911` tok=480 type=`topic_block` | Discussion and decisions
- `S1-03__c003_551e4ee722ac` tok=65 type=`topic_block` | Open questions

### Status report (workstream) — `S1-04`

**v1:**
_n=4_
- `S1-04__c000_8bfccc9c41c2` tok=82 type=`document_header` | Project Status Report — Hamlet
- `S1-04__c001_abdd03a9926e` tok=71 type=`section` | Executive summary
- `S1-04__c002_d723adca9537` tok=208 type=`workstream_block` | Status by workstream
- `S1-04__c003_25284baae1d1` tok=448 type=`workstream_block` | Completed

**v2:**
_n=3_
- `S1-04__c000_8bfccc9c41c2` tok=82 type=`document_header` | Project Status Report — Hamlet
- `S1-04__c001_cbd2645cf833` tok=278 type=`workstream_block` | Executive summary
- `S1-04__c002_9c3bc0e4bccb` tok=448 type=`workstream_block` | Completed

### Change log (decision) — `S1-05`

**v1:**
_n=7_
- `S1-05__c000_520eb29fbb99` tok=76 type=`document_header` | Season Approval and Change-Control Log — Hamlet
- `S1-05__c001_080f1aa2f548` tok=67 type=`rule_block` | Delegated approvals
- `S1-05__c002_1cc55bde7afd` tok=65 type=`decision_record` | Change log
- `S1-05__c003_cc1e68095028` tok=64 type=`decision_record` | Change log
- `S1-05__c004_c34a245b861c` tok=59 type=`decision_record` | Change log
- `S1-05__c005_2114ce933570` tok=91 type=`section` | Change request protocol
- `S1-05__c006_27ba964bef18` tok=56 type=`decision_record` | Decision history principle

**v2:**
_n=7_
- `S1-05__c000_520eb29fbb99` tok=76 type=`document_header` | Season Approval and Change-Control Log — Hamlet
- `S1-05__c001_080f1aa2f548` tok=67 type=`rule_block` | Delegated approvals
- `S1-05__c002_1cc55bde7afd` tok=65 type=`decision_record` | Change log
- `S1-05__c003_cc1e68095028` tok=64 type=`decision_record` | Change log
- `S1-05__c004_c34a245b861c` tok=59 type=`decision_record` | Change log
- `S1-05__c005_2114ce933570` tok=91 type=`section` | Change request protocol
- `S1-05__c006_27ba964bef18` tok=56 type=`decision_record` | Decision history principle

## Metadata preservation

- `document_id`, `path` / `source_path`, `employee_id`, `owner_employee_id`, `employee_name`, `organizational_role` / `position`, `system_role`, `season`, `production`, access unresolved flags: carried from loader via `build_chunk` (not invented).
- `project_id` remains blank when source has no explicit id.
- Access permissions / proxy matrices were not modified by this refinement.

## Human review gate

**`PROMOTED`** (user-approved 2026-11-22) — main `chunks.jsonl` is now the v2 set (1120).  
Rollback if needed: copy `chunks_v1_backup.jsonl` back over `chunks.jsonl`.
