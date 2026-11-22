# Chunk validation report (QA)

**Generated:** 2026-11-22 08:04 UTC  
**Readiness:** `READY_FOR_REVIEW`  

> Gate rule: only `NOT_READY` or `READY_FOR_REVIEW`. This run never claims `APPROVED_FOR_EMBEDDING`.

## Phase A — Audit findings (before/with fixes)

### Correctly implemented

- Multi-strategy classification from observed structure (not forced unfit labels).
- Decision-table rows keep request / decision / rationale / owner together.
- ORG-004 approval thresholds keep dollar bands with approver conditions.
- Meeting notes keep Discussion/decisions with Action items when size allows.
- Status reports can keep outstanding work with blockers / next steps.
- Access missing → review flag; never assumed public.
- No relationship edges / confidence / feedback objects in chunk JSON.
- **U-1:** employee ownership metadata on chunks (not ACLs).
- **U-2:** optional safety *knowledge* labels for ordinary retrieval (does not change access; no notification/auto-escalation product fields).

### Incorrect / incomplete (addressed in Phase B where noted)

- Missing `chunk_text` / `embedding_text` fields → **fixed** (chunk_text + light prefix).
- ORG-005 over-merged all experience sections under `Purpose` → **fixed** (substantive sections stay separate).
- Tiny actor `Assigned role` stubs split from character context → **fixed** (tiny coalesce into following section).
- No automated validation report / retrieval dry-run / determinism gate → **added**.
- Chunking report previously said “Ready: YES” in a way that could be read as embedding approval → **clarified** (review gate only).
- Missing employee ownership vs system-role distinction (U-1) → **added**.
- Safety treated only as whole-document proxy indicator (U-2) → **chunk knowledge labels added** (still not an ACL).
- `escalation_required` / `safety_escalation_language` product fields → **removed** (U-2 revise: keep procedure text in `chunk_text`; no auto-escalation).

### Missing validation (now run — see below)

- Integrity + traceability suite
- Determinism (two in-memory re-runs)
- Task-oriented retrieval dry-run (7 questions)
- Graph compatibility (evidence-only)
- U-1 ownership fields; U-2 safety knowledge labels (optional — not a gate)

### Context-damaging decisions / grouping issues

- **Fixed:** experience mega-merge hid season-specific lessons behind `Purpose`.
- **Preserved on purpose:** workstream merge of Completed→Next steps (keeps blocker + next action).
- **U-2 choice:** do not re-split mixed sections solely for safety; mark the existing coherent chunk (prefer already-separate safety/risk sections).
- **U-2 revise:** no SafetyIssue / notification / routing / dashboard workflows.
- **Limitation:** `record_row` / `decision_record` chunks reconstruct a table header + one row; character offsets are best-effort, not a byte-perfect partition of `body`. Full lossless source coverage cannot be proven automatically for those reconstructed rows.

### Lost / duplicated / wrongly grouped

- Duplicate chunk texts within a document (pre-check in pipeline stats): see integrity section.
- Cross-document merges: checked (must be zero).

## Integrity & traceability

| Check | Result |
|-------|--------|
| Unique chunk_ids | PASS (2207/2207) |
| All documents covered | PASS |
| document_id exists in loader set | PASS |
| Non-empty chunk_text | PASS |
| Required metadata fields | PASS |
| source_location.document_id match | PASS |
| Access inheritance / not assumed public | PASS |
| embedding_text contains chunk_text | PASS |
| No cross-doc body copy | PASS |
| Determinism (2 runs) | PASS |
| Ownership not treated as ACL | PASS |
| Safety does not change access | PASS |
| No discontinued escalation product fields | PASS |

### Source-coverage limitation (honest)

Automated checks verify ids, metadata, non-empty text, and no cross-doc merges. They **cannot fully prove** that every character of every Markdown `body` appears in exactly one chunk: headers may repeat on record rows, and table rows are re-serialized. Treat coverage as **strategy-complete for retrieval**, not bitstream-complete.

## U-1 / U-2 ownership & safety (before → after)

### Plain-language

- **Before U-1:** chunks had `employee_id` / `employee_name` / `position` but did not say who *owns* the artifact, which job title is organizational vs which system tier (Admin/Manager/Member), or lifecycle stage.
- **After U-1:** employee chunks carry `owner_employee_id` (only when author establishes ownership), `organizational_role`, optional `system_role`, `lifecycle_stage`, `source_path`. Still **not** an ACL.
- **Before U-2 (first pass):** safety labels plus `escalation_required` / `safety_escalation_language` (looked like product escalation hooks).
- **After U-2 revise:** keep `safety_critical`, topic, content type, source reference for ordinary retrieval. Drop notification/auto-escalation fields. Documented SM/PM escalation *procedures* remain in `chunk_text`. Access unchanged. Safety classification is **optional** (not a readiness gate).

