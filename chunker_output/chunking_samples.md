# Chunking samples (QA)

**Generated:** 2026-11-22 08:04 UTC  

## Phase A → B before/after

### ORG-005 institutional lessons (experience over-merge fix)

**Before (audit):** one mega-chunk under heading `Purpose` also contained `['## Purpose']` (41 tokens), id `ORG-005__c001_2763f8c7decd`.

**After:** Cross-season patterns is its own experience_block so Glass Menagerie lessons are retrievable without pulling the entire memo.

- After chunk_id: `ORG-005__c002_141887448aac` (~263 tokens)
```markdown
## Cross-season patterns
- **Hamlet (2023–2024):** intimate sightlines and the Ghost effect reinforced the need to test visibility and performer traffic in the actual black box. The team formalized the principle that a supernatural effect should be repeatable and safe before it is made more elaborate.
- **A Midsummer Night's Dream (2024–2025):** the auditorium's wider stage and longer cable paths made venue-specific planning essential. Ground-supported forest units replaced overhead scenic ideas, demonstrating that a constraint can strengthen a coherent design.
- **The Glass Menagerie (2025–2026):** fragile glass-animal props required named handoff owners, a protected storage location, and two-person inventory at strike. The team learned to treat fragile props as tracked assets, not decorative objects.
- **Macbeth (2026–2027):** blood effects, dagger props, and fight sequences required repeatable preset, cleanup, and choreography controls. Safety notes belonged in the prompt book and p
```

### Actor planning tiny `Assigned role` stub

**Before:** standalone ~14-token chunk:
```markdown
## Assigned role
Character: **Hamlet** in *Hamlet*.

## Text and character questions
- What does the character want in each scene?
- What information does the character have, and what are they concealing?
- How does status change the character's physical behavior?
- Which relationships change the character's tactics?
- What textual or historical question should be brought to the Dramaturg?
```

**After:** coalesced with the following character/prep section:

- After chunk_id: `S1-EMP-WH-01-006-01__c002_0df919e0c223` (~99 tokens)
```markdown
## Assigned role
Character: **Hamlet** in *Hamlet*.

## Text and character questions
- What does the character want in each scene?
- What information does the character have, and what are they concealing?
- How does status change the character's physical behavior?
- Which relationships change the character's tactics?
- What textual or historical question should be brought to the Dramaturg?

```

### Status report: blockers kept with next actions (preserved good behavior)

**Before/after (unchanged intent):** S1-04 Completed cluster headings were `['## Completed', '## Outstanding work', '## Blockers and risks', '## Upcoming deadlines', '## Recommended next steps']` in one workstream chunk (~448 tokens). Regenerated output should still keep outstanding / blockers / next steps together when size allows.

### S1-04 outstanding + blockers sample

- **chunk_id:** `S1-04__c003_25284baae1d1`
- **document_id:** `S1-04`
- **strategy / type:** `workstream_based` / `workstream_block`
- **section:** 'Completed'
- **approx_tokens:** 448

chunk_text:
```markdown
## Completed
- Director/PM role-alignment conversation.
- Production concept and venue confirmed.
- Recurring donor and vendor register reviewed.
- Initial schedule milestones placed on the master calendar.
- Department leads assigned.

## Outstanding work
- Final design packages and measured drawings.
- Vendor quotes and written purchase requests.
- Costume fitting schedule and actor measurement confirmation.
- Cue list, cue numbering convention, and paper-tech packet.
- Publicity synopsis approval, photography schedule, and print proof.
- Borrowed-item register and fragile-prop handling plan.

## Blockers and risks
1. **Design freeze risk:** late scenic dimensions may delay Beacon Scenic Supply order. Mitigation: PM will not release purchase until designer signs off on measurements.
2. **Venue access risk:** load-in windows are limited by other venue activity. Mitigation: PM2 will confirm access in writing.
3. **Cue integration risk:** cue changes made verbally may not reach the caller. Mitigation: SM2 maintains the master calling script and timestamps revisions.
4. **Budget risk:** contingency is not available for routine scope expansion. Mitigation: Finance must approve any rel
```

