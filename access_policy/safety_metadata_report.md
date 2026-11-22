# Safety metadata report (U-2, revised)

**Audience:** reviewers new to this archive  
**Status:** Optional knowledge labels for ordinary retrieval — **not** access locks, **not** notification/auto-escalation products  
**Architecture:** `docs/WHACK_Theater_Role_Permission_Architecture.pdf` §1 Safety-Critical Staging / §3 Venue-Specific Safety Escalation Overrides  
**See also:** `U2_revised_requirements.md`, `U2_change_report.md`, `U2_validation_report.md`

## Plain-language takeaway

Some chunks talk about real stage hazards (rigging, fights, daggers, blood, strobe, fire-escape units, fragile glass handoffs) or about how SM/PM escalation **procedures** are documented. Those chunks can carry **safety knowledge flags** so search can find them. The flags do **not** change who can read or edit a document, and they do **not** page anyone or start a workflow.

## Fields (after revise)

| Field | Meaning |
| --- | --- |
| `safety_critical` | `true` when the chunk has **substantive** safety content |
| `safety_topic` / `safety_topics` | Hazard / control topic id(s) |
| `safety_content_type` | `documented_escalation_procedure` · `operational_control` · `policy_mandate` · `hazard_description` · `safety_note` |
| `safety_source_reference` | Points at the Architecture PDF + document/section |
| `safety_changes_access` | Always `false` |

### Removed (do not use)

| Removed field | Why |
| --- | --- |
| `escalation_required` | Product-style “must escalate/notify” trigger |
| `safety_escalation_language` | Notifier-style snippet; full wording remains in `chunk_text` |

## Counts

| Metric | Count |
| --- | ---: |
| Total chunks | 2207 |
| `safety_critical=true` chunks | **119** |
| Distinct documents with ≥1 safety chunk | **105** |
| Chunks whose text still documents SM-supervision / halt / SM+PM procedures | **28** |

### Safety topics (a chunk may have several)

| Topic | Chunks mentioning it |
| --- | ---: |
| fight_choreography | 43 |
| general_safety_control | 36 |
| sm_supervision_constraint | 28 |
| fire_escape | 27 |
| weapons_storage | 25 |
| performer_entrance_effect | 19 |
| blood_effects | 18 |
| fragile_glass_props | 5 |
| strobe_effects | 4 |

### Content types

| safety_content_type | Chunks |
| --- | ---: |
| safety_note | 48 |
| operational_control | 36 |
| hazard_description | 24 |
| policy_mandate | 11 |

## Documented escalation procedures (knowledge only)

When source Markdown describes escalating to the Stage Manager and Production Manager, rehearsing under SM supervision, or halting unsafe runs, that **text stays in the chunk**. Readers and ordinary retrieval can find it. This archive does **not** implement automated escalation, SafetyIssue tickets, routing, or dashboards.

## What was deliberately *not* done

- No change to `access_scope`, `permissions`, or `permission_status` because of safety.
- No new “approved” or “public” labels.
- No embeddings / Supabase / frontend.
- No replacement notifier after removing escalation product fields.

## Unresolved policy items (non-notification)

| ID | Topic | Why open |
| --- | --- | --- |
| U-2-P1 | Whether safety ever becomes its **own record class** for permissions | Architecture treats safety as gatekeeping duty / knowledge, not a separate archive folder. Person B decides later if needed. |
| U-2-P3 | Aligning broader proxy `safety_critical` document indicators with stricter chunk labels | Human reviewers may tighten either side; neither is approved policy. |

~~U-2-P2 notification workflow~~ — **discontinued** (not an open product decision in this handoff).

## Example (after revise)

```json
{
  "chunk_id": "ORG-005__c002_141887448aac",
  "safety_critical": true,
  "safety_topic": [
    "weapons_storage",
    "blood_effects",
    "fragile_glass_props",
    "performer_entrance_effect"
  ],
  "safety_content_type": "safety_note",
  "safety_changes_access": false
}
```

## Beginner check

Ask: “Does `safety_critical=true` lock the file or page the Stage Manager?”  
**No.** It only helps people **find** safety knowledge. Permissions stay on the separate proxy proposal; operational escalation stays a human procedure described in the text.
