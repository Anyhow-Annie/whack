# U-2 revised requirements (Person C)

**Status:** Active after U-2 revise  
**Architecture unchanged:** `docs/WHACK_Theater_Role_Permission_Architecture.pdf`  
**Goal:** Keep safety **knowledge** available for ordinary retrieval. Do **not** build safety notification / auto-escalation product behavior.

## In scope

1. Label substantive safety evidence on chunks for search/filter:
   - `safety_critical`
   - `safety_topic` / `safety_topics`
   - `safety_content_type`
   - `safety_source_reference`
   - `safety_changes_access` (always `false`)
2. Leave hazard, procedure, lesson, and documented SM/PM escalation **wording** inside `chunk_text` when the source documents it.
3. Keep safety labels from changing `access_scope`, `permissions`, or proxy approval status.
4. Treat safety classification as **optional** knowledge metadata — never a mandatory chunker readiness gate.

## Out of scope (discontinued)

| Discontinued | Why |
| --- | --- |
| `escalation_required` chunk field | Was a product-style trigger (“must escalate / notify”), not retrieval knowledge |
| `safety_escalation_language` snippet field | Duplicated procedure text for notifier-style use; full wording stays in `chunk_text` |
| SafetyIssue entities / notification / routing / dashboards | Not implemented; must not be added as a replacement |
| Auto-escalation or halt workflows driven by chunk flags | Operations stay human; archive only stores knowledge |
| Using safety labels to rewrite ACLs | Forbidden |

## Content-type note

`safety_content_type` may still be `documented_escalation_procedure` when the **evidence text** itself describes how SM/PM escalation works. That is a retrieval label for “what this paragraph is about,” not a signal to page anyone.

## Dependencies Person B may rely on

| Safe to rely on | Do not rely on |
| --- | --- |
| Safety knowledge fields above | `escalation_required` |
| Procedure sentences inside `chunk_text` | `safety_escalation_language` |
| Ordinary keyword / metadata retrieval | Any SafetyIssue / notifier API |

## Related docs

- `/cursor/stores/self/docs/access_policy/U2_change_report.md`
- `/cursor/stores/self/docs/access_policy/U2_validation_report.md`
- `/cursor/stores/self/docs/access_policy/safety_metadata_report.md`
- `/cursor/stores/self/docs/access_policy/person_b_access_metadata_handoff.md`