### Counts

| Metric | Count |
|--------|------:|
| Total chunks | 2207 |
| Employee-level chunks | 1807 |
| Employee chunks with owner_employee_id | 1807 |
| Chunks with ownership_unclear | 0 |
| Employee chunks with mapped system_role | 1807 |
| safety_critical chunks (optional labels) | 119 |
| discontinued escalation field leaks | 0 |

### Example — ownership fields (after)

- chunk_id: `S1-EMP-WH-01-001-01__c000_c9d3ba2f6388`

```json
{
  "document_id": "S1-EMP-WH-01-001-01",
  "employee_id": "WH-01-001",
  "owner_employee_id": "WH-01-001",
  "employee_name": "Mira Chen",
  "organizational_role": "Production Manager",
  "system_role": "Manager",
  "lifecycle_stage": "01_Planning",
  "ownership_unclear": false,
  "ownership_is_acl": false
}
```

### Example — safety knowledge fields (after revise)

- chunk_id: `ORG-005__c002_141887448aac`

```json
{
  "document_id": "ORG-005",
  "section_heading": "Cross-season patterns",
  "safety_critical": true,
  "safety_topic": [
    "weapons_storage",
    "blood_effects",
    "fragile_glass_props",
    "performer_entrance_effect"
  ],
  "safety_content_type": "safety_note",
  "safety_source_reference": "docs/WHACK_Theater_Role_Permission_Architecture.pdf §1 Safety-Critical Staging / §3 Venue-Specific Safety Escalation Overrides | document:ORG-005 | section:Four-Season Institutional Knowledge and Continuity Memo > Cross-season patterns",
  "safety_changes_access": false
}
```

- Non-safety employee example chunk_id: `S1-EMP-WH-01-001-01__c000_c9d3ba2f6388` (has ownership fields; `safety_critical=false`).

## Determinism detail

- Runs compared: 2
- chunk_ids identical: True
- chunk_text identical: True
- embedding_text identical: True
- ownership/safety fields identical: True
- counts: 2207 / 2207

## Retrieval dry-run (7 questions)

_Method: metadata + keyword match over chunks. Not embeddings. No speculative answers — only supporting chunk_ids._

### Q1. What approval steps apply to a purchase above $250?

- **Coverage:** `complete`
- **Expected docs (guidance):** ORG-004, S*-05 (delegated approvals citing ORG-004)
- **Supporting docs found:** `ORG-004`, `S1-05`, `S2-05`, `S3-05`, `S4-05`
- **Supporting chunk_ids:**
  - `ORG-004__c003_11aae6e37166`
  - `S1-05__c001_080f1aa2f548`
  - `S2-05__c001_043469f4331f`
  - `S3-05__c001_f4ac677bce6a`
  - `S4-05__c001_e9b29e964cb3`
- **Notes:** Primary evidence is ORG-004 Approval thresholds (Executive Committee before order). Season change logs restate ORG-004.

### Q2. Who is responsible for confirming vendor quotes?

- **Coverage:** `complete`
- **Expected docs (guidance):** S*-03 Kickoff action items (named owner), ORG-004 roles (PM / requester quote duties)
- **Supporting docs found:** `ORG-004`, `S1-03`, `S2-03`, `S3-03`, `S4-03`
- **Supporting chunk_ids:**
  - `S1-03__c002_162f8ffff911`
  - `S2-03__c002_4672aa17e3bf`
  - `S3-03__c002_6383f3dc12c3`
  - `S4-03__c002_030e689cb933`
  - `ORG-004__c002_d8cc02266c26`
  - `ORG-004__c005_daf185da08e3`
  - `ORG-004__c007_1f191ad41aee`
- **Notes:** Meeting action items name a PM for obtaining quotes; ORG-004 states requester submits quote and PM checks budget/alternatives. 'Confirming' vs 'obtaining' is human judgment on wording.

### Q3. What outstanding work remains for Macbeth?

- **Coverage:** `complete`
- **Expected docs (guidance):** S4-04 Project Status Report
- **Supporting docs found:** `S4-04`
- **Supporting chunk_ids:**
  - `S4-04__c003_345f6e0c4643`
