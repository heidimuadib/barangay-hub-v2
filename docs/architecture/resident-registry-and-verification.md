# Resident registry and verification — Slice 2 architecture

The registry, verification lifecycle and outbox foundation delivered by
**Slice 2A**. Policy source: [ADR-0006](../adr/0006-resident-provisioning-and-registry-decisions.md)
(DEC-AUTH-01 Option C; D2-01…D2-04). Scope source:
[implementation roadmap](../IMPLEMENTATION_ROADMAP.md), Slice 2.

**State at the Slice 2A commit:** database, domain functions, RLS, audit,
seeds, rules and the typed service layer are **implemented**. Server Actions,
UI routes, the Storage broker and the public sign-up surface arrive in
subparts 2B–2G and are marked **planned** below.

## The four distinct concepts

ADR-0006 point 17 requires these never to collapse into one another, and the
schema keeps them separate:

| Concept | Table | Exists without the others? |
| --- | --- | --- |
| Authenticated account | `auth.users` + `user_profiles` | Yes — an account can exist with no person record |
| Person / resident record | `persons` | **Yes** — a walk-in person has no account (point 16) |
| Verification application | `verification_applications` | Requires a person; a person may have none |
| Barangay membership | `memberships` (Slice 1) | Created or activated **on approval**, not before |

`person_accounts` is the only bridge, and it is written exclusively by the
audited matching workflow or by the resident's own onboarding — never
inferred from an email match or any other heuristic (point 8).

## Provisioning (Option C, hybrid)

Both channels converge on **one** set of domain services (point 6). The only
differences are authorization and recorded provenance:

| | Public path | Staff-assisted path |
| --- | --- | --- |
| Entry | `create_own_person` (any authenticated account) | `create_walk_in_person` (`registry.create_walk_in`) |
| `source_channel` | `self` | `staff` |
| `created_by` | caller (trigger-stamped) | staff actor (trigger-stamped) |
| `creation_reason` | forbidden | **required** (trigger-enforced) |
| Account link | created in the same transaction | none — linked later, if ever |

Everything after creation — applications, evidence, review, decisions,
duplicate handling, audit, outbox — is identical for both.

## Verification state machine

```
draft ──submit──▶ submitted ──review──▶ in_review ──approve──▶ approved ✦
                                   ▲         │
        resubmitted ──review───────┘         ├──reject───────▶ rejected ✦
             ▲                               │
             └──resubmit── info_requested ◀──┘
```

`✦` terminal. **Exactly seven transitions are legal**; everything else is
refused. Terminal states are locked outright — reopening requires a *new*
application, which the partial unique index (`one open application per
person`) permits precisely because the terminal slot is free.

Enforcement is layered: the domain function checks the current state and the
caller's capability; the `verification_applications_guard` trigger re-checks
the transition, the mandatory rejection reason and the decision timestamp on
**every** update including owner paths; `pgTAP` proves both. The TypeScript
mirror (`src/features/registry/rules/verification-transitions.ts`) exists for
UI affordances and unit tests — the SQL governs.

Additional rules: submission requires **at least one identity and one
residency** evidence item; evidence is editable only in `draft` and
`info_requested`; an information request requires a note.

**Approval side effects, in the same transaction:** the linked account's
membership is created or activated with the `resident` role, and a
`verification.approved` outbox intent is enqueued. An account-less walk-in is
simply a verified person — no membership is invented. A **deliberately
disabled** membership refuses approval rather than silently reactivating.

## Capabilities and RLS

Ten capabilities (D2-04) mapped exactly as approved: staff read and move
applications through review and request information; administrators
additionally decide, create walk-ins, match accounts, resolve duplicates and
read evidence; residents hold **none** — their access is self-scoped RLS;
platform administrators hold none of these and see no tenant resident data
(point 18), which pgTAP asserts directly.

**Write model:** authenticated clients hold **SELECT only** on every registry
table. There is no INSERT/UPDATE/DELETE grant anywhere — every mutation is a
SECURITY DEFINER function that re-checks capability or ownership itself. The
RPC surface and the grant surface therefore cannot drift apart.

| Table | Who may SELECT |
| --- | --- |
| `residency_bases` | any authenticated (vocabulary, no tenant data) |
| `persons` | own person (via account link), or `registry.read` |
| `person_accounts` | own link, or `registry.read` |
| `verification_applications` | own application, or `verification.read` |
| `verification_evidence` | own application, or **`verification.evidence.read`** — deliberately a separate capability from `verification.read`, so ordinary staff see the queue without the documents |
| `outbox_events` | **nobody** — no client role holds any privilege |

