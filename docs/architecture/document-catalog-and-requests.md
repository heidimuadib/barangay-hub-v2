# Document catalog and request intake — as built

Slices 3A–3B, 2026-08-03. Companion to
[resident-registry-and-verification.md](./resident-registry-and-verification.md);
this note covers what a barangay offers and how someone asks for it.

**Scope of this document:** the domain foundation (3A) and the RESIDENT
surfaces built on it (3B). The staff intake queue arrives in 3C and supporting
evidence in 3D. Where this note and the code disagree, the code is the fact.

## The shape of the thing

Four tables, all tenant-scoped, all with forced RLS and composite tenant
foreign keys:

```
document_types ──< document_type_requirements
      │                        │
      │                        │
      └──< document_requests ──┴─< document_request_answers
                  │
                  └── persons (the requester; may have NO account)
```

`document_requests` references both `persons` and `document_types` by
`(id, barangay_id)`, so a request that crosses tenants is not merely forbidden
— it cannot be written.

## The catalog is tenant data, not reference data

Slice 2's `residency_bases` is reference data: one vocabulary, written by
migration, identical everywhere. The document catalog is the opposite. Each
barangay decides what it issues, what it charges and how long it takes, so
`document_types` carries `barangay_id` and is managed through a capability
(`documents.catalog.manage`) rather than through a migration.

Rows are never deleted. A withdrawn document type is set `is_active = false`
and stays: requests reference it forever, and a request whose type vanished
would be unreadable history. Residents see active types only; a holder of
`documents.catalog.read` sees everything, because a withdrawn document still
has a past.

## Fees, turnaround and validity are unconfirmed — and say so in data

Blocker **B-08** is open: no barangay has approved a fee schedule, a
processing time or a validity period. The project's honesty rule (Phase 6
§2.7) says an interface must never be made to look finished by hiding what is
undecided, so this is enforced in four places rather than trusted to a
component:

1. **`values_are_placeholder boolean not null default true`** on every catalog
   row — the mechanism the README names.
2. **`create_document_type` has no parameter that can set it.** Confirming a
   schedule is an owner act recorded against B-08, not something a caller
   asserts while creating a type.
3. **`pnpm db:reset:verified` fails** if any seeded row claims to be
   confirmed, so a synthetic amount cannot quietly become an official one.
4. **`rules/catalog-terms.ts`** presents figures and their status together, so
   a surface cannot render an amount while forgetting the qualifier.

One distinction runs through all of it: **`null` is not zero.** A fee of
`null` means nobody has decided; a fee of `0.00` means the document is free.
Conflating them would either invent a price or hide one, so `termStatus()`
returns `undecided` for the first and `provisional`/`confirmed` for the
second, and `formatFee()` returns `null` rather than a misleading `₱0.00`.

## Requirements are data, not code

What a barangay asks for varies by document, so `document_type_requirements`
carries a key, a label, an `input_kind` and an `is_required` flag, ordered by
`sort_order`. The request form is therefore data-driven rather than
hard-coded per document type.

Answers are stored as text in one column and validated against the declared
kind by trigger (`ANSWER_NOT_A_NUMBER`, `ANSWER_NOT_A_DATE`,
`ANSWER_NOT_A_BOOLEAN`, `ANSWER_NOT_AN_OPTION`). One column keeps the answer
set queryable as a unit; five mostly-null typed columns would not.

Two coherence rules are trigger-enforced because a CHECK cannot see the
relationship: a `select` requirement must carry choices
(`SELECT_REQUIRES_OPTIONS`), and any other kind must not
(`OPTIONS_NOT_APPLICABLE`) — dead data a form would silently ignore.

## The state machine

```
draft ──submit──> submitted ──review──> in_review ──mark ready──> ready_for_issue
```

Enforced twice: each domain function gates on the current state, and the
`document_requests_guard` trigger refuses any other edge — including on the
owner path. `rules/request-transitions.ts` mirrors the map for the UI, and
says in its own comment that the SQL wins if they ever disagree.

Each state owns a timestamp (`submitted_at`, `review_started_at`, `ready_at`)
and the guard refuses to enter a state without it, so the queue can always
order itself.

**`ready_for_issue` is the terminus and the Slice 4 hand-off.** There is
deliberately no decline or cancel state — the roadmap documents four, and the
gap that leaves is recorded as **DEC-REQ-01** rather than filled by invention.

Two further immutability rules: provenance (`source_channel`, `created_by`,
`creation_reason`) never changes, and the `purpose` cannot be rewritten once
the request leaves `draft` — staff must be reviewing what they were shown.

## One domain service, two doors

`create_own_request` and `create_walk_in_request` differ in exactly two ways:
who is authorized, and what channel is recorded. They then converge on the
same table, the same submit path, the same queue and the same audit.

This is the roadmap's headline requirement for the slice, and it is not
provable by reading the code, so pgTAP asserts it structurally: two requests
created through the two functions are compared column-by-column and must
differ in **exactly** `source_channel`, `created_by` and `creation_reason`.
A future change that makes the assisted path special fails that test.

