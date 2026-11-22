# Person B handoff — access metadata after U-1 / U-2 (revised)

**From:** Person C (ownership + safety *knowledge* metadata)  
**To:** Person B (access / coordination policy decisions)  
**Architecture (do not redesign):** `docs/WHACK_Theater_Role_Permission_Architecture.pdf`

## What you inherited

| Layer | File | What it is |
| --- | --- | --- |
| Proxy permissions (proposed) | `/cursor/stores/self/docs/access_policy/proxy_access_assignments.jsonl` | Document-level Admin/Manager/Member actions — still `permission_status=proposed`, `access_review_required=true` |
| Policy matrix | `/cursor/stores/self/docs/access_policy/proxy_access_policy_matrix.md` | How those proposals were derived |
| Proxy review | `/cursor/stores/self/docs/access_policy/proxy_access_review_report.md` | Unresolved U-1 / U-2 / U-3 topics |
| Chunks + evidence | `/cursor/stores/self/docs/chunker_output/chunks.jsonl` | Ownership + optional safety knowledge labels |
| U-1 review | `/cursor/stores/self/docs/access_policy/employee_ownership_review_report.md` | Ownership metadata (not ACLs) |
| U-2 review | `/cursor/stores/self/docs/access_policy/safety_metadata_report.md` | Safety knowledge for retrieval (not access locks; not notifiers) |
| U-2 revise pack | `U2_revised_requirements.md`, `U2_change_report.md`, `U2_validation_report.md` | Post-revise contract |

## How to read the fields (cheat sheet)

```
employee_id              → which assignment folder this record belongs to
owner_employee_id        → who authored/owns it (only when source says so)
organizational_role      → job title (Actor, Stage Manager, …)
system_role              → Admin | Manager | Member when PDF maps the title
lifecycle_stage          → 01_Planning | 02_Working | 03_Closeout
ownership_is_acl         → always false
peer_output_coordination_policy → "open_decision" until you decide

safety_critical          → chunk discusses a real hazard/control (retrieval label)
safety_topic             → topic id(s) for filtering
safety_content_type      → what kind of safety evidence (incl. documented procedures)
safety_source_reference  → architecture + doc/section pointer
safety_changes_access    → always false

DISCONTINUED (do not wire products to these):
  escalation_required, safety_escalation_language
```

Documented SM/PM escalation **procedures** remain searchable inside `chunk_text` when the source wrote them. There is **no** automated escalation / SafetyIssue / notification product in this archive layer.

## Decisions only Person B / the team can close

| ID | Decision | Context |
| --- | --- | --- |
| **U-1-P1** | Peer-output coordination rule | PDF: Members view peer outputs needed for coordination. Proxy Member `read` on employee artifacts is a **pattern**, not a named-employee grant. |
| **U-1-P2** | Own-record edit binding | How login identity maps to `owner_employee_id` for Member edit. Do **not** invent ACL rows here. |
| **U-1-P3** | Project identifiers | No explicit `project_id` in source; keep blank or define a future id scheme. |
| **U-2-P1** | Safety as overlay vs record class | Today: optional knowledge labels on chunks + proxy indicators. Decide later if permissions need a dedicated class — **not** a notifier. |
| **U-3** (prior) | Official adoption of proxy tiers | All 378 docs still proposed — human confirmation of production practice. |

~~**U-2-P2** Safety notification / who gets paged~~ — **discontinued** by U-2 revise. Do not reopen as an archive-metadata task.

## Hard constraints (already respected)

1. Do **not** redesign the three system tiers (Admin / Manager / Member).
2. Job title ≠ system tier — use `organizational_role` and `system_role` separately.
3. Safety must **not** rewrite `access_scope` / `permissions`.
4. Ownership metadata must **not** be treated as an individual ACL.
5. Original Markdown, CSVs, and `documents.jsonl` stay read-only.
6. Nothing is approved or public by default.
7. Do **not** implement SafetyIssue / notification / routing / dashboard / auto-escalation from these labels.

## Suggested Person B workflow

1. Confirm proxy matrix against production practice (start with money, donors, contacts, prompt books, publicity).
2. Decide U-1-P1 peer-read rule; record it in policy (not by inventing per-user ACL JSON here).
3. Use safety knowledge labels only as ordinary retrieval filters if useful — not as alert triggers from this layer.
4. Only then mark rows toward approval (`permission_status` changes are yours).

## Key counts at handoff

| Metric | Value |
| --- | ---: |
| Documents with proxy rows | 378 |
| Still `proposed` / review required | 378 |
| Employee chunks with owner set | 1807 / 1807 |
| Safety-critical knowledge labels | 119 |
| Officially approved permissions | **0** |

## Beginner one-liner

**U-1 tells you whose artifact it is; U-2 helps you find safety knowledge in ordinary search; the proxy file is still only a draft of who may act — and that draft is your decision to approve.**
