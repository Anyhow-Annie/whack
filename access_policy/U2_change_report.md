# U-2 change report (revise: drop escalation product logic)

**Worker:** Person C  
**When:** 2026-11-22  
**Architecture:** intact (no permission redesign)

## Summary

Removed notification/auto-escalation-oriented chunk fields. Kept safety knowledge labels and all original hazard/procedure text for ordinary retrieval. Access permissions unchanged. Originals untouched.

## Removed

| Item | Location | Notes |
| --- | --- | --- |
| `escalation_required` | `chunks.jsonl`, `chunker.py` | Was set true on all safety chunks as an escalation hook |
| `safety_escalation_language` | same | Snippet extractor for SM/PM wording (notifier-style) |
| `extract_escalation_snippet()` | `chunker.py` | Only served the discontinued snippet field |
| U-2-P2 “who gets notified” decision framing | Person B handoff / safety report | Discontinued product question |
| Safety classification as required readiness gate | `chunker.py` validate() | Safety fields no longer in hard `required` list |

No SafetyIssue classes, notification routers, dashboards, or escalation workflows existed in code beyond those fields — nothing else to delete. **Did not** add a replacement notifier.

## Preserved

| Item | Notes |
| --- | --- |
| Original Markdown / CSVs / `documents.jsonl` | Unchanged (checksum verified) |
| `chunk_text` / `text` / `embedding_text` | Evidence unchanged; procedure language still inside chunks where source had it |
| `safety_critical`, `safety_topic`, `safety_topics`, `safety_content_type`, `safety_source_reference` | Retrieval metadata |
| `safety_changes_access=false` | Explicit non-ACL marker |
| Topic patterns that match documented escalation/supervision **content** | For finding knowledge, not for paging |
| Proxy permission matrices / `permission_status=proposed` | Untouched as access policy |
| U-1 ownership metadata | Untouched |
| Architecture PDF three-tier model | Untouched |

## Schema (after)

```json
{
  "safety_critical": true,
  "safety_topic": "fight_choreography",
  "safety_topics": ["fight_choreography"],
  "safety_content_type": "operational_control",
  "safety_source_reference": "docs/WHACK_Theater_Role_Permission_Architecture.pdf …",
  "safety_changes_access": false
}
```

Absent by design: `escalation_required`, `safety_escalation_language`.

## Counts after revise

| Metric | Value |
| --- | ---: |
| Total chunks | 2207 |
| `safety_critical=true` | 119 |
| Chunks still containing SM-supervision / halt / SM+PM procedure wording | 28 |
| Discontinued field leaks | 0 |
| Retrieval dry-run (7 questions) | complete=7 |
| Officially approved proxy rows | 0 |

## Files touched

| Path | Change |
| --- | --- |
| `/cursor/stores/self/docs/chunker.py` | Drop product fields; optional safety labels |
| `/cursor/stores/self/docs/chunker_output/chunks.jsonl` | Regenerated schema |
| `/cursor/stores/self/docs/chunker_output/chunk_validation_report.md` | Reflects revise |
| `/cursor/stores/self/docs/access_policy/safety_metadata_report.md` | Rewritten for knowledge-only U-2 |
| `/cursor/stores/self/docs/access_policy/person_b_access_metadata_handoff.md` | Removes notification decision |
| `/cursor/stores/self/docs/access_policy/proxy_access_review_report.md` | U-2 wording aligned |
| `/cursor/stores/self/docs/access_policy/U2_revised_requirements.md` | New |
| `/cursor/stores/self/docs/access_policy/U2_change_report.md` | This file |
| `/cursor/stores/self/docs/access_policy/U2_validation_report.md` | New |

## Risks checked

- Would deleting procedure text lose knowledge? **Stopped / avoided** — text stays in chunks.
- Would dropping fields break a notifier dependency? **None found** in this store beyond the fields themselves and docs that described them (updated).
- Would this change ACLs? **No.**