- **Notes:** S4-04 workstream chunk includes Outstanding work (often merged with blockers / next steps).

### Q4. What did the team decide about scenic measurements?

- **Coverage:** `complete`
- **Expected docs (guidance):** S*-05 change log (orders before final measurements), S*-03 scenic scope / measured ground plan
- **Supporting docs found:** `S1-03`, `S1-04`, `S1-05`, `S1-EMP-WH-01-015-01`, `S1-EMP-WH-01-016-01`, `S1-EMP-WH-01-017-01`, `S1-EMP-WH-01-018-01`, `S1-EMP-WH-01-019-01`, `S2-03`, `S2-04`, `S2-05`, `S2-EMP-WH-02-015-01`, `S2-EMP-WH-02-016-01`, `S2-EMP-WH-02-017-01`, `S2-EMP-WH-02-018-01`, `S2-EMP-WH-02-019-01`, `S3-03`, `S3-04`, `S3-05`, `S3-EMP-WH-03-015-01`, `S3-EMP-WH-03-016-01`, `S3-EMP-WH-03-017-01`, `S3-EMP-WH-03-018-01`, `S3-EMP-WH-03-019-01`, `S4-03`, `S4-04`, `S4-05`, `S4-EMP-WH-04-015-01`, `S4-EMP-WH-04-016-01`, `S4-EMP-WH-04-017-01`, `S4-EMP-WH-04-018-01`, `S4-EMP-WH-04-019-01`
- **Supporting chunk_ids:**
  - `S1-05__c004_c34a245b861c`
  - `S2-05__c004_1d01e14db498`
  - `S3-05__c004_8545fbd65679`
  - `S4-05__c004_c1547621e39b`
  - `S1-03__c002_162f8ffff911`
  - `S1-04__c002_d723adca9537`
  - `S1-EMP-WH-01-015-01__c003_05ce83eac335`
  - `S1-EMP-WH-01-016-01__c003_2712a1d8d6f4`
  - `S1-EMP-WH-01-017-01__c003_0d657daef125`
  - `S1-EMP-WH-01-018-01__c003_cb01e64e4168`
  - `S1-EMP-WH-01-019-01__c003_bb13f6856cb8`
  - `S2-03__c002_4672aa17e3bf`
- **Notes:** Change-log rows keep request/decision/rationale/owner together; kickoff notes state measured plans before orders.

### Q5. What lessons from The Glass Menagerie should the next production team retain?

- **Coverage:** `complete`
- **Expected docs (guidance):** ORG-005, S3 closeouts / S3-02 lessons
- **Supporting docs found:** `ORG-005`, `S3-02`, `S3-EMP-WH-03-001-03`, `S3-EMP-WH-03-002-03`, `S3-EMP-WH-03-003-03`, `S3-EMP-WH-03-004-03`, `S3-EMP-WH-03-005-03`, `S3-EMP-WH-03-006-03`, `S3-EMP-WH-03-007-03`, `S3-EMP-WH-03-008-03`, `S3-EMP-WH-03-009-03`, `S3-EMP-WH-03-010-03`, `S3-EMP-WH-03-011-03`, `S3-EMP-WH-03-012-03`, `S3-EMP-WH-03-013-03`, `S3-EMP-WH-03-014-03`, `S3-EMP-WH-03-015-03`, `S3-EMP-WH-03-016-03`, `S3-EMP-WH-03-017-03`, `S3-EMP-WH-03-018-03`, `S3-EMP-WH-03-019-03`, `S3-EMP-WH-03-020-03`, `S3-EMP-WH-03-021-03`, `S3-EMP-WH-03-022-03`, `S3-EMP-WH-03-023-03`, `S3-EMP-WH-03-024-03`, `S3-EMP-WH-03-025-03`, `S3-EMP-WH-03-026-03`, `S3-EMP-WH-03-027-03`, `S3-EMP-WH-03-028-03`, `S3-EMP-WH-03-029-03`
- **Supporting chunk_ids:**
  - `ORG-005__c002_141887448aac`
  - `S3-02__c000_65173cec71ce`
  - `S3-EMP-WH-03-001-03__c000_d51f95552cbb`
  - `S3-EMP-WH-03-001-03__c003_8aef7f5974cb`
  - `S3-EMP-WH-03-002-03__c000_181d19aea6ad`
  - `S3-EMP-WH-03-002-03__c003_91613f7dfc57`
  - `S3-EMP-WH-03-003-03__c000_547e08df93db`
  - `S3-EMP-WH-03-004-03__c000_fd3ec39e83c4`
  - `S3-EMP-WH-03-005-03__c000_cc11010c51b5`
  - `S3-EMP-WH-03-005-03__c002_f40de31ba243`
  - `S3-EMP-WH-03-006-03__c000_adcc1cc765a8`
  - `S3-EMP-WH-03-007-03__c000_8c1c3c71f15f`
