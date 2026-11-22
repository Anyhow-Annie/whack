# Proxy access policy matrix (provisional)

**Architecture source:** [`docs/WHACK_Theater_Role_Permission_Architecture.pdf`](../WHACK_Theater_Role_Permission_Architecture.pdf) — *WHACK Theater Role & Permission Architecture Specification*  
**Status:** Proxy proposals only. Nothing here is officially approved. Nothing is public by default.  
**System tiers only:** Admin · Manager · Member (job titles are not system tiers).

This matrix turns the PDF’s role table into simple document rules for the 378-record archive. Use it with `proxy_access_assignments.jsonl`.

---

## Plain-language primer

Think of each document as having **five kinds of action**:

| Action | Meaning in everyday terms |
| --- | --- |
| **read** | Can open and use the document |
| **contribute** | Can add notes, drafts, quotes, or formal change requests — not the final say |
| **edit** | Can change the canonical / working text of the record |
| **approve** | Can lock a decision (budget, release, design freeze, change log) |
| **audit** | Can inspect for compliance, closeout, and archive integrity |

**Three people-buckets (system tiers):**

1. **Admin** — Executive Committee, Finance, institutional leads. Org-wide money, policy, donor/brand, and full audit.
2. **Manager** — Production Managers, Stage Managers, Directors. Run the show safely on schedule and within budget thresholds.
3. **Member** — Actors, Designers, Publicity, Dramaturgs. Do the craft work; request changes; do **not** silently rewrite master cues, vendor deals, or safety rules.

**Lifecycle gate (employee artifacts):**

| Stage | What it means for access |
| --- | --- |
| `01_Planning` | Drafts and proposals until Manager/Admin sign-off / design freeze |
| `02_Working` | Live ops; verbal notes stay provisional until logged in SM prompt book or PM change log |
| `03_Closeout` | **Immutable archive** — no further Member/Manager rewriting of filed reflections, inventories, receipts |

---

## Matrix by record class

Permissions below are the **proxy default**. Every row in the assignments file still has `permission_source=proxy`, `permission_status=proposed` (or `pending_review`), and `access_review_required=true`.

### 1. Org-level governance & policy (`ORG-001`, `ORG-005`, `ORG-006`)

| Tier | Permissions | PDF basis |
| --- | --- | --- |
| Admin | read, edit, approve, audit | Full control of bylaws, thresholds, archive schemas |
| Manager | read, contribute | Read policy; propose seasonal lessons / continuity updates |
| Member | read | Published profile and approved rules only |

### 2. Employee directory (`ORG-002`)

| Tier | Permissions | Notes |
| --- | --- | --- |
| Admin | read, edit, approve, audit | Institutional stewardship of the directory |
| Manager | read, contribute | Production use of roster data |
| Member | read | Published directory view only — **sensitive contacts → human review** |

### 3. Donors & vendors register (`ORG-003`)

| Tier | Permissions | Notes |
| --- | --- | --- |
| Admin | read, edit, approve, audit | Donor/vendor terms and acknowledgment tiers |
| Manager | read, contribute | Needs terms for procurement / credits |
| Member | read | Approved public rules only — **restricted-fund language → human review** |

### 4. Budget, quotes, contingency & approval workflow (`ORG-004`)

| Tier | Permissions | PDF basis |
| --- | --- | --- |
| Admin | read, edit, approve, audit | Final approver for quotes **>$250**, unbudgeted, contingency, restricted funds |
| Manager | read, contribute, approve | Custodian & pre-approver for quotes **≤$250** inside budgeted lines |
| Member | read, contribute | Requestor only — may submit estimates; **no vendor commitment** |

### 5. Seasonal briefs, schedules, status (`S#-01`–`S#-04`)

| Tier | Permissions | PDF basis |
| --- | --- | --- |
| Admin | read, approve, audit | Oversight of major scope/schedule shifts; closeout audit |
| Manager | read, contribute, edit, approve | PMs/SMs own briefs, notes, status |
| Member | read, contribute | Read approved schedules; submit formal change notes when cost/time/deps shift |