RLS is enabled **and forced** on all six tables; owner paths are explicit
`postgres, service_role` policies, as in Slice 1.

## Duplicate handling (D2-02)

`duplicate_candidates()` scores `pg_trgm` similarity over
`lower(unaccent(names))` — the reason those extensions were installed in
Slice 0a — with a **documented threshold of 0.30**, tenant-scoped, excluding
already-superseded records, capped at ten. Same-birthdate is returned as a
separate boolean signal. **Candidates are signals for manual review; nothing
merges automatically** (points 9–10).

`supersede_person()` implements supersede-and-link only:

- requires `registry.resolve_duplicates` (administrator) **and a reason**;
- the survivor is chosen explicitly;
- the loser gets `superseded_by`/`_at`/`_reason` and becomes **frozen** — any
  later update raises `PERSON_FROZEN`, so history cannot be edited;
- **no deletion path exists anywhere in the schema**;
- refusals that protect correctness: an undecided application on the loser, a
  second already-superseded record, cross-tenant pairs, and — the case worth
  knowing — **two linked accounts**, which requires a deliberate unlink first
  rather than an automatic choice;
- the loser's account link moves to an account-less survivor under that one
  explicit rule, and both the unlink and relink are audited.

Reversal is explicitly out of scope: it needs its own audited correction
workflow (D2-02), not an `UPDATE`.

## Audit and outbox

Every event listed in the roadmap is emitted by trigger, in the same
transaction as its mutation: `person.created` (with `source_channel`),
`person.updated` (**field names only**), `person.superseded` (survivor id),
`person_account.linked` / `.unlinked` (with reason where supplied),
`verification.submitted`, `verification.state_changed` (from/to),
`verification.evidence_added` / `.evidence_removed` (kind and MIME — never a
filename), and `outbox.enqueued` (event type).

Metadata carries ids, states, kinds and field names — never passwords,
tokens, raw evidence, filenames, addresses or narrative text. The one
free-text value that *is* recorded is a staff-authored reason
(unlink/supersede/rejection), which is a deliberate accountability record and
is treated as PII by the central log redaction.

**Outbox:** `enqueue_outbox()` is owner-internal — no client role can execute
it, so an intent can only exist as the side effect of a real domain mutation.
Rows accept dispatch bookkeeping only and cannot be deleted (retention is a
Slice 8/9 policy decision). pgTAP proves atomicity in both directions: an
approval enqueues exactly one intent, and a *refused* decision enqueues none.

## Evidence and Storage (D2-03)

Slice 2A implements the **metadata half**: the row is created first
(`add_evidence_metadata`), which returns an **opaque path**
`{barangay_id}/{application_id}/{evidence_id}` — UUIDs only, no filename, no
PII. MIME allow-list (`image/jpeg|png|webp`, `application/pdf`) and the 10 MiB
ceiling are enforced by CHECK and mirrored in TypeScript. Upload confirmation
records sha-256 and byte size, one-shot. Metadata is immutable apart from
those confirmation fields.

**Planned (2F):** the private bucket, server-brokered signed upload URLs,
short-lived authorized read URLs, Storage policies mirroring the table
policies, object cleanup on removal, and the unauthenticated/cross-tenant
fetch probes. Until then no bytes are stored anywhere. Synthetic files only,
always (DEC-ENV-04).

## Public sign-up security — planned (2B), not yet present

Option C introduces the project's first anonymous write surface. It does not
exist yet: today the only public entry is Supabase Auth itself. Slice 2B must
ship, and CI must prove, uniform anti-enumeration responses, application-level
rate limiting, mandatory email confirmation before onboarding submission, and
no privileged claim anywhere in user metadata. Hosted exposure additionally
depends on R-1-04, R-0B-05 and R-0B-06 — those remain **hosted blockers**, and
nothing in this slice marks hosted public exposure as safe.

## Local personas (synthetic)

Password for all: `password123-local`. Slice 2A adds to the Slice 1 set:

| Account / record | Scenario |
| --- | --- |
| `applicant.sanisidro@barangay-hub.test` | person with a **submitted** application and two evidence items |
| `inforeq.sanisidro@barangay-hub.test` | application in **info_requested** |
| `rejected.sanisidro@barangay-hub.test` | **rejected** application (terminal) |
| `resident.sanisidro@barangay-hub.test` | **approved** application, active membership |
| *Juan Dela Cruz (Test)* | **walk-in person with no account** |
| *Maria Santos / María Sántos (Test)* | duplicate pair, same birthdate, accented variant — exercises `unaccent` + trigram |
| *Maria Santos (Test)* in Malinis | cross-tenant name twin — must never appear in San Isidro results |
