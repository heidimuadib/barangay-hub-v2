# ADR-0006 — Resident provisioning (DEC-AUTH-01) and Slice 2 registry decisions

- **Status:** **Accepted** — product-owner ruling, 2026-08-01
- **Decision owner:** Product owner (provisioning); owner + tech lead (D2-01…04)
- **Supersedes:** the "Account provisioning (Slice 1)" section of
  [ADR-0005](./0005-slice1-role-catalog-and-provisioning.md), which described
  the interim no-public-sign-up posture while DEC-AUTH-01 was open.
- **Implements nothing by itself:** this ADR records rulings. The behaviour it
  describes is built in Slice 2 per the
  [implementation roadmap](../IMPLEMENTATION_ROADMAP.md).

## DEC-AUTH-01 — RESOLVED: Option C, hybrid resident account provisioning

The owner selected **Option C** from the recorded alternatives. Approved
behaviour, verbatim as ruled:

1. Public residents may create an account using email and password.
2. Email confirmation is required before onboarding submission.
3. Account creation does not prove identity or barangay residency.
4. New accounts remain unverified until an authorized barangay reviewer
   approves the verification application.
5. Staff may create or invite accounts for walk-in residents and residents
   who cannot complete online registration independently.
6. Online and staff-assisted paths must use the same person registry,
   verification, evidence, duplicate-detection, audit, and
   notification-intent domain services.
7. Staff-assisted creation must record: staff actor, resident subject, source
   channel, tenant/barangay scope, and a required reason where applicable.
8. An account may be matched to an existing person record only through an
   authorized and audited workflow.
9. Names and birth dates alone must never be treated as conclusive identity
   proof.
10. Duplicate candidates must be reviewed manually. The system must not
    automatically merge people.
11. Duplicate resolution for Slice 2 is approved as **supersede-and-link**:
    the superseded person record remains preserved; it points to the
    surviving person; both records and the decision remain auditable;
    destructive deletion or field-level merging is out of scope.
12. Real resident data and real government-ID files remain prohibited in
    local, CI, and Hosted Integration Environment testing (DEC-ENV-04).
13. Public sign-up must be anti-enumeration protected and **rate-limited
    before hosted public exposure** (activates R-1-04).
14. The hosted Supabase Auth site URL, redirect allow-list, email provider,
    environment topology, production designation, and RA 10173 residency
    review remain separate deployment blockers (R-0B-05/-06,
    DEC-ENV-01/-02/-03).
15. Staff invitation remains available even when public registration is
    enabled.
16. A walk-in person may exist without an Auth account.
17. Account-to-person matching must preserve the distinction between:
    authenticated account · person/resident record · verification
    application · barangay membership.
18. Platform administrators continue to have **no tenant resident-data
    access** without a future approved support-grant mechanism
    (Phase 4 §16.4).

## D2-01 — APPROVED: residency-basis vocabulary

Stable database keys; the UI may show human-readable labels:

`property_owner` · `renter` · `household_member` · `caretaker` ·
`informal_resident` · `other`

`other` **requires** a staff- or resident-provided explanation.

## D2-02 — APPROVED: duplicate resolution

Supersede-and-link **only**: no destructive merge; no automatic merge;
administrator capability required; reason required; fully audited; reversible
only through a separate, future, audited correction workflow.

## D2-03 — APPROVED: evidence upload approach

Private Supabase Storage bucket; server-brokered signed upload URLs; no
public bucket; no service-role key in the browser; the metadata row is
created **before** upload; upload path scoped by barangay, verification
application, and evidence ID; short-lived signed read URLs issued only after
authorization; synthetic files only for development and CI.

## D2-04 — APPROVED: initial Slice 2 capability keys and default mapping

New capability keys (extending the ADR-0005 catalog by migration when
Slice 2 builds):

`registry.read` · `registry.create_walk_in` · `registry.match_account` ·
`registry.resolve_duplicates` · `verification.read` ·
`verification.review` · `verification.request_information` ·
`verification.approve` · `verification.reject` ·
`verification.evidence.read`

Default role mapping:

| Role | Slice 2 capabilities |
| --- | --- |
| `barangay_staff` | `registry.read`, `verification.read`, `verification.review`, `verification.request_information` |
| `barangay_administrator` | all Slice 2 capabilities |
| `resident` | none — self-scoped access through RLS only, never staff capabilities |
| `platform_administrator` | none of the tenant-scoped Slice 2 capabilities |

## Consequences

- Slice 2 moves to **DEFINED — READY TO START** (roadmap updated in the same
  change); its remaining decision points D2-01…04 are closed before the first
  migration is written.
- Option C opens the project's first anonymous write surface **when built**:
  rate limiting and anti-enumeration (ruling points 2, 13) are Slice 2
  build requirements locally and hard gates before hosted exposure.
- Staff-assisted creation metadata (point 7) adds fields to the Slice 2
  audit/registry design: `source_channel` and conditional `reason` join the
  walk-in path.
- Nothing here changes Slice 1 behaviour; the current no-sign-up surface
  remains correct until Slice 2 ships its flows.

## Revisit triggers

- DEC-ROLE-01 (role names) remains open at ADR-0005; a rename cascades into
  D2-04's mapping table.
- The future audited correction workflow (D2-02 reversibility) needs its own
  decision before any un-supersede is built.
