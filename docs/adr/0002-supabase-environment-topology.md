# ADR-0002 — Supabase environment topology

- **Status:** **Open** (`DEC-ENV-01`) — Option 3 in force
- **Date:** Phase 6 Supabase Environment Correction
- **Decision owner:** Product owner + Barangay Captain

## Context

A Supabase project exists at `weadxbwtupvjqaqploij`. Its final designation has
**not** been approved. A second project may be recommended but requires explicit
owner approval because it carries cost, configuration and account-management
implications (`DEC-ENV-02`).

A Supabase project's **region is immutable**. Data-residency expectations for
government ID images under RA 10173 have not been confirmed (`DEC-ENV-03`).

## Options

1. Local development **+ existing project as production**.
2. Local development **+ existing project as staging + a separate production project**.
3. Local development **+ existing project as a temporary integration
   environment**, final role decided before pilot deployment.

## Decision

**Option 3 is in force** while `DEC-ENV-01` is open. The hosted project is the
**Hosted Integration Environment (HIE)** and is treated as **non-production**.

Advisory, not decided: revisit at Milestone M6, with Option 2 the likely
destination if the assessment shows an unacceptable region or plan tier.

## Constraints in force

- Local Supabase CLI is the primary development environment.
- CI uses ephemeral Postgres/Supabase instances.
- Synthetic data only in the HIE.
- **No real resident data. No government ID files.** (`DEC-ENV-04`)
- No second Supabase project without `DEC-ENV-02`.
- No irreversible change to the hosted project until the read-only assessment is
  complete and reviewed (`docs/runbooks/supabase-project-assessment.md`).

## Consequences

- Slice 0a and Slice 1 have **no hosted dependency** and can complete entirely
  against local and CI environments.
- The only Slice 0a item requiring the hosted project is the Vercel preview
  deployment, which is gated behind exit criterion 0b.
- `supabase/config.toml` sets `db.major_version = 15`. This **must** be
  reconciled with the hosted project during the assessment; a mismatch changes
  migration behaviour.

## Resolution criteria

Option 1 becomes available only if **all five** hold: acceptable region agreed
under `DEC-ENV-03`; plan tier supports PITR ≥7 days; the project is empty of
experimental objects or a full reset is acceptable; a staging project is
provisioned in its place before Milestone M3; access is reduced to named,
logged individuals.
