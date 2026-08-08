# Decision log — open blockers

Referenced by `docs/runbooks/supabase-project-assessment.md` and ADR-0002.
Records decision evidence and outcomes. A decision is **made by its named
owner**, never by an implementation session; entries here are evidence and
proposals until the owner marks them decided.

## DEC-ENV-01 — final role of hosted project `weadxbwtupvjqaqploij`

- **Status:** OPEN — evidence complete (Slice 0b, 2026-07-31); awaiting owner decision
- **Owner:** Product owner + Barangay Captain
- **Evidence:** `docs/assessments/hosted-supabase-assessment.md`
- **ADR-0002 Option 1 criteria, assessed:**
  - [ ] Region acceptable under `DEC-ENV-03` — **undetermined** (`ap-southeast-1`; closest available to PH; residency review pending)
  - [ ] Plan supports PITR ≥ 7 days — **fails** (free tier, `pitr_enabled=false`)
  - [x] Project empty of experimental objects — **passes** (zero user objects; created 2026-07-31)
  - [ ] Staging project provisioned in its place before M3 — not applicable yet
  - [ ] Access reduced to named, logged individuals — **partial** (1 named Owner, but MFA disabled)
- **Proposal (Slice 0b):** **Option 2** — this project becomes staging/integration; a separate production project (paid plan, PITR, restricted network, hardened access) is provisioned before pilot. Option 3 remains in force until decided.

## DEC-ENV-02 — cost approval for a second (production) Supabase project

- **Status:** OPEN — becomes active if Option 2 is accepted under DEC-ENV-01
- **Owner:** Product owner
- **Note:** free→paid pricing and PITR add-on costs must be quoted at decision time.

## DEC-ENV-03 — RA 10173 data residency for government-ID images

- **Status:** OPEN
- **Owner:** Product owner + legal reviewer
- **Evidence:** hosted region is `ap-southeast-1` (Singapore), immutable. No Philippine region exists on the platform as of the Slice 0b assessment.
- **Constraint while open:** `DEC-ENV-04` — no real resident data and no government-ID files in any hosted environment.

## DEC-ENV-04 — prohibition on real resident data in hosted environments

- **Status:** IN FORCE (standing constraint, not awaiting decision)
- **Verified 2026-07-31:** hosted project contains 0 users, 0 rows, 0 storage objects.

## DEC-ROLE-01 — role catalog names and scopes

- **Status:** OPEN — proposed working set implemented in Slice 1 (ADR-0005)
- **Owner:** Product owner + Barangay Captain
- **Proposal:** `platform_administrator` / `barangay_administrator` / `barangay_staff` / `resident`, capability-mapped per ADR-0005. Renames are data updates; no code branches on role keys.
- **Deadline:** before pilot.

## DEC-AUTH-01 — public resident self-registration

- **Status:** **RESOLVED** — 2026-08-01. The product owner selected
  **Option C — hybrid resident account provisioning**. The full 18-point
  ruling is recorded verbatim in
  [ADR-0006](../adr/0006-resident-provisioning-and-registry-decisions.md)
  (Accepted). In brief: public email/password sign-up with mandatory email
  confirmation; accounts prove nothing until an authorized reviewer approves
  the verification application; staff creation/invitation remains for
  walk-ins and assisted residents; both paths share one set of domain
  services; matching and duplicate handling are manual, capability-gated and
  audited (supersede-and-link only); anti-enumeration and rate limiting are
  hard gates before hosted public exposure; hosted-deployment items stay
  separate blockers.
- **Owner:** Product owner
- **Consequence:** Slice 2 is **DEFINED — READY TO START**
  ([roadmap](../IMPLEMENTATION_ROADMAP.md)). Slice 1's no-sign-up surface
  remains correct until Slice 2 ships the flows.

## D2-01…D2-04 — Slice 2 within-slice decisions — **APPROVED** (2026-08-01)

All four approved by the owner (D2-01/-02) and tech lead (D2-03/-04);
authoritative wording in
[ADR-0006](../adr/0006-resident-provisioning-and-registry-decisions.md):

