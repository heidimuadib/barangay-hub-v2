# Resident registry and verification — Slice 2 architecture

The registry, verification lifecycle and outbox foundation delivered by
**Slice 2A**. Policy source: [ADR-0006](../adr/0006-resident-provisioning-and-registry-decisions.md)
(DEC-AUTH-01 Option C; D2-01…D2-04). Scope source:
[implementation roadmap](../IMPLEMENTATION_ROADMAP.md), Slice 2.

**State after 2A + 2B + 2C + 2D + 2E:** database, domain functions, RLS,
audit, seeds, rules and the typed service layer are **implemented** (2A);
public sign-up with mandatory email confirmation, rate limiting, resident
onboarding into the shared registry and the verification status surface are
**implemented** (2B); the staff registry list, tenant-scoped search, safe
person detail and walk-in creation are **implemented** (2C); the verification
queue, review detail and the full decision workflow are **implemented** (2D);
the duplicate review and supersede-link resolution surface is **implemented**
(2E); the private evidence bucket, signed upload/read brokering and
browser-driven submission are **implemented** (2F, closing R-2-04). Only the
Slice 2G hardening pass remains.

### Duplicate review and resolution (2E)

The surface lives on `/staff/registry/[personId]` (the verification review
detail links to it): a side-by-side comparison of the record against every
tenant-scoped candidate, visible to `registry.read` holders; resolution
controls render only for `registry.resolve_duplicates` — and the action guard
plus the definer function re-check that regardless.

**Why a candidate was flagged is explained in BANDS, never decimals**
(`similarityBand`: ≥0.9 nearly identical · ≥0.6 strongly similar · else
similar) with the same-birthdate signal shown separately — a raw score invites
treating the signal as proof, and ADR-0006 points 9–10 forbid exactly that.
Review order ranks a same-birthdate candidate above a stronger name-only
match (`candidatePriority`). The committed SQL threshold (0.30) decides which
candidates exist at all; candidates never cross tenants, and a superseded
record is neither offered candidates nor offered AS one.

**Resolution is the 2A `supersede_person` function, driven — not reimplemented.**
The explicit survivor is a deliberate unpreselected choice, the reason is
required, and the confirmation spells out the consequences. The refusal
matrix, all database-enforced and pgTAP-pinned in `10_duplicate_resolution`:
self-pairs; cross-tenant pairs (also FK-unrepresentable); either side already
superseded — which makes **cycles structurally impossible**, since every edge
requires both ends unsuperseded; a missing reason; an **open application on
the loser** (a live review must never point at a frozen person); and **two
linked accounts**, which demands a deliberate unlink first. The committed rule
deliberately **permits an open application on the survivor** — their own
review simply continues — and the pgTAP suite pins that so a change is a
conversation, not an accident. The check order on a pair that violates several
rules: eligibility → reason → loser-open-application → two-accounts.

**After a resolve:** the loser is frozen (`PERSON_FROZEN` on any later write),
preserved, and points at the survivor; its page links the survivor and the
survivor's page lists absorbed records; search returns both, the superseded
one flagged; a superseded person no longer appears as a duplicate candidate.
The loser's account moves to an account-less survivor under the one explicit
rule, audited as `person_account.unlinked` (+ reason) and `.linked`.
`person.superseded` audit metadata carries `survivor_id` and (2E migration)
`reason_present` — never the reason text, never a name. Residents see none of
this surface; platform administrators still see no tenant person data. No
outbox intent is enqueued — no roadmap requirement names a resident
notification for an internal registry correction.

### Staff registry surface (2C)

| Route | Gate | Notes |
| --- | --- | --- |
| `/staff/registry` | `registry.read` | Paginated tenant roster. The page NUMBER is the only query parameter this route accepts. |
| `/staff/registry/[personId]` | `registry.read` | Opaque UUID only. A record in another barangay is indistinguishable from one that does not exist — RLS returns nothing either way, and both render the same neutral not-found page. |
| `/staff/registry/new` | `registry.create_walk_in` | Administrators only under the ADR-0006 §D2-04 mapping; `barangay_staff` reaches the list but not this route, and `create_walk_in_person` refuses the write regardless of what the UI offers. |

**Search carries no personal value in any URL (P6-C-E).** The term is submitted
as a POST body to a Server Action and the results are rendered from React
state. There is no `?q=` parameter, no router push and no history entry, so a
resident's name cannot reach a shared link, a browser history export, a
referrer header or a server access log. The term is never logged either — the
search action records a result COUNT and nothing more (Phase 6 §37.2).

