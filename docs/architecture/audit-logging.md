# Audit logging — Slice 1 architecture

Append-only, same-transaction, hash-sealed. The design goal: an identity
change that is NOT audited must be unrepresentable, and an audit row that has
been altered must be detectable.

## Event model

One table, `public.audit_events`:

| Field | Content |
| --- | --- |
| `actor_user_id` | `auth.uid()` at write time — derived, never a parameter. Null for system/seed/sessionless events. No FK: history outlives accounts. |
| `barangay_id` | Tenant scope; NULL = platform scope. Determines who may read the row. |
| `action` | Constrained dotted name (`membership.status_changed`, `auth.sign_in`, `authz.denied`, …). |
| `target_type` / `target_id` | What was acted on. |
| `outcome` | `success` or `denied`. |
| `source` | `app` (application writers) or `db` (triggers) or `seed`. |
| `correlation_id` | Request correlation where available — joins an audit row to server logs. |
| `metadata` | SAFE facts only: status values, role keys, field NAMES, digests. Never secrets, tokens, or personal values (Phase 6 §37.2). |
| `metadata_hash` | STORED generated sha-256 of the metadata (Phase 4 DB-ADR-08) — tamper evidence, pgTAP-verified. |

## Write paths (exactly three)

1. **Database triggers** on `memberships`, `membership_roles`,
   `platform_role_assignments`, `user_profiles` — fire in the SAME transaction
   as the mutation, so the README guarantee is structural: no code path can
   change identity state without its audit entry, and both commit or roll
   back together.
2. **`append_audit_entry()` on the caller's session** — in-session
   application events: sign-in success, sign-out, authorization denials. The
   actor is the database's own `auth.uid()`.
3. **`append_audit_entry()` via service-role** (`'audit-append'`, the one
   allow-listed importer) — SESSIONLESS security events only, i.e. failed
   sign-ins, where no identity exists to write with.

A denial raised INSIDE a database function cannot audit itself — the raise
rolls its own entry back. Denials are therefore audited by the layer above
the throw (guard or action), in a transaction that survives. This is why the
invite RPC audits success in-transaction but leaves denial audit to the app.

## Protection

- No UPDATE/DELETE grant to any client role; no policies for those verbs.
- A `BEFORE UPDATE OR DELETE` trigger refuses mutation **for every role
  including `postgres`** — pgTAP-verified.
- Read access is scoped: tenant rows to that tenant's `audit.read` holders;
  platform rows to `platform.audit.read`. A tenant admin cannot read another
  tenant's trail; a platform administrator cannot read any tenant's trail.
- Profile-change events are written per membership tenant (visible to that
  tenant's auditors) — never into the platform scope, which would leak member
  activity across the Phase 4 §16.4 boundary.

## What is deliberately NOT stored

Passwords, tokens, cookies, key material, email addresses (digest only),
display-name VALUES (field names only), or any free-text user input.

## Retention and archival (documented, not implemented)

Slice 1 retains everything: volumes are trivial and no retention schedule is
approved (`docs/placeholders.yaml` — retention periods resolve in Slice 9,
blocker B-21). When that lands, the expected mechanism is a scheduled
service-role export to cold storage followed by ranged deletion executed by a
migration-reviewed procedure — never by a client-facing path. The
`occurred_at` + identity index already supports ranged archival without
schema change.