| Decision | Approved outcome |
| --- | --- |
| **D2-01** residency basis | Keys: `property_owner`, `renter`, `household_member`, `caretaker`, `informal_resident`, `other` (explanation required for `other`); UI labels free, database keys stable |
| **D2-02** duplicate resolution | Supersede-and-link only; no destructive or automatic merge; administrator capability + reason + full audit; reversal only via a future audited correction workflow |
| **D2-03** evidence uploads | Private bucket; server-brokered signed upload URLs; metadata row before upload; path `{barangay}/{application}/{evidence}`; short-lived authorized read URLs; synthetic files only |
| **D2-04** capabilities | Ten `registry.*`/`verification.*` keys; staff get read/review/request-info; administrators get all; residents RLS-self-scope only; platform none |

**Implementation status (2026-08-02): all four are IMPLEMENTED and
test-covered.** Slice 2 is complete (2A–2G).

| Decision | Implemented by | Proof |
| --- | --- | --- |
| **D2-01** | 2A migrations `20260802010000`–`20260802050000`; the six keys are a database-backed lookup, and `other` requires an explanation at the CHECK level | pgTAP 05–07 |
| **D2-02** | 2E `supersede_person` only — no merge path exists in the codebase | pgTAP `10_duplicate_resolution` (35 assertions); e2e `duplicates.spec.ts` |
| **D2-03** | 2A metadata schema, opaque path, MIME allow-list, size ceiling and checksum fields; **completed in 2F** with the private bucket (`20260805010000`), server-brokered signed upload, server-verified finalization and short-lived read URLs | pgTAP `11_evidence_storage`; e2e `evidence.spec.ts` drives the whole journey through the browser |
| **D2-04** | 2A capability rows; enforced by `auth_has_permission()` in every function and by RLS | pgTAP 05–07, 09; e2e `verification.spec.ts` authorization block |

Slice 2 added **no** entry to the service-role allow-list and required no ADR
amendment: every registry and verification path runs as the calling user under
RLS.

## DEC-SCOPE-01 — Slice 2 scope is not defined in this repository

- **Status:** **RESOLVED** — 2026-08-01. The product owner supplied the
  approved Phase 6 vertical-slice sequence, now recorded as the in-repository
  plan of record: [docs/IMPLEMENTATION_ROADMAP.md](../IMPLEMENTATION_ROADMAP.md)
  (slices 2–9 plus v1.5, with per-slice scope, gates and blockers; Slice 2
  fully defined). Feature work remains gated per-slice — Slice 2 on
  DEC-AUTH-01 below.
- **Owner:** Product owner + tech lead
- **Raised:** 2026-08-01, when Slice 2 was requested.

*The original finding is preserved below for the record:*

**Finding.** The repository contains no roadmap, slice plan or backlog. `docs/`
holds ADRs, architecture notes, the Slice 0b assessment, this log, the risk
register, the placeholder register and runbooks — and nothing that defines
Slice 2. `git log --all` confirms no such file was ever committed or deleted.

The authoritative artefacts are **Phase 1–6 documents that live outside the
repository**: they are cited by section (Phase 4 §16.4, Phase 5 §11.2,
Phase 6 §25.6, §30.3, §22.2) and their story IDs (`US-STF-003`, `US-RES-004`,
`US-DOC-002`, `US-PLT-002`) reference a backlog nothing here contains.

**The three in-repo references to Slice 2 are mutually circular**, so a scope
cannot be inferred from them:

| Reference | Says Slice 2 delivers | Problem |
| --- | --- | --- |
| `apps/web/src/app/(staff)/staff/page.tsx` | staff queues, SLA breach counts, pending approvals (US-STF-003) | the things queued — document requests, fees, SLAs — are assigned to **Slice 3** (DOC-001, B-08) |
| `next.config.ts` | registry and case routes tightened to `no-referrer` | "cases" (complaints/mediation) are assigned to **Slice 6** (B-09) |
| `README.md` | resident and walk-in transactions share a domain service | the transactions are document requests — **Slice 3** again |

**Hard stop already recorded.** `docs/placeholders.yaml` marks `DEC-AUTH-01`
(public resident self-registration) `blocking_level: slice-2`, and this log
states the resident-registration slice "cannot start without this ruling".
`DEC-AUTH-01` is OPEN.

**Resolution requires one of:** the Phase 1–6 documents added to the repository
(or their Slice 2 section transcribed into `docs/`); or an owner ruling on
`DEC-AUTH-01` plus an explicit Slice 2 feature list recorded as an ADR.