- **Notes:** ORG-005 Cross-season patterns names Glass Menagerie fragile-prop lessons. Season-3 closeouts may add role-specific lessons (human ranking).

### Q6. How did Stage Managers maintain prompt-book integrity?

- **Coverage:** `complete`
- **Expected docs (guidance):** S*-EMP-*-0{3,4}-02 Working Rehearsal Technical Report
- **Supporting docs found:** `S1-EMP-WH-01-003-02`, `S1-EMP-WH-01-004-02`, `S2-EMP-WH-02-003-02`, `S2-EMP-WH-02-004-02`, `S3-EMP-WH-03-003-02`, `S3-EMP-WH-03-004-02`, `S4-EMP-WH-04-003-02`, `S4-EMP-WH-04-004-02`
- **Supporting chunk_ids:**
  - `S1-EMP-WH-01-003-02__c004_c553cd7f1d38`
  - `S1-EMP-WH-01-004-02__c004_7373614596c8`
  - `S2-EMP-WH-02-003-02__c004_8fba678ef8b4`
  - `S2-EMP-WH-02-004-02__c004_20cfaacd91ab`
  - `S3-EMP-WH-03-003-02__c004_81bffa3add40`
  - `S3-EMP-WH-03-004-02__c004_8a9b90762f30`
  - `S4-EMP-WH-04-003-02__c004_174dfeea94c5`
  - `S4-EMP-WH-04-004-02__c004_8a9201cc3cb6`
- **Notes:** Working SM reports include a Prompt-book integrity section (verbal changes provisional until entered in master script).

### Q7. Which vendors provide lighting, sound, scenic, and costume services?

- **Coverage:** `complete`
- **Expected docs (guidance):** ORG-003 Donors and Vendors
- **Supporting docs found:** `ORG-003`
- **Supporting chunk_ids:**
  - `ORG-003__c004_620ac3cebfaf`
  - `ORG-003__c005_80470e7b487e`
  - `ORG-003__c006_154e2acf8c75`
  - `ORG-003__c007_d084650359c5`
- **Notes:** ORG-003 vendor records: Lumen (lighting), Signal Path (sound), Beacon (scenic), Harborlight (costume).

**Dry-run coverage tally:** complete=7, partial=0, none=0

## Graph compatibility (PART 7–8) — evidence only

- Emits relationship edges: **False**
- Emits directory events: **False**
- `evidence_only` on all chunks: **True** (2207/2207)
- Citeable via `source_ids` (chunk_id + document_id + source_location): **True**
- Forbidden edge/entity/feedback keys present: **0**
- Compatible for later graph stage: **True**

### PART 8 directory-event fields (documented for later — not populated now)

- `event_id`
- `event_type`
- `occurred_at`
- `actor`
- `subject_type`
- `subject_id`
- `payload`
- `access_policy`
- `access_classification`

Related architecture note: `docs/downstream-relationship-architecture.md`.

## Findings by severity

### Critical

_None raised by automated checks._

### Warning

- 378 documents missing access_policy/access_classification (flagged for review; not public)

### Info

- Full bitstream source-coverage cannot be proven for reconstructed record_row/decision_record chunks.
- Token band ~300–600: in=16, below=2191 (short records OK), above=0
- U-1 owner_employee_id set on 1807/1807 employee chunks; ownership_unclear=0.
- U-2 safety_critical knowledge labels=119 (optional; not a readiness gate; no auto-escalation fields; access unchanged).

## Readiness decision

**`READY_FOR_REVIEW`**

Human-judgment still required before any embedding approval:
- Fill or confirm `access_policy` / `access_classification` (all 378 flagged).
- Spot-check retrieval rankings for the 7 questions (dry-run ≠ semantic search quality).
- Confirm reconstructed table-row chunks are acceptable evidence units.
- Decide peer-output coordination rule for Member read of other employees' artifacts (U-1 open item).
- Confirm safety knowledge labels vs any future dedicated safety record class (U-2 open item for Person B — not a notification product).