The self path requires the caller to *be* a person in the barangay — an
account alone is not enough, which is Slice 2's rule that an account proves
nothing. The assisted path requires `requests.create_walk_in` and a reason,
and works for a person with **no account at all**.

## Authorization

Six capabilities, mapped as follows:

| Capability | staff | administrator |
| --- | :---: | :---: |
| `documents.catalog.read` | ✓ | ✓ |
| `documents.catalog.manage` | | ✓ |
| `requests.read` | ✓ | ✓ |
| `requests.create_walk_in` | | ✓ |
| `requests.review` | ✓ | ✓ |
| `requests.mark_ready` | | ✓ |

Residents hold **none**: they reach their own catalog and their own requests
through self-scoped RLS, exactly as in Slice 2. Platform administrators hold
none either, and match no RLS branch — no tenant request data, ever.

The split between `requests.review` and `requests.mark_ready` is deliberate.
Both are "moving the request along", but only one of them tells a resident
their document is ready to collect. That is a promise, and a barangay should
be able to decide who may make it.

Writes never flow through table grants. `authenticated` holds `SELECT` only;
every mutation is a `SECURITY DEFINER` function that re-checks capability or
ownership itself, so the RPC surface and the RLS policies cannot drift apart.
`anon` holds nothing — including on the catalog. The US-UI-006 public portal
will need that grant, and opening a table to `anon` belongs with the surface
that needs it.

## Audit

| Event | Metadata |
| --- | --- |
| `request.created` | `source_channel`, `document_type_id` |
| `request.submitted` | `answer_count` |
| `request.state_changed` | `from_state`, `to_state` |
| `catalog.document_type_created` | `code`, `values_are_placeholder` |
| `catalog.document_type_updated` | `code`, changed field **names**, plus `is_active`/`values_are_placeholder` when they flip |

The `purpose` and every answer **value** are resident-supplied personal data
and never appear. `answer_count` is the completeness signal — how much
accompanied the submission, never what it said. pgTAP asserts both absences
directly against the seeded values.

Flipping `values_are_placeholder` is audited explicitly, because declaring a
fee schedule confirmed is the moment provisional figures start being quoted as
official.

## Outbox

Two intents, both enqueued in the same transaction as the state change:

| Intent | When |
| --- | --- |
| `request.in_review` | someone picked the request up |
| `request.ready_for_issue` | the document is ready to collect |

Payloads carry `request_id` and `person_id` and nothing else. No purpose, no
answers, no name, no amount.

**`request.submitted` enqueues nothing**, inheriting Slice 2's ruling for
`verification.submitted`: it is the requester's own action, already confirmed
on screen, and a notification would tell them what they just did. That absence
is asserted in pgTAP so a later session cannot "fix" it by inventing a
notification nobody approved.

Duplicate intents need no bookkeeping: both functions gate on the current
state, so a repeated call raises `ILLEGAL_TRANSITION` before any enqueue is
reached.

There is still **no dispatcher**. Delivery remains Slice 8.

## What 3A deliberately does not include

No routes, no server actions, no services, no repositories, no components —
3A is the domain and its proofs. No supporting-evidence storage (3D reuses the
Slice 2 pattern verbatim). No serials, artifacts, QR payloads, payments or
release records: those are Slices 4–5, and `ready_for_issue` is where this
slice stops.

---

# Slice 3B — the resident surfaces

Five routes, all inside the `(resident)` group:

| Route | What it is |
| --- | --- |
| `/documents` | the active catalog for the resident's barangay |
| `/documents/[documentTypeId]` | one document: terms, requirements, the call to action |
| `/requests` | the resident's own requests, paginated |
| `/requests/new?type=` | composing a draft |
| `/requests/[requestId]` | one own request: answers, progress, submission |

Every path segment beyond the route name is a bare UUID, and search runs
nowhere near a query string — only `?page=` and `?type=` exist, and both carry
opaque values (P6-C-E). A Playwright test walks all five and asserts it.

## Browsing needs membership; requesting needs verification

The two gates are deliberately different, and the split is the main design
decision of this subpart.

**Browsing is open to any active member.** An applicant waiting on a decision
can see what their barangay offers and exactly what each document will ask
for, so they arrive prepared rather than discovering the requirements only
once they are finally allowed to act. This is also what 3A's RLS already said
(`auth_is_active_member`), so the service simply agrees with it.

**Creating a request needs standing.** 3A required the caller to *be* a
person in the barangay, which is Slice 2's "an account proves nothing" rule —
but onboarding creates the person record immediately, so that check would have
admitted an applicant whose verification was still `submitted`,
`info_requested` or `rejected`. Migration `20260807010000` closes it:

```
create_own_request:
  auth.uid() is null            → AUTHENTICATION_REQUIRED
  no person in this barangay    → AUTHORIZATION_DENIED
  person not verified           → RESIDENT_NOT_VERIFIED     ← 3B
  type inactive / cross-tenant  → DOCUMENT_TYPE_NOT_AVAILABLE
```

