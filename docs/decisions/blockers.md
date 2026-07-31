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

- **Status:** OPEN — Slice 1 ships NO public sign-up (ADR-0005); accounts are provisioned (seeds, admin invite by email, later tenant provisioning)
- **Owner:** Product owner
- **Deadline:** with the resident-registration slice (Slice 2+), which cannot start without this ruling.

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
- **Remaining action:** create the standalone GitHub remote (recommended name
  `barangay-hub-v2`) and push — until then CI is READY TO ACTIVATE ON FIRST
  PUSH, not active (see R-1-03).

## Operational actions arising from Slice 0b (no ADR required)

| Action | Owner | Status |
| --- | --- | --- |
| Reconcile `db.major_version` 15→17 in `supabase/config.toml` | session | **done** (2026-07-31) |
| Enable MFA on the Supabase Owner account | repository owner | pending |
| Record DEC-ENV-01 outcome here when decided | decision owners | pending |