**Consequence.** The post-Slice-1 branch delivered documented **hardening only**
— the work the risk register already assigns to the "Slice 2 implementer"
(R-1-06) — and started no feature work. That was a deliberate choice to avoid
inventing scope, not an omission.

## Slice 1 scope deferrals (recorded, not silent)

| Item | Reason | Arrives |
| --- | --- | --- |
| Transactional outbox table | No notification producer exists in Slice 1; building the table without a consumer is speculative infrastructure | **ARRIVED in Slice 2A** (`20260802010000`), once verification decisions gave it real producers. Enqueue only: four approved intents, tenant-scoped, carrying opaque ids and nothing else. **Delivery is still deferred** to the notification slice (EPIC-11/14) — no dispatcher exists, asserted by pgTAP `12_outbox_and_slice_review` |
| PLT-08 authenticated readiness endpoint | No job queues exist to probe; a DB-touching public endpoint is an amplification vector (health route comment) | Platform slice |
| US-UI-002 full shell chrome (bottom nav, notification centre, density controls) | Slice 1 builds the minimal verification UI only; broad UI work is out of its security-foundation scope | **PARTIALLY ARRIVED in Slice 3D (2026-08-04).** The touch-target half — R-2-05, the header links — is **done and the risk closed**; every shell nav link is 44px and the accessibility exemption that hid the gap was removed. The bottom navigation, notification centre and density controls are **still deferred**: a notification centre is a facade while delivery is Slice 8 and no notification exists to show it, and density controls are a preference feature with no user request behind them. Revisit with Slice 8 (notifications) and Slice 9 (settings) |

## DEC-REQ-01 — no decline or cancel state for document requests — **OPEN**

- **Status:** OPEN, raised during Slice 3A (2026-08-03)
- **Owner:** Product owner
- **Blocking level:** not blocking 3A; should resolve before Slice 3 exits

The roadmap documents exactly four request states — `draft → submitted →
in_review → ready_for_issue` — and assigns issuance to Slice 4. 3A implemented
those four and **no others**, because inventing a fifth would be scope nobody
approved.

The gap this leaves is real and worth naming: **there is currently no way to
close a request that should not proceed.** A request filed in error, withdrawn
by the resident, or refused by the office can only move forward or sit in the
queue indefinitely.

Three ways this could resolve, in ascending cost:

1. Slice 4 owns it — a refusal is part of issuance, so `ready_for_issue` is
   genuinely the end of intake and Slice 4 adds `issued` / `declined`.
2. Slice 3 adds a `cancelled` state for withdrawal only (resident-initiated),
   leaving refusal to Slice 4.
3. Slice 3 adds both `cancelled` and `declined` with a mandatory reason,
   mirroring the Slice 2 rejection rule.

Recorded now so the queue's behaviour in 3C is a decision rather than an
oversight. Until it resolves, the intake queue will accumulate requests that
have no exit.

## DEC-REQ-02 — may staff file a request for an UNVERIFIED person? — **OPEN**

- **Status:** OPEN, raised during Slice 3B (2026-08-03)
- **Owner:** Product owner
- **Blocking level:** not blocking 3B; should resolve with the 3C counter
  workflow

3B added the verification gate the roadmap asks for (Slice 3 §3, ADR-0006
point 4): `create_own_request` now refuses a resident whose registration has
not been approved, with `RESIDENT_NOT_VERIFIED`. Migration `20260807010000`.

`create_walk_in_request` was deliberately **not** given the same gate, and the
asymmetry is asserted in pgTAP so it stays a decision rather than an
oversight. The reasoning: the self-service path has no human in it, so the
database is the only check; a staff member at the counter is looking at the
person, has to record a reason, and is audited by name. Gating the counter
would also make the assisted path *stricter* than the resident path in a way
the roadmap never asked for — a walk-in exists precisely for people the online
flow does not serve.

But it is a real asymmetry, and it is the kind that gets discovered later as a
loophole rather than a decision. Three ways it could resolve:

1. **Keep it.** Staff judgement plus audit is the control; the counter is
   where exceptions belong.
2. **Gate it too**, and let staff verify the person first — one workflow, no
   exceptions, at the cost of turning away someone standing in front of them.
