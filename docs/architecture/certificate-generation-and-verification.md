# Certificates, serials and public verification — as built

Slice 4A, 2026-08-04. Companion to
[document-catalog-and-requests.md](./document-catalog-and-requests.md), which
ends where this begins: a request reaches `ready_for_issue` and stops.

**Scope of this document:** the domain foundation only. 4A ships the schema,
the allocator, the issuance and void functions, RLS, audit and the pure rules —
and no user interface at all. Template rendering and PDF artifacts arrive in
4B, the staff issuance surface in 4C, QR and the public verification page in
4D. Where this note and the code disagree, the code is the fact.

## What the slice is actually for

A barangay certificate is a numbered legal instrument. The number is not
decoration: it is how an office answers "did we issue this, and what else did
we issue that day". An accountable serial book has one property —

> every number the book has consumed can be accounted for

— and the whole of 4A exists to make that property true by construction rather
than by discipline.

That framing decides several things that would otherwise look arbitrary: why a
voided certificate keeps its row and its number, why the counter is a column
rather than `max(sequence) + 1`, why deletion is refused rather than
discouraged, and why a correction is a new certificate instead of an edit.

## The shape of the thing

Five tables, all tenant-scoped, all with forced RLS and composite tenant
foreign keys:

```
certificate_series ──┐
                     ├──< certificates ──< certificate_voids
certificate_templates┘         │
        │                      └──< certificate_artifacts
        └── document_types (what this template renders)

certificates ── document_requests (what was asked for)
             └─ persons           (who asked)
```

`certificates` references its request, person, template and series by
`(id, barangay_id)` — four composite foreign keys — so a certificate that
crosses tenants is not merely forbidden, it cannot be written.

## Serial accountability, in three independent mechanisms

`allocate_certificate_serial` is the only thing that hands out a number, and it
is deliberately **not granted to any client role**. It is internal, called by
`issue_certificate` and nothing else.

Three mechanisms guard the same property, and any one of them failing leaves
the other two standing:

1. **A row lock.** The allocator takes `select … for update` on the series
   before reading the counter, so two concurrent issuances serialise rather
   than both reading the same value.
2. **A forward-only counter.** `certificate_series.next_sequence` advances and
   never rewinds — `certificate_series_guard` raises
   `SERIAL_SEQUENCE_CANNOT_REWIND` on any attempt, including on the owner
   path. A number that has been handed out cannot be made available again.
3. **A unique constraint.** `unique (series_id, serial_sequence)` refuses a
   duplicate at the storage layer even if both of the above were bypassed
   entirely.

Belt, braces and a second pair of braces, because the failure mode here is not
an error message — it is two residents holding documents bearing the same
number, discovered months later by somebody who trusted the book.

### Why the counter, and not `max(sequence) + 1`

Computing the next number from the issued rows sounds simpler and is wrong: it
silently reuses a number whose certificate was deleted. The counter does not
care what rows survive. `rules/serial.ts` states this as a comment and the
unit suite asserts it as a property.

### Why a void keeps its number

Voiding is the only correction 4A offers, and it is **additive**: a row is
inserted into `certificate_voids`, and the certificate's status changes to
`voided`. Nothing is deleted, the serial stays consumed, and a reissue takes
the *next* number rather than the old one.

`certificate_voids` is append-only — a trigger raises on UPDATE and on DELETE
— so the explanation for a gap outlives the correction it explains. This is
what makes `assessLedger` able to say `complete` for a book with a voided
certificate in it: the number is spoken for.

The state that must never occur is a gap with nothing explaining it.
`assessLedger` names it `unexplained`, and the only way to produce it is to
delete a row, which the table refuses.

### The invariant is checked on every reset

`pnpm db:reset:verified` fails if any series' counter has fallen to or below
the highest serial its book has issued — the precondition for a collision on
the next allocation. This caught a genuine bug in the Slice 4 seed on its
first run: Malinis was seeded with `next_sequence = 1` while already holding a
certificate numbered 1.

## The hand-off from Slice 3

`issue_certificate` refuses anything that is not `ready_for_issue`, with
`REQUEST_NOT_READY_FOR_ISSUE`. That is the entire hand-off: Slice 3 stopped at
that state on purpose, and Slice 4 starts from it.

The pgTAP suite drives a request through the *real* Slice 3 functions
(`review_request` → `mark_request_ready`) rather than writing the state
directly, because `document_requests_guard` correctly refuses the skip even on
the owner path — so the hand-off is exercised rather than assumed.