The order matters and is asserted: standing is checked **before** the catalog,
so an unverified caller naming a withdrawn type learns nothing about the type.

`person_is_verified` is "an approved application EXISTS, ever" — not "the
newest application is approved". Approval is terminal and re-enterable only
through a new application, so a resident who later opens a fresh one keeps
their standing. The server-side read mirrors that exactly rather than taking
the most recent row, because the two would otherwise disagree the moment
anyone re-applied.

`create_walk_in_request` was **not** gated. That asymmetry is a decision, not
an oversight — recorded as **DEC-REQ-02** and asserted in pgTAP.

### The refusal is a step, not a wall

`rules/resident-eligibility.ts` turns standing into one of six outcomes rather
than a boolean, because "not eligible" is not one state: someone who never
registered, someone whose barangay asked them a question, and someone who was
rejected each need a different next action. Every ineligible branch renders a
panel that names the action and links to it. A boolean here is how dead ends
get built.

## The three-place rule, again

Nothing about this is trusted to the page:

| Layer | What it does |
| --- | --- |
| Page | hides the form, explains why, links to the fix |
| Server Action | re-parses the input and re-checks standing — a Server Action is a network endpoint, not a continuation of the page that rendered it |
| Database | `create_own_request` refuses regardless |

The action raises the *same* error the repository maps
`RESIDENT_NOT_VERIFIED` to, rather than composing its own message, so the two
cannot drift apart in wording.

## Own-means-own, three times

`document_requests` RLS admits the requester **or** a holder of
`requests.read`. That second branch is right for the 3C staff queue and wrong
for a resident route, so the resident reads also filter by the caller's
`person_id`, resolved from the account↔person link. A staff member who
navigates to `/requests` sees their own requests and nobody else's.

The detail page re-checks the same thing, and another resident's request id
renders **404, not 403** — a distinguishable refusal would confirm that the id
names a real request.

## A requester keeps reading their own history

3A shows residents active types only, which is right for browsing: a withdrawn
document cannot be requested. But a request references its type forever, and a
resident opening a request they filed last year must still be able to read
what they asked for and which questions they answered. Withdrawing a type
would otherwise silently blank the history of everyone who ever used it.

So `20260807010000` adds one more permissive branch to the catalog policies:

```sql
auth_is_active_member(barangay_id) and caller_has_request_for_type(id)
```

Both conjuncts matter. Without the membership check, owning a request would
make a *non-member* a catalog audience — which is precisely the property
`13_document_catalog` pins down, and it failed loudly when this policy was
first written without it. The helper is `SECURITY DEFINER` for the same reason
`caller_owns_request` is: a policy on `document_types` that queried
`document_requests` directly would re-enter that table's own RLS.

## Composing a request

Creation and submission are separate acts, because 3A's surface is two
functions and because a resident should be able to look at what they wrote
before sending it:

1. `/requests/new` → `create_own_request` (a **draft**), then one
   `set_request_answer` per answered requirement;
2. `/requests/[id]` → review, edit answers, `submit_request`.

A failure between the two leaves a draft with incomplete answers. That is a
legitimate, recoverable state rather than a defect: the draft is visible, its
answers are editable (`set_request_answer` upserts), and `submit_request`
refuses until every required answer exists. The submit control is offered only
when the *server* has computed that the same completeness rule passes — and
when it is withheld, it says how many answers are missing, because a disabled
button with no explanation is how people give up.

The purpose is fixed at creation and shown read-only afterwards:
`document_requests_guard` freezes it once the request leaves draft, and there
is no RPC to change it, so offering an edit would promise something the
database refuses.

Answer fields are namespaced `answer.<key>` in the form. Requirement keys are
barangay-authored, so a type could legitimately declare one called `purpose`
and overwrite the request's own field; `.` is forbidden by the key CHECK,
which makes the prefix collision-proof rather than merely unlikely.

## Presenting unconfirmed terms

`presentTerms()` is called on the **server**, and components receive the
classified result. A component therefore cannot render an amount while
dropping the qualifier — the two arrive in one object, which is why that
object exists. The same three readings appear on the catalog card, the
document detail, the request form and the request detail:

- **undecided** — "Not set by the barangay yet". Never `₱0.00`.
- **provisional** — the figure, plus the RES-06 "Not yet confirmed" chip, plus
  the explanation that qualifies all three figures.
- **confirmed** — plain. Unreachable while B-08 is open, and that is fine: the
  branch exists so confirming a schedule needs no code change.

## What 3B deliberately does not include

No staff surface — the intake queue, the request detail with reviewer
controls, and walk-in creation are 3C. No supporting-evidence upload: the
document detail says so plainly rather than offering a control that does
nothing (3D). No public catalog: US-UI-006 needs the `anon` grant 3A withheld,
and that decision belongs with the surface that needs it. No decline or cancel
— still DEC-REQ-01.
