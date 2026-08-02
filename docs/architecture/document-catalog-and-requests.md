# Document catalog and request intake — as built

Slice 3A, 2026-08-03. Companion to
[resident-registry-and-verification.md](./resident-registry-and-verification.md);
this note covers what a barangay offers and how someone asks for it.

**Scope of this document:** the domain foundation only. The resident and staff
surfaces arrive in 3B/3C, supporting evidence in 3D. Where this note and the
code disagree, the code is the fact.

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