A partial unique index enforces the other half:

```sql
create unique index certificates_one_active_per_request_idx
  on public.certificates (request_id)
  where status = 'issued';
```

One live certificate per request, ever. A voided one does not block a reissue,
because it is not live. This means "how many valid certificates exist for this
request" always has the answer 0 or 1, without a scan and without a
convention.

## Issuance refuses for six reasons, and the order matters

`issuanceBlock` in `rules/issuance.ts` returns one of `not_permitted`,
`not_ready`, `already_issued`, `no_template`, `template_type_mismatch`,
`no_series` — a reason, not a boolean, because the answers need different next
actions and collapsing them into `false` is how a staff member ends up at a
disabled button with no idea what to do.

Capability is checked **first** (Phase 4 §13.6). If readiness were checked
first, a caller without the capability could tell a ready request from a draft
one — a probe for the state of somebody else's request. The refusal is
identical either way, and the unit suite asserts that explicitly.

Every rule here is re-checked inside `issue_certificate` and fails closed. The
TypeScript is a mirror for the interface, never the enforcement.

## Capabilities

Six, seeded by migration `20260809010000`:

| Capability | Held by |
| --- | --- |
| `certificates.read` | `barangay_staff`, `barangay_administrator` |
| `certificates.issue` | `barangay_administrator` |
| `certificates.void` | `barangay_administrator` |
| `certificates.manage_templates` | `barangay_administrator` |
| `certificates.manage_series` | `barangay_administrator` |
| `certificates.artifact.read` | `barangay_administrator` |

Residents hold **none** of them; their access to their own certificate is
self-scoped RLS, exactly as with requests. Platform administrators hold none
either — no tenant data, ever (ADR-0006).