3. **Gate it with an override**: allowed, but the assisted request records that
   the person was unverified when it was filed, so the queue can show it.

Until this resolves, 3C's counter surface should not *advertise* filing for an
unverified person; the database permits it, and that permission is now
visible rather than accidental.

### DEC-REQ-01 addendum — issuance refusal, raised again by Slice 4A (2026-08-04)

Slice 4A implements **voiding**: withdrawing a certificate that was issued. It
deliberately does **not** implement refusal: declining a request so that no
certificate is ever issued. These are different acts on different tables, and
4A has no mandate to invent the second one.

The gap DEC-REQ-01 named is now load-bearing rather than theoretical. A
request that reaches `ready_for_issue` and then turns out to be ineligible —
wrong person, withdrawn by the resident, a fee never paid — has exactly two
exits available today: issue a certificate nobody should have, or leave the
row in the queue forever. The second is what will actually happen, and a queue
that only grows is how a pilot fails quietly.

**This needs an owner ruling. 4A did not choose one.** Four ways it could
resolve, in ascending cost, with what each implies for Slice 4:

1. **Slice 4 owns refusal as a request state.** Add `declined` to
   `document_requests` with a mandatory reason, mirroring the Slice 2
   rejection rule. Cheapest to build; changes a Slice 3 table from a Slice 4
   branch, and the roadmap's four-state chain becomes five.
2. **Slice 5 owns it, tied to payment.** Refusal is usually about money or
   eligibility discovered at the counter, both of which Slice 5 already
   models. Costs nothing now; leaves 4C's issuance screen with no "no" button
   and the queue with no exit through all of Slice 4.
3. **A resident-initiated `cancelled` state only**, leaving office refusal
   unresolved. Solves the commonest case (filed in error, changed their mind)
   without an office-refusal policy nobody has written. Partial by design.
4. **Model refusal as an issuance outcome rather than a request state** — a
   `certificate_refusals` row against the request, capability-gated and
   audited, with the request staying `ready_for_issue`. Keeps Slice 3's chain
   untouched and puts the record next to the issuance decision it belongs to;
   costs a fifth table and makes "is this request finished" a two-table
   question.

The recommendation from the implementation side is **(1)**, on the grounds
that a request's own lifecycle is where its ending belongs and a reader should
not have to join a second table to learn a request is closed — but the
consequence is a change to an approved state machine, which is the owner's
call and not an implementer's.

## B-05 / B-06 / B-07 — certificate wording, signatory titles, wet-signature process — **OPEN**

- **Status:** OPEN — carried in data since Slice 4A (2026-08-04)
- **Owner:** Product owner + Barangay Captain
- **Blocking level:** **pilot**, not local build (roadmap Slice 4 §8)

No barangay has approved the wording of any certificate, the title or name of
any signatory, or the process by which a certificate is signed. Slice 4A ships
the template table anyway, because the alternative — waiting — would leave
the whole slice unbuildable; but it ships with the uncertainty carried as
data, following the B-08 pattern:

1. **`certificate_templates.content_is_placeholder boolean not null default
   true`**, and `certificate_series.format_is_placeholder` alongside it.
2. **`create_certificate_template` has no parameter that can set it.**
   Approving wording is an owner act recorded here, not something a caller
   asserts while inserting a row.
3. **`pnpm db:reset:verified` fails** if any seeded template or series claims
   to be confirmed.
4. **The seeded bodies say so in their own text** — `SYNTHETIC TEST TEMPLATE
   — NOT APPROVED WORDING (B-05)` — so a screenshot cannot be mistaken for a
   draft of the real thing. Signatory fields are seeded `null`, not with a
   plausible name.
5. **`templateWarnings`** returns every applicable warning rather than the
   first, so a template that is both unapproved *and* unsigned cannot have one
   problem fixed while the other stays hidden.

B-07 (wet signature) is modelled as `requires_wet_signature`, defaulting to
`true`, and is deliberately **not** treated as a defect: signing on paper is a
workflow fact, not a fault in the template. `templateIsApproved` ignores it.

What resolution looks like: approved wording per document type, a named
signatory and title per barangay, and a ruling on whether v1 signs on paper
(the current assumption) or waits for the v1.5 e-signature flag.

