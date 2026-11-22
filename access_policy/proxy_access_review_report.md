# Proxy access review report

## Verdict

Provisional **Admin / Manager / Member** document-level access metadata is proposed for **all 378** source documents, derived from the authoritative PDF architecture. Nothing is marked approved or public.

## Architecture source

| Field | Value |
| --- | --- |
| **architecture_source** | `docs/WHACK_Theater_Role_Permission_Architecture.pdf` |
| **Title** | WHACK Theater Role & Permission Architecture Specification |
| **Search result** | Found in the Project store at `/cursor/stores/self/docs/WHACK_Theater_Role_Permission_Architecture.pdf` (also checked uploads + dataset earlier; PDF is now the primary framework, over the interim brief). |
| **Confidence in framework** | **High** for tier names and record-class matrix (PDF §§1–3). **Medium** for document-level proxies of “own-record” Member authorship (see unresolved). |

Interim brief three-tier rules and ORG-004 were used only as secondary cross-checks; they did not override the PDF.

## Counts

| Metric | Count |
| --- | --- |
| Documents inspected | **378** |
| Proxy assignments proposed | **378** |
| `access_review_required=true` (need human confirmation before treating as live policy) | **378** |
| `permission_status=proposed` | **378** |
| `permission_status=pending_review` | **0** |
| Officially approved | **0** |
| Assumed public | **0** |
| Unresolved policy gaps (see below) | **3** topics |

### By archive level

| Level | Count |
| --- | --- |
| organization | 6 |
| season | 24 |
| employee | 348 |

### By lifecycle stage (employee-derived; org/season often blank)

| lifecycle_stage | Count |
| --- | --- |
| `(blank)` | 30 |
| `01_Planning` | 116 |
| `02_Working` | 116 |
| `03_Closeout` | 116 |

### By canonical record type (proxy class)

| canonical_record_type | Count |
| --- | --- |
| `employee_artifact_member` | 216 |
| `publicity_artifacts` | 48 |
| `employee_artifact_manager_role` | 36 |
| `dramaturg_artifacts` | 24 |
| `prompt_book_sm` | 24 |
| `seasonal_ops` | 16 |
| `seasonal_change_control` | 4 |
| `seasonal_roster_contacts` | 4 |
| `org_governance` | 3 |
| `budget_procurement_policy` | 1 |
| `donors_vendors_register` | 1 |
| `employee_directory` | 1 |

### Sensitive information indicators (content-derived; a doc may have several)

| Indicator | Documents flagged |
| --- | --- |
| `safety_critical` | 169 |
| `budget_or_contingency` | 129 |
| `vendor_procurement` | 117 |
| `public_facing_copy` | 87 |
| `prompt_book_canonical` | 37 |
| `donor_or_restricted_funds` | 33 |
| `contact_or_directory` | 5 |

| Docs with ≥1 sensitive indicator | **268** |
| Docs in inherently sensitive record classes (directory, donors/vendors, procurement policy, rosters, prompt book, publicity) | **79** |

## Sensitive classes — reviewer attention

These classes need a careful human pass even though a PDF mapping exists:

1. **`employee_directory` / `seasonal_roster_contacts`** — contact fields; Member read ≠ permission to reshare.
2. **`donors_vendors_register` + donor indicators** — restricted funds and acknowledgment language (Admin brand/donor sign-off).
3. **`budget_procurement_policy` + budget/vendor indicators** — $250 threshold, contingency, restricted funds (ORG-004 aligned with PDF).
4. **`prompt_book_sm`** — SM is sole canonical writer; closeout becomes archive-read.
5. **`publicity_artifacts`** — external copy write-lock until Director + PM approve; Admin donor/brand.
6. **Safety-critical indicators** — overlay on many production docs; Managers gatekeep; Members comply only under SM supervision.

## What was *not* done (by design)

- No edits to original Markdown, CSVs, `documents.jsonl`, or chunks.
- No embeddings, Supabase, or frontend work.
- No fake per-employee ACL rows or invented project memberships.
- No alternate system roles beyond Admin / Manager / Member.

## Unresolved / needs human decision

| ID | Topic | Docs affected | Why unresolved |
| --- | --- | --- | --- |
| U-1 | Peer-output / own-record **policy** (metadata now present) | 348 | **Metadata resolved:** chunks + proxy rows now carry `owner_employee_id`, `organizational_role`, `system_role`, `lifecycle_stage` (see `employee_ownership_review_report.md`). **Still open for Person B:** peer-output coordination rule and how login maps to own-record edit — still must not invent per-employee ACL rows. |
| U-2 | Safety overlay **enforcement** (knowledge labels present; notifiers discontinued) | 169 proxy / 119 chunks | **Metadata revised:** substantive safety chunks carry retrieval labels only (`safety_metadata_report.md`, `U2_revised_requirements.md`); no `escalation_required` / auto-notify fields; procedure text stays in chunks. **Still open for Person B:** whether safety becomes a dedicated record class (not a notification product). |
| U-3 | Official adoption of proxy tiers | 378 | All 378 rows remain permission_status=proposed with access_review_required=true until a human confirms against production practice. |

**Unresolved count for dashboard:** **3** open policy topics (U-1/U-2 metadata delivered; enforcement/adoption still human). **0** documents left without a proxy assignment row.

## Outputs produced

| File | Path |
| --- | --- |
| Assignments (JSONL) | `/cursor/stores/self/docs/access_policy/proxy_access_assignments.jsonl` |
| Policy matrix (Markdown) | `/cursor/stores/self/docs/access_policy/proxy_access_policy_matrix.md` |
| This review report | `/cursor/stores/self/docs/access_policy/proxy_access_review_report.md` |

## Beginner takeaway

Every document now has a **proposed** answer to “who can read / contribute / edit / approve / audit?” using only the three PDF tiers. Treat the JSONL as a **draft map for reviewers**, not live enforcement. Confirm especially: money & donors, contact lists, prompt-book ownership, publicity releases, safety overlays, and how “own employee artifact” should work in a real login system.