### 6. Season approval & change-control log (`S#-05`)

| Tier | Permissions | PDF basis |
| --- | --- | --- |
| Admin | read, approve, audit | Audits major shifts |
| Manager | read, contribute, edit, approve | Co-maintain the change-control log |
| Member | read, contribute | Formal written change notes only |

### 7. Season employee roster & contacts (`S#-06`)

| Tier | Permissions | Notes |
| --- | --- | --- |
| Admin | read, edit, approve, audit | Institutional contact stewardship |
| Manager | read, contribute, edit, approve | Production roster maintenance |
| Member | read | Approved roster read — **not** free redistribute of contact fields |

### 8. Prompt book / master script / cue calling (Stage Manager artifacts)

| Lifecycle | Admin | Manager (SM authoritative) | Member |
| --- | --- | --- | --- |
| Planning / Working | read, audit | read, contribute, edit, approve | read, contribute (written cue revision requests) |
| Closeout | read, audit | read, approve | read (finalized indexes only) |

**Rule:** Only the Stage Manager tier holds canonical write on the calling script. Verbal rehearsal notes are provisional until logged with date, beat, and confirmer.

### 9. Publicity artifacts (public-facing copy)

| Lifecycle | Admin | Manager | Member (Publicity) |
| --- | --- | --- | --- |
| Planning / Working | read, approve, audit | read, approve | read, contribute, edit |
| Closeout | read, audit | read, approve | read |

**Rule:** External promo copy stays write-locked until **Director** (artistic) and **PM** (dates, venue naming, accessibility credits) approve. Admin signs donor/brand language.

### 10. Dramaturg artifacts

| Lifecycle | Admin | Manager | Member (Dramaturg) |
| --- | --- | --- | --- |
| Planning / Working | read, audit | read, approve | read, contribute, edit |
| Closeout | read, audit | read, approve | read |

### 11. Other Manager-tier employee artifacts (PM, Director; SM non-prompt)

| Lifecycle | Admin | Manager | Member |
| --- | --- | --- | --- |
| Planning / Working | read, audit | read, contribute, edit, approve | read (coordination) |
| Closeout | read, audit | read, approve | read |

### 12. Member-tier employee artifacts (Actors & Designers)

| Lifecycle | Admin | Manager | Member |
| --- | --- | --- | --- |
| Planning / Working | read, audit | read, approve | read, contribute, edit *(own-record intent)* |
| Closeout | read, audit | read, approve | read |

**Important proxy limit:** Document-level rows cannot encode “only the owning employee.” That needs a future employee ACL. Until then, Member edit/contribute on these rows means “Member-tier authorship pattern,” and **human review is required**.

---

## Cross-cutting overrides (from PDF §3)

| Concern | Rule |
| --- | --- |
| **Safety-critical** (rigging, fights, daggers, blood, strobe, fire-escape, fragile glass) | Escalates immediately to SM + PM. Managers may halt runs. Members rehearse under SM supervision only — no improvised workarounds. Indicators are flagged on assignment rows. |
| **Procurement trail** | Four documents: quote → written approval → order confirmation → itemized receipt. |
| **Single source of truth** | One write owner per canonical class (SM → prompt book; Publicity → external copy drafts; PM → budget/change log within threshold; Admin → policy & >$250). |
| **Never public by default** | Missing or proxy access ≠ public. All proxy rows stay review-gated. |
| **Job title ≠ system tier** | e.g. a Designer is Member; a Stage Manager is Manager — even though both are “staff.” |

---

## How to read an assignments row

Each line in `proxy_access_assignments.jsonl` carries:

- Identity & context: `document_id`, `title`, `type`, `season`, `production`, `venue`, `department`, `lifecycle_stage`
- Classification: `canonical_record_type`, `sensitive_information_indicators`, `relevant_organizational_roles`, `access_scope`
- Permissions block for **Admin / Manager / Member**
- Provenance: `permission_source=proxy`, `permission_status`, `access_review_required=true`, `architecture_source`, `classification_reason`, `confidence`

Blank metadata fields mean **unknown** — they were not invented.
