# Identity and access — Slice 1 architecture

The authorization foundation every later slice builds on. Read ADR-0005 for
the role catalog and provisioning policy; read `audit-logging.md` for the
audit side.

## Authentication

- **Identity provider:** Supabase Auth, email/password only in Slice 1. No
  public sign-up exists (ADR-0005) — the sign-in screen states how accounts
  are provisioned.
- **Sign-in** (`signInAction`): zod-validated, `signInWithPassword` through
  the request-scoped server client. Every failure — wrong password, unknown
  address, malformed address — returns ONE uniform message (Phase 5 §11.2);
  failures are audited sessionlessly with an email digest, successes on the
  caller's own session.
- **Sessions:** Supabase SSR cookies. The middleware refreshes them on every
  request with `getUser()` (revalidates the JWT — never `getSession()`), and
  bounces anonymous requests to `/sign-in` for `/dashboard`, `/staff`,
  `/platform`, `/account`. That bounce is CONVENIENCE; enforcement lives in
  the action chain and RLS.
- **Sign-out** (`signOutAction`): audited while the session still exists,
  then `auth.signOut()`, active-barangay cookie cleared, redirect.
- **Callback** (`/auth/callback`): PKCE code exchange for email links
  (confirmation/recovery, used by later slices and hosted environments);
  failure lands on `/sign-in` with no detail.
- **No `?next=` redirect parameter** anywhere: the destination is computed
  from the authorization context (`landingRouteFor`), eliminating the
  open-redirect class outright.

## Authorization pipeline

One system, used identically by server components, route handlers and server
actions:

```
auth_context()  (SECURITY DEFINER, scoped to auth.uid() by construction)
      │  one RPC round trip, validated by zod, cached per request
      ▼
getAuthorizationContext()  →  null on ANY failure (fail closed)
      ▼
requireAuthenticatedUser / requireMembership / requirePermission /
requirePlatformPermission        (guards; denials audited, then thrown)
      ▼
can() / activeMembership() / hasStaffCapability()   (pure predicates for UI)
      ▼
RLS policies + composite FKs     (the database enforces the same rules again)
```

Rules of the pipeline:

- Authorization resolves from LIVE database state (`memberships` →
  `membership_roles` → `role_permissions`), never from JWT claims or
  `auth.users` metadata (Phase 4 DB-ADR-03; README non-negotiable).
- A client-supplied barangay id is never trusted: guards verify ACTIVE
  membership; the active-barangay cookie is re-validated against live
  memberships on every read (`resolveActiveBarangay`) and silently falls back
  when forged or stale.
- Invited and disabled memberships resolve ZERO permissions — enforced in
  `auth_has_permission()`, in `auth_context()` and in the pure rules.
- Platform authority and tenant membership are disjoint. A platform
  administrator with no membership sees no tenant data anywhere
  (Phase 4 §16.4) — RLS-tested.
- UI hides controls the caller may not use, and the server re-authorizes
  every mutation regardless (Phase 3 ADR-01).

## Role and permission matrix

See ADR-0005 for the catalog. Enforcement summary per table
(authenticated role; anon holds NO grant on any table):

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `barangays` | active member of the row, or `platform.barangay.read` | — | — | — |
| `user_profiles` | self, or co-member visible via `membership.read` | — (trigger from auth.users) | self row, `display_name` column ONLY (column grant) | — |
| `roles` / `permissions` / `role_permissions` | any authenticated (capability vocabulary, no tenant data) | — | — | — |
| `memberships` | own row, or `membership.read` | `membership.manage` | `membership.manage` (status only; rebinding trigger-blocked) | — (revocation = `disabled`) |
| `membership_roles` | own membership's rows, or `membership.read` | `role.assign` | — | `role.assign` |
| `platform_role_assignments` | self, or platform admin | platform admin | — | platform admin |
| `audit_events` | tenant rows: `audit.read`; platform rows: `platform.audit.read` | — (function only) | — (trigger-refused) | — (trigger-refused) |

RLS is ENABLED **and FORCED** on all nine tables. The owner paths used by
SECURITY DEFINER helpers, triggers and seeds are explicit
`to postgres, service_role` policies — visible in `pg_policies`, asserted by
pgTAP — not an implicit ownership bypass.

Self-elevation is blocked in layers: staff/residents lack `role.assign`
(policy); platform roles cannot be granted through the tenant path (scope
CHECK + composite FK); `platform_role_assignments` writes require an EXISTING
platform admin; `granted_by` is stamped from `auth.uid()` by trigger, never
accepted from input.

## Local test accounts

Password for every seeded account: `password123-local` (synthetic fixtures,
Phase 6 §22.2-guarded; never valid anywhere hosted).

| Email | Role(s) | Purpose |
| --- | --- | --- |
| `platform.admin@barangay-hub.test` | platform_administrator, NO membership | Console access without tenant access |
| `admin.sanisidro@barangay-hub.test` | barangay_administrator @ San Isidro | Full tenant admin |
| `staff.sanisidro@barangay-hub.test` | barangay_staff @ San Isidro | Read-only roster |
| `resident.sanisidro@barangay-hub.test` | resident @ San Isidro | Self-service only |
| `admin.malinis@barangay-hub.test` | barangay_administrator @ Malinis | Tenant-B admin (isolation tests) |
| `resident.malinis@barangay-hub.test` | resident @ Malinis | Cross-tenant invite target |
| `disabled.sanisidro@barangay-hub.test` | resident @ San Isidro (disabled) | Revocation behaviour |
| `invited.sanisidro@barangay-hub.test` | barangay_staff @ San Isidro (invited) | Inert-until-activation behaviour |
| `dual.member@barangay-hub.test` | resident @ both | Barangay switcher |

## Security assumptions and known limitations

- **Assumption:** `service_role` and `postgres` are trusted principals; every
  named use is allow-listed, typed and greppable (Phase 4 §25.6).
- **Assumption:** the local/CI seeded password is public by design; hosted
  environments never run Tier 3 seeds (guard) and hold no accounts yet.
- **Limitation:** no rate limiting on sign-in beyond Supabase Auth defaults —
  tracked in the risk register (R-1-04).
- **Limitation:** no MFA enforcement (explicitly out of Slice 1 scope; TOTP
  remains available account-side).
- **Limitation:** the last `barangay_administrator` of a barangay can disable
  their own membership; recovery is a platform provisioning operation (later
  slice). Tracked as R-1-05.
- **Limitation:** transactional outbox and PLT-08 readiness endpoint are
  deferred with rationale — no notification producers and no job queues exist
  yet. Recorded in `docs/decisions/blockers.md`.
- **CSP:** nonce-based, strict-dynamic, applied in middleware; development
  adds `'unsafe-eval'` and a websocket source for Fast Refresh only.

## Slice 1 acceptance criteria (all verified)

Local sign-in/sign-out with seeded accounts; protected routes enforce
sessions server-side; profiles/memberships/roles/permissions live in
server-controlled tables; tenant isolation, role inertness, self-elevation
prevention and audit protection proven by 104 pgTAP assertions; 100 unit
assertions over the pure layers; e2e journeys for every seeded persona;
`pnpm verify` and `pnpm verify:full` green; generated types current.