**This mapping contradicts the roadmap** (Slice 4 §6, "staff issue per
capability") and is recorded as an open decision — see **DEC-CERT-02** in the
[decision log](../decisions/blockers.md). 4A followed the D2-04 and Slice 3
precedent instead: staff review, administrators commit. Changing it is a row
update in `role_permissions`, not a code change, because nothing branches on a
role key.

Artifact reading is a **separate** capability from certificate reading, for
the same reason D2-04 separated evidence from applications: the file is its
own surface, and being able to work the queue is not the same as being able to
open everybody's documents.

## Verification tokens

`certificates.verification_token` is 32 bytes from
`extensions.gen_random_bytes(32)`, hex-encoded, unique, and constrained to
`^[a-f0-9]{64}$`. It is generated **in the database** and never in a browser:
a token is a bearer credential and the only safe generator is a CSPRNG under
the server's control.

It is immutable. `certificates_guard` refuses any change, because by the time
anyone wants to rotate one, a printed QR code is already in somebody's hand.

256 bits is what makes a bare-token lookup safe: at any plausible request
rate, guessing one is not a threat model, so the public endpoint can answer a
token without becoming an enumeration oracle. Sequential or derived tokens
would make that false — `looksNonSequential` exists to catch the change that
would actually happen, someone replacing the generator with a counter or a
hash of the id.

## The public verification path is not an anon grant

`anon` holds **zero** privileges on every certificate table, asserted at grant
level in pgTAP (`throws_ok … 42501`) rather than as a row count, because a
grant-level denial is a stronger guarantee than an empty result.

4D will read through the `public-certificate-verification` service-role path,
which `eslint.config.mjs` reserved before this slice began — no new ADR
needed. Opening `certificates` to anonymous SELECT would make it an
enumeration surface however narrow the policy, and the endpoint's whole job is
to answer one token at a time.

## Audit records the act, never the content

Eight trigger-written actions: `certificate.issued`, `certificate.voided`,
`certificate.void_recorded`, `certificate.template_created`,
`certificate.template_updated`, `certificate.series_created`,
`certificate.series_updated`, `certificate.artifact_registered`.

What they carry is deliberately narrow, and what they must never carry is
asserted as a property of every row:

- `certificate.issued` records the request, template, series and **serial
  sequence** — the book must stay answerable.
- `certificate.void_recorded` records that a reason **exists**
  (`reason_present: true`) and never the reason itself. Staff-authored free
  text is the classic way personal circumstance leaks into an append-only log
  that outlives every other record of it.
- Template events record the code, the field names that changed, and the
  placeholder flag — never the body.
- `certificate.artifact_registered` records the certificate and the mime type,
  never the storage path.

pgTAP asserts the absences directly: no verification token, no artifact path,
and no resident name appears in any certificate audit entry.

## The outbox gains exactly one intent

`certificate.ready_for_release`, enqueued by `issue_certificate` in the same
transaction as the certificate row. Payload is `{certificate_id, request_id,
person_id}` — three uuids, nothing else. The approved-intent inventory in
`12_outbox_and_slice_review` grows from six to seven, and the per-family key
assertion is extended so widening one family cannot widen another.

The serial is deliberately **not** in the payload, even though "your
CERT-2026-00042 is ready" is the obvious message. The serial is on the printed
document; Slice 8 will fetch what it needs under the recipient's own
authority.

Voiding enqueues nothing. Nobody has decided whether a resident should be told
their certificate was withdrawn, and inventing that notification is not 4A's
call.

## Artifacts: metadata only, so far

`certificate_artifacts` exists and `register_certificate_artifact` reserves a
row and returns a path, but **4A generates no PDF**. The table is here because
the issuance transaction is where the path is decided, and 4B needs somewhere
to put it.

The path is `barangay_id/certificate_id/artifact_id` — three uuids, following
the Slice 2F evidence pattern. It is not *meaningless*: anyone holding it
learns which tenant and which certificate. What it deliberately contains is no
name, no serial, no verification token and nothing guessable — you cannot
derive one from a serial number or walk them in order. The bucket is private
and reachable only under capability, so the path is a locator, not a
credential.

The rest of the rules are set now so 4B inherits them: private bucket only, no
bytes in the database, no public URL, and no service-role key in a browser.
`mime_type` is constrained to `application/pdf` — a CHECK, not a convention.

## What is unconfirmed, and how the code says so

Three things are undecided, and all three are carried as **data** rather than
as comments, following the B-08 pattern from Slice 3:

| Column | Blocker | Meaning |
| --- | --- | --- |
| `certificate_templates.content_is_placeholder` | B-05 / B-06 | the wording is not approved |
| `certificate_series.format_is_placeholder` | DEC-CERT-01 | the serial format is not approved |
| `certificates.serial_is_placeholder` | DEC-CERT-01 | carried forward onto every issued serial |

All three default to `true`, none of them is a parameter of the function that
creates the row, and `pnpm db:reset:verified` fails if any seeded row claims
otherwise. Confirming wording or a format is an owner act recorded against the
blocker — not something a caller asserts while inserting.

`format_certificate_serial` renders `PREFIX-YEAR-PADDED`. That shape is
**synthetic and invented for local development**, documented as such in the
function body, and it is not a proposal. `SERIAL_PLACEHOLDER_NOTICE` reads
"Format not yet confirmed" — deliberately different wording from B-08's fee
notice, so a reader who sees both learns which decision is outstanding.

The seeded template bodies are marked `SYNTHETIC TEST TEMPLATE — NOT APPROVED
WORDING (B-05)` in the text itself, so a screenshot cannot be mistaken for a
draft of the real thing.

## What 4A deliberately does not do

- **No PDF generation.** No PDF dependency is in `package.json` yet; 4B owns
  the choice.
- **No QR code.** 4D owns it. The token it will encode exists and is stable.
- **No public verification UI**, and no route.
- **No issuance refusal.** Voiding withdraws a certificate that was issued.
  Declining a request that should never be issued is a different act on a
  different table, and it is DEC-REQ-01's to rule on — see the alternatives
  recorded there.
- **No user interface of any kind.** 4A is domain and proofs.

## Testing

| Suite | File | Count |
| --- | --- | --- |
| pgTAP | `18_certificate_foundation.test.sql` | 79 |
| Unit | `tests/unit/certificates/serial-rules.test.ts` | 17 |
| Unit | `tests/unit/certificates/issuance-rules.test.ts` | 27 |
| Unit | `tests/unit/certificates/verification-token-rules.test.ts` | 20 |

The pgTAP suite asserts the accountability property directly rather than
inferring it: a duplicate is refused by the database, the counter refuses to
rewind, a voided certificate keeps its number, a void record cannot be deleted
or rewritten, a failed issuance consumes nothing, and a reissue takes a
different serial.

The "consumes nothing" test is the one worth keeping: it captures the counter,
triggers a failure *after* the eligibility checks, and asserts the counter is
untouched — the property that stops a mistyped issuance from burning a number.
