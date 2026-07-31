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
| `src/app/(staff)/staff/page.tsx` | staff queues, SLA breach counts, pending approvals (US-STF-003) | the things queued — document requests, fees, SLAs — are assigned to **Slice 3** (DOC-001, B-08) |
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
| Transactional outbox table | No notification producer exists in Slice 1; building the table without a consumer is speculative infrastructure | Notification slice (EPIC-11/14) |
| PLT-08 authenticated readiness endpoint | No job queues exist to probe; a DB-touching public endpoint is an amplification vector (health route comment) | Platform slice |
| US-UI-002 full shell chrome (bottom nav, notification centre, density controls) | Slice 1 builds the minimal verification UI only; broad UI work is out of its security-foundation scope | UI slice |

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