embedding_text (prefix + same body):
```text
Document: Project Status Report — Hamlet [S1-04]
Document type: Project Status Report
Section: Project Status Report — Hamlet > Completed
Season: 2023-2024 | Production: Hamlet
---
## Completed
- Director/PM role-alignment conversation.
- Production concept and venue confirmed.
- Recurring donor and vendor register reviewed.
- Initial schedule milestones placed on the master calendar.
- Department leads assigned.

## Outstanding work
- Final design packages and measured drawings.
- Vendor quotes and written purchase requests.
- Costume fitting schedule and actor measurement confirmation.
- Cue list, cue numbering convention, and paper-tech packet.
- Publicity synopsis approval, photography schedule, and print proof.
- Borrowed-item register and fragile-prop handling plan.

## Blockers and risks
1. **Design freeze risk:** late scenic dimensions may delay Beacon Scenic Supply order. Mitiga
```

### ORG-004 approval thresholds (rule_based)

- **chunk_id:** `ORG-004__c003_11aae6e37166`
- **document_id:** `ORG-004`
- **strategy / type:** `rule_based` / `rule_block`
- **section:** 'Approval thresholds'
- **approx_tokens:** 107

chunk_text:
```markdown
## Approval thresholds
- Up to $75 within an approved line: PM approval plus receipt.
- $75.01–$250 within an approved line: both PMs approve; Finance Coordinator records the commitment.
- Above $250, any unbudgeted purchase, or any recurring service commitment: Executive Committee approval before order.
- Any donor-restricted expenditure: Finance Coordinator verifies eligibility before a commitment, regardless of amount.


```

embedding_text (prefix + same body):
```text
Document: Sponsorship, Purchase, and Reimbursement Approval Workflow [ORG-004]
Document type: Sponsorship and Purchase Approval Workflow
Section: Sponsorship, Purchase, and Reimbursement Approval Workflow > Approval thresholds
---
## Approval thresholds
- Up to $75 within an approved line: PM approval plus receipt.
- $75.01–$250 within an approved line: both PMs approve; Finance Coordinator records the commitment.
- Above $250, any unbudgeted purchase, or any recurring service commitment: Executive Committee approval before order.
- Any donor-restricted expenditure: Finance Coordinator verifies eligibility before a commitment, regardless of amount.


```

### S1-05 decision row (measurements) — request/decision/rationale/owner

- **chunk_id:** `S1-05__c004_c34a245b861c`
- **document_id:** `S1-05`
- **strategy / type:** `decision_based` / `decision_record`
- **section:** 'Change log'
- **approx_tokens:** 59

chunk_text:
```markdown
## Change log
| Change ID | Request | Decision | Rationale | Record owner |
| --- | --- | --- | --- | --- |
| S1-CH-003 | Release vendor orders before final measurements | Not approved | Avoids waste and late rework | Elias Porter |

```

embedding_text (prefix + same body):
```text
Document: Season Approval and Change-Control Log — Hamlet [S1-05]
Document type: Season Approval and Change Log
Section: Season Approval and Change-Control Log — Hamlet > Change log
Season: 2023-2024 | Production: Hamlet
---
## Change log
| Change ID | Request | Decision | Rationale | Record owner |
| --- | --- | --- | --- | --- |
| S1-CH-003 | Release vendor orders before final measurements | Not approved | Avoids waste and late rework | Elias Porter |

```

### ORG-003 lighting vendor record

- **chunk_id:** `ORG-003__c007_d084650359c5`
- **document_id:** `ORG-003`
- **strategy / type:** `record_based` / `record_row`
- **section:** 'Vendors'
- **approx_tokens:** 41

chunk_text:
```markdown
## Vendors

- **Lumen Stage Services:** lighting fixtures, lamps, and specialty rental. Obtain a written quote and retain an itemized receipt for every purchase.

```

embedding_text (prefix + same body):
```text
Document: Recurring Donors and Vendors Register [ORG-003]
Document type: Donors and Vendors
Section: Recurring Donors and Vendors Register > Vendors
---
## Vendors

- **Lumen Stage Services:** lighting fixtures, lamps, and specialty rental. Obtain a written quote and retain an itemized receipt for every purchase.

```