**Duplicate candidates warn; they never merge.** `duplicate_candidates` is a
trigram signal at the 0.30 threshold, surfaced for manual judgement and
acknowledged deliberately before a new record is written. Nothing on this
screen resolves a duplicate — that is 2E, behind `registry.resolve_duplicates`
(ADR-0006 points 9–11).

### Verification queue and decision workflow (2D)

| Route | Gate | Notes |
| --- | --- | --- |
| `/staff/verification` | `verification.read` | Oldest-first queue over the actionable states. Two URL parameters exist and no others: `state` from the fixed vocabulary, and `page`. An unparseable value falls back to the default view rather than being echoed. |
| `/staff/verification/[applicationId]` | `verification.read` | Opaque UUID. A wrong-tenant id and a nonexistent id are indistinguishable — both render the neutral not-found page. |

**The reviewer controls are computed on the server** from the same transition
map the database enforces, intersected with the capabilities the caller holds,
so the UI cannot advertise a transition the database would refuse. The split is
ADR-0006 §D2-04 exactly: `barangay_staff` may start a review and request
information; only `barangay_administrator` may approve or reject. pgTAP proves
the database refuses a staff decision regardless of what the screen offers.

| Transition | Capability | Notes |
| --- | --- | --- |
| `submitted`/`resubmitted` → `in_review` | `verification.review` | Not idempotent by design: a second start raises `ILLEGAL_TRANSITION`, which is what stops two reviewers racing the same application. |
| `in_review` → `info_requested` | `verification.request_information` | Note required; shown to the resident verbatim. |
| `info_requested` → `resubmitted` | resident owns it (or `verification.review` for counter-assisted resubmission) | The resident's turn is structural — staff cannot pull an application back into review directly. |
| `in_review` → `approved` | `verification.approve` | Membership activation + intent in the same transaction. |
| `in_review` → `rejected` | `verification.reject` | Reason required; terminal. |

There is deliberately **no `resubmitted` → decision edge**: a resubmission
re-enters review first, so a decision is always taken on a state a reviewer
has explicitly opened.

**Evidence metadata on the review detail is gated on
`verification.evidence.read`, not `verification.read`.** RLS would silently
return an empty list to a reviewer without it, and "no documents attached" must
never be conflated with "not yours to see" — so the capability is checked
explicitly and the page says which of the two it is. File *contents* remain 2F.

**Duplicate candidates appear as context only.** The review detail summarises
them for comparison and links to the registry record; nothing on the page
merges or resolves anything (2E, `registry.resolve_duplicates`).

**Outbox (2D addition).** 2A enqueued intents for the terminal decisions only.
`request_information` and `resubmit_verification` now enqueue
`verification.info_requested` and `verification.resubmitted` in the same
transaction as the state change. No bookkeeping is needed to prevent duplicate
intents: both functions gate on the current state, so a repeated call raises
`ILLEGAL_TRANSITION` before any enqueue is reached — pgTAP asserts that a
second call adds no second row. Payloads carry `application_id` and
`person_id`; the note and reason texts stay on the application row.

**Audit (2D addition).** `verification.state_changed` now also records
`note_present` / `reason_present` booleans alongside `from_state`/`to_state`.
The texts themselves are never in the metadata — pgTAP asserts the rejection
reason does not appear there.

> **Known gap until 2F:** onboarding opens a `draft` application, and
> `submit_verification` requires one identity and one residency evidence item,
> so **nothing in 2A–2D can move an application from `draft` to `submitted`
> through the browser alone.** The queue is reachable today only for
> applications submitted by seed or by API. The 2D e2e suite therefore submits
> through the resident's own granted RPCs (`add_evidence_metadata`,
> `submit_verification`) on their own access token — metadata only, no
> service-role shortcut — standing in for the upload surface 2F delivers.

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

### Implemented (2F): the bytes half

**The bucket** `verification-evidence` is created by MIGRATION, not by a
dashboard click, so `pnpm db:reset` reproduces it from an empty stack and
pgTAP can assert it: `public = false`, a 10 MiB `file_size_limit`, and the
D2-03 MIME allow-list enforced at the Storage layer as well as the table.

**No service-role client is used anywhere in this subpart.** Signed uploads,
signed reads and deletes all run on the caller's own session against
`storage.objects` policies. Those policies join the object name to
`verification_evidence.storage_path` — unique and server-generated — so
Storage authorization and metadata authorization resolve through the same row
and cannot drift apart:

| Operation | Who | Condition |
| --- | --- | --- |
| INSERT / DELETE | owner only | `evidence_object_writable`: owns the application AND it is `draft`/`info_requested` |
| SELECT | owner, or `verification.evidence.read` in the object's own barangay | `evidence_object_readable` |
| anything | `anon` | **no policy exists** — denied by deny-by-default |

There is no UPDATE policy: an evidence object is written once. Staff never
write resident evidence, and a platform administrator matches neither branch.

**Finalization cannot be forged.** Storage lives in the same database, so
`confirm_evidence_upload` reads `storage.objects` directly: the object must
exist, and the recorded `size_bytes` is taken **from the object**, never from
a client parameter. A browser that merely claims an upload succeeded raises
`EVIDENCE_OBJECT_MISSING` and finalizes nothing. `submit_verification` was
tightened to match — it now requires one *finalized* identity item and one
*finalized* residency item, closing the completeness gap 2A deferred.

**The upload sequence:** metadata row first (server generates the opaque
path) → one-object signed ticket → the browser PUTs directly to the private
bucket → the server verifies and finalizes. Only finalized evidence counts.
A failed upload leaves a PENDING row that satisfies nothing and can be
retried or removed.

**Reads are on demand.** A reviewer's page lists metadata only; nothing is
embedded or prefetched. A signed URL is minted when the reviewer asks, lives
about a minute, covers exactly one object, and is never logged, never placed
in a route parameter, and never persisted client-side.

**Removal is ordered, not atomic** — and the document says so because Storage
and Postgres cannot share a transaction. The OBJECT is deleted first, then
the metadata row:

- object delete fails → nothing else happens; the item is unchanged and the
  resident retries. No silent success.
- object gone, row remains → a retry deletes a missing object (Storage treats
  that as success) and then removes the row. The operation is idempotent.

The reverse order was rejected: it would leave a row pointing at nothing while
reporting success. An orphaned OBJECT is inert instead — every Storage policy
resolves through a metadata row, so an object without one is unreachable.

**Audit:** `verification.evidence_added` (kind + MIME), the new
`verification.evidence_finalized` (kind, MIME, trusted size, content hash) and
`verification.evidence_removed` (kind). Never a filename, never an object
path, never a signed URL — pgTAP asserts the path does not appear.

Synthetic files only, always (DEC-ENV-04): the e2e suite generates a 1×1 PNG
and a minimal PDF in-process, so no document resembling a real ID exists
anywhere in this repository.

## Public sign-up security (2B — implemented)

Option C introduces the project's first anonymous write surface, so the
controls ship with it:

- **Anti-enumeration.** `signUpAction` returns one neutral acceptance for
  *every* outcome — new address, address that already has an account,
  provider error, rate-limited caller. Supabase's own responses differ
  between those cases (it returns HTTP 422 for an existing address), and the
  action deliberately absorbs that difference. The distinction is recorded in
  the **audit** trail (`outcome_detail: existing_address`), where staff
  investigating abuse can use it, and never in the response. An e2e test
  submits a fresh address and a known-registered address and asserts the two
  rendered outcomes are byte-identical.
- **Rate limiting.** Two sliding windows: per client address (10 / 15 min) and
  per email digest (3 / hour). A throttled caller receives the same neutral
  acceptance — a distinguishable 429 is itself an oracle. Keys are digests or
  network addresses, never an email.
- **Email confirmation is required** before onboarding submission
  (ADR-0006 point 2). `enable_confirmations` is now **true locally too**: a
  policy configured only in production is a policy nobody has tested. Mail is
  captured by Mailpit, and the e2e suite reads the confirmation link from its
  API and completes the round trip.
- **No privileged claims.** `signUp` sends no `data` payload: user metadata is
  writable by the account holder, so nothing authorization reads may live
  there. The account confers no membership and no person record.

### Hosted exposure is NOT yet safe — and nothing here says otherwise

The limiter is **in-process**: N instances multiply every quota by N and a
cold start forgets the window. It is a seam (`src/lib/rate-limit`), correct
for one process and unit-tested with an injected clock, that a shared store
swaps out behind the same interface. Hosted public sign-up additionally
requires R-1-04 (shared-store limiting), R-0B-05 (site URL and redirect
allow-list) and R-0B-06 (a real email provider). Those remain open.

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
