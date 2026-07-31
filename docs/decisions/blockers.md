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

## DEC-REPO-01 — application location vs Git root (Husky hooks inactive)

- **Status:** OPEN (pre-existing; see ADR-0004 and `docs/local-setup.md`)
- **Owner:** Repository owner
- **Note:** carried here for visibility; not a Slice 0b finding.

## Operational actions arising from Slice 0b (no ADR required)

| Action | Owner | Status |
| --- | --- | --- |
| Reconcile `db.major_version` 15→17 in `supabase/config.toml` | session | **done** (2026-07-31) |
| Enable MFA on the Supabase Owner account | repository owner | pending |
| Record DEC-ENV-01 outcome here when decided | decision owners | pending |