## DEC-CERT-01 — certificate serial number format — **OPEN**

- **Status:** OPEN, raised during Slice 4A (2026-08-04)
- **Owner:** Product owner + Barangay Captain
- **Blocking level:** pilot; **does not block Slice 4** (roadmap Slice 4 §8
  calls for owner sign-off "within slice")

The roadmap requires an approved serial format before the series module is
considered built. None exists. 4A therefore separates the two halves of a
serial and treats them very differently:

- The **number** is real, accountable and final from the moment it is
  allocated. Nothing about this decision affects it.
- The **rendering** is synthetic. `format_certificate_serial` produces
  `PREFIX-YEAR-PADDED` (e.g. `SI-2026-00007`). This shape is invented for
  local development, documented as such in the function body, and **is not a
  proposal.**

Every series carries `format_is_placeholder`, every issued certificate carries
`serial_is_placeholder` forward from it, and `SERIAL_PLACEHOLDER_NOTICE`
("Format not yet confirmed") is worded differently from B-08's fee notice so a
reader can tell which decision is outstanding.

What the owner needs to decide: the prefix scheme (per barangay? per document
type?), whether the year is part of the number, the padding width, and whether
the counter resets annually. 4A's schema supports all of these — `prefix`,
`year` and `sequence_width` are columns, and the book is keyed
`(barangay_id, year)` — so confirming a format is data plus a flag flip, not a
migration.

Until confirmed, no serial rendered anywhere may be presented as official.

## DEC-CERT-02 — who may ISSUE a certificate — **OPEN, needs confirmation**

- **Status:** OPEN, raised during Slice 4A (2026-08-04). **Implemented one
  way; flagged because the source documents disagree.**
- **Owner:** Product owner + Barangay Captain
- **Blocking level:** not blocking 4A; should resolve before 4C builds the
  issuance surface

Three documents give three answers:

| Source | Says |
| --- | --- |
| Project brief | staff "possibly issue" |
| Roadmap Slice 4 §6 | "staff issue per capability" |
| ADR-0005 / ADR-0006, and Slice 3 as built | reviewing is staff work; **committing** acts are administrator work |

4A followed the **precedent**, not the roadmap line: `barangay_staff` holds
`certificates.read` only; `certificates.issue`, `.void`, `.manage_templates`,
`.manage_series` and `.artifact.read` go to `barangay_administrator`.

The reasoning: issuing a certificate consumes a serial number that can never
be reclaimed and produces a legal instrument in a resident's hands. That is
the same class of act as approving a verification (D2-04) or marking a request
ready (Slice 3), both of which are administrator-only in this codebase. Making
issuance the *one* committing act staff can perform would be an inconsistency
nobody decided.

It is recorded here rather than silently resolved because the roadmap says
otherwise in plain words, and "the implementer read the precedent differently"
is not a decision.

**Reversing it costs nothing structural**: it is an INSERT into
`role_permissions`, because no code branches on a role key — capability checks
go through `auth_has_permission`. If the owner rules that staff may issue,
the change is one migration and the pgTAP expectations in
`18_certificate_foundation`.

## DEC-REPO-01 — application location vs Git root

- **Status:** **RESOLVED** — 2026-07-31, ADR-0004 Option 1 executed
- **Owner:** Repository owner
- **Method:** `git subtree split --prefix=v2` in a temporary clone; standalone
  repository created with the three v2 commits preserved (`6b80f00`,
  `6016f78`, `1412fc4` ← `500ca57`, `4a0e411`, `52cd9c9`). Legacy repository
  untouched. Evidence and recovery: `docs/runbooks/repository-promotion.md`.
- **Outcome:** Husky hooks active; `pr.yml` valid at the repository root.
- **Remote:** COMPLETED 2026-07-31 — pushed to
  `github.com/heidimuadib/barangay-hub-v2`; first green workflow run
  30632397681. CI is ACTIVE; R-1-03 closed.

## Operational actions arising from Slice 0b (no ADR required)

| Action | Owner | Status |
| --- | --- | --- |
| Reconcile `db.major_version` 15→17 in `supabase/config.toml` | session | **done** (2026-07-31) |
| Enable MFA on the Supabase Owner account | repository owner | pending |
| Record DEC-ENV-01 outcome here when decided | decision owners | pending |
