# Barangay Hub v2 — Project Specification

**Single source of truth for the project.** Where this document and the code
disagree, the code is the fact and this document has a defect — file it.

| | |
| --- | --- |
| Specification version | 1.2 |
| Describes repository state at | commit `9fbd783` (+ roadmap adoption, 2026-08-01) |
| Repository | `github.com/heidimuadib/barangay-hub-v2` |
| Execution order | [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) — this file says *what the system is*; the roadmap says *the order it gets built* |
| Maintenance rule | Update this file in the same pull request as any change it describes; CI reviewers treat a stale specification as a review defect |

**Status vocabulary used throughout:**

- **Implemented** — exists in this repository at the commit above and is covered
  by the verification gates (§16).
- **Planned** — recorded in this repository's decision log, risk register or
  placeholder register as upcoming work with a named owner.
- **Future** — referenced by code comments, feature flags or the placeholder
  register; sequenced in the
  [implementation roadmap](./IMPLEMENTATION_ROADMAP.md) but not yet detailed
  to build-level.
- **Blocked** — cannot proceed until a named open decision resolves.

---

## 1. Project Vision

A multi-tenant civic-services platform for Philippine barangays: residents
request barangay documents, track their requests and verify certificates
online, while barangay staff administer the same transactions — including
walk-ins — through one system, with every consequential action audited.

Sources: `README.md`, root layout metadata ("Request barangay documents, track
requests, and verify certificates online"), the Phase 1–6 citations threaded
through the codebase. The platform replaces a legacy PHP application that
remains frozen in its original repository
([promotion runbook](./runbooks/repository-promotion.md)).

## 2. Goals

Goals with in-repo evidence, in delivery order of their supporting mechanisms:

1. **Security before features.** The identity, authorization, RLS and audit
   foundation shipped before any business feature, and later slices build on
   it rather than re-deciding it (Slice 1; §9–§13).
2. **Tenant isolation as a structural property.** One deployment serves many
   barangays; cross-tenant access must be unrepresentable, not merely
   forbidden (§8, §12).
3. **Every consequential mutation auditable** in the same transaction that
   performs it (§13).
4. **Resident and walk-in equivalence.** Both transaction styles flow through
   the same domain services (README non-negotiable; Future — no domain
   services exist yet).
5. **Honest interfaces.** Unconfirmed fees, templates and legal text remain
   visibly placeholder-marked until owners confirm them
   ([placeholder register](./placeholders.yaml)); no interface is made to look
   finished by hiding what is not decided.
6. **Accessibility as part of Definition of Done** — WCAG 2.2 AA per slice
   (§16, §19).
7. **No real resident data or government-ID files in any hosted environment**
   until residency and environment decisions resolve
   (DEC-ENV-03/DEC-ENV-04; §11).

## 3. Product Overview

Four user-facing surfaces, implemented today as Next.js route groups
(one deployment, not four — [ADR-0001](./adr/0001-single-application-repository.md)):

| Surface | Route group | Audience | State at `9fbd783` |
| --- | --- | --- | --- |
| Public portal | `(public)` | Anyone | Placeholder page; access-denied page. Real portal (US-UI-006) is **Future** |
| Resident portal | `(resident)` | Authenticated residents | **Implemented (minimal):** dashboard with live membership context, account page with self-service display-name editing |
| Staff workspace | `(staff)` | Barangay staff/administrators | **Implemented (minimal):** workspace shell, member roster with invite/status/role administration, tenant audit-log viewer |
| Platform console | `(platform)` | Platform operators | **Implemented (read-only):** tenant metadata list, operator list, platform-scope audit trail. Visually distinct chrome so operators always know which console they are in (Phase 5 §13.1) |

Auth surface: `(auth)` sign-in screen and PKCE callback. There is deliberately
**no sign-up surface** ([ADR-0005](./adr/0005-slice1-role-catalog-and-provisioning.md), DEC-AUTH-01).

Business features — document requests, certificates, payments, complaints,
mediation, announcements — are **Future** (§6, §17).

## 4. Stakeholders

Named in this repository's decision records; no other stakeholder list exists
in-repo:

| Stakeholder | Appears as | Owns |
| --- | --- | --- |
| Product owner | Decision owner | DEC-ENV-01/-02, DEC-AUTH-01, DEC-SCOPE-01 (jointly), role catalog (jointly) |
| Barangay Captain | Decision owner | Role catalog and environment topology (jointly) |
| Data Protection Officer | `captain-and-dpo` in the placeholder register | Data-residency acceptability (DEC-ENV-03) |
| Legal reviewer | Decision owner | RA 10173 residency review (DEC-ENV-03) |
| Tech lead | Decision owner | ADR-0001/-0003, repository decisions, seed-safety |
| Repository owner | Operational owner | GitHub org/repo, Supabase account, MFA action |
| Slice implementers | Risk-register owners | Per-risk mitigations (R-0B-05/-06, R-1-04/-06, …) |

End users: residents; barangay staff; barangay administrators; platform
operators (§5).

## 5. User Roles

**Implemented** — the working catalog, seeded by migration
`20260801020000_identity_reference_data.sql`. Names are a **proposed** set
awaiting owner confirmation (DEC-ROLE-01); renames are row updates because no
code branches on role keys ([ADR-0005](./adr/0005-slice1-role-catalog-and-provisioning.md)).

| Role key | Scope | Capabilities | Notes |
| --- | --- | --- | --- |
| `platform_administrator` | platform | `platform.barangay.read`, `platform.audit.read` | **No tenant data access** (Phase 4 §16.4) — tenant support access arrives later as a time-boxed, audited grant |
| `barangay_administrator` | barangay | `membership.read`, `membership.manage`, `role.assign`, `audit.read` | Full in-tenant administration |
| `barangay_staff` | barangay | `membership.read` | Reads the roster; mutates nothing in the current build |
| `resident` | barangay | *(none)* | Self-service only, expressed through self-scoped RLS policies rather than grants over others' data |

Structural properties: platform and barangay scopes are separated by composite
foreign keys plus CHECK constraints, so a platform role cannot be granted
through the tenant path or vice versa; capabilities are dotted keys constrained
by CHECK; roles on an `invited` or `disabled` membership resolve **zero**
permissions.

Account provisioning — **Implemented today:** local/CI seed fixtures, or a
barangay administrator invites an existing account by exact email
(`create_membership_by_email`, uniform ineligibility errors — not an
enumeration oracle). **Planned (approved policy, arrives with Slice 2):**
DEC-AUTH-01 is resolved as **Option C hybrid**
([ADR-0006](./adr/0006-resident-provisioning-and-registry-decisions.md)) —
public email/password sign-up with mandatory confirmation, unverified until
reviewer approval, staff creation/invitation retained, both paths through one
domain-service set.

## 6. Functional Modules

Feature modules live under `apps/web/src/features/<name>/` with an enforced internal
grammar (`actions/ services/ repositories/ rules/ schemas/ components/ types/`,
plus `index.ts` barrel) — see §15.

**Implemented:**

| Module | Provides |
| --- | --- |
| `identity` | Sign-in/out, PKCE callback, authorization context and guards, active-barangay selection, profile editing, sign-in form components |
| `memberships` | Roster listing, invite-by-email, membership status transitions, barangay-role grant/revoke, roster UI |
| `audit-trail` | Tenant and platform audit-log queries and table UI |
| `platform` | Read-only console queries (tenant metadata, operator assignments) |
| `apps/web/src/services/audit` | Sessionless security-event writer — the one allow-listed service-role importer (`audit-append`) |
| `apps/web/src/hooks` | `useRefreshOnSuccess` — post-mutation route refetch (R-1-06) |

**Planned (deferral recorded in the [decision log](./decisions/blockers.md)):**
transactional outbox (arrives with the notification slice, EPIC-11/14); PLT-08
authenticated readiness endpoint (platform slice); full US-UI-002 shell chrome.

**Future (in-repo evidence, no in-repo plan):**

| Module | Evidence |
| --- | --- |
| Documents / certificates | `certificates` and `documents` service paths pre-declared in the service-role allow-list (`eslint.config.mjs`); placeholder register B-05…B-08 |
| Payments / official receipts | Placeholder register: OR series format, voided-number policy (B-11) |
| Complaints / mediation / summons | Placeholder register B-09; `next.config.ts` referrer note for case routes |
| Tenant provisioning & support grants | `provision-tenant` / `establish-grant` pre-declared in the allow-list; `tenant-provisioning` / `support-grant-establishment` typed reasons |
| Notifications (email/SMS) | EMAIL_* env schema, Resend provider stub, EPIC-11/14 citations |
| Assistance, households, feedback, SMS channel, e-signature | `FLAG_*` environment flags, all defaulting off |

## 7. Technical Architecture

**Implemented.**

| Layer | Technology (resolved versions at `9fbd783`) |
| --- | --- |
| Framework | Next.js 15.5 (App Router, Server Actions), React 19 |
| Language | TypeScript 5.8, strict + `exactOptionalPropertyTypes` ([ADR-0003](./adr/0003-strict-typescript-flags.md)) |
| Styling | Tailwind CSS 4, design tokens in `apps/web/src/styles/globals.css` |
| Backend | Supabase: Postgres 17.6, GoTrue auth, PostgREST — supabase-js 2.111 / `@supabase/ssr` 0.12 |
| Validation | Zod 3.25 |
| Tooling | pnpm 11.4 (Node ≥ 22.13), Vitest 3, Playwright 1.52, ESLint 9, Prettier, Husky 9, pinned Supabase CLI |

**Layering** (enforced by `eslint-plugin-boundaries` — an architecture that is
lint-checked, not aspirational; `apps/web/scripts/verify-boundaries.mjs` proves the
rules actually fire):

```
apps/web/src/app        routing only — thin shells, page-level convenience guards
apps/web/src/features   all behaviour; cross-feature imports ONLY via barrels
apps/web/src/services   cross-cutting infrastructure (audit; later: outbox, storage…)
apps/web/src/lib        framework adapters: supabase clients, env, errors, logger
apps/web/src/utils      pure functions
        import direction: app → features → services → lib → utils
```

Since [ADR-0007](./adr/0007-monorepo-workspace-structure.md) the repository is
a pnpm workspace: the application above lives in `apps/web`, the Supabase
backend (migrations, seeds, pgTAP, generated types) in `backend/supabase`, and
shared workspace configuration in `packages/config`. The layering and its lint
enforcement are unchanged — the workspace adds package seams *around* the app,
it does not replace the boundary rules *inside* it.

**Request path for a mutation:** client component → Server Action (zod parse →
audited guard → service → repository, user-scoped client) → RLS re-enforces →
database triggers audit → `revalidatePath` + explicit client refetch.
The server is the sole mutation authority; the browser client exists for auth
session reads and future Realtime only.

**Supabase client discipline:** the request-scoped, RLS-subject server client
is the default for all server code. The service-role client requires a typed
reason from a closed set of nine (eight named system operations plus scheduled
jobs — Phase 4 §25.6), is import-restricted to an ESLint allow-list, and every
addition requires an ADR. Architecture tests
(`apps/web/tests/unit/architecture/service-role.test.ts`) pin the exact importer set —
currently one file.

**Edge middleware** performs session cookie refresh (`getUser()`, never
`getSession()`), correlation-ID assignment, the nonce-based CSP (§11), and
coarse redirect gating for `/dashboard`, `/staff`, `/platform`, `/account` —
defence-in-depth only, never the authorization boundary.

**Errors and results:** typed `AppError` hierarchy → `Result` envelope at the
action boundary; internal messages never reach clients; correlation IDs join
user-visible failures to structured logs. Structured JSON logging with
deep redaction (`apps/web/src/lib/logger/redact.ts`) — secret- and PII-shaped keys and
values are stripped centrally, not at call sites.

## 8. Database Architecture

**Implemented** — seven forward-only migrations under `backend/supabase/migrations/`.

Tables (all in `public`):

| Table | Purpose |
| --- | --- |
| `barangays` | Tenant root; `code` unique, `test-` prefix marks synthetic tenants |
| `user_profiles` | Minimal profile; `display_name` is the only self-writable column |
| `roles`, `permissions`, `role_permissions` | Reference catalogs, written by migration only; scope-consistent via composite FKs |
| `memberships` | User↔barangay with `invited/active/disabled` lifecycle; `unique (id, barangay_id)` is the composite-FK anchor |
| `membership_roles` | Barangay-scoped assignments; composite FK `(membership_id, barangay_id)` makes cross-tenant rows unrepresentable (Phase 4 DB-ADR-01) |
| `platform_role_assignments` | Platform-scoped assignments, structurally disjoint from the tenant path |
| `audit_events` | Append-only trail (§13) |

Other objects: 2 enums (`membership_status`, `role_scope`); 14 functions — all
SECURITY DEFINER with pinned `search_path` (authorization primitives, audit
writer, context resolver, invite RPC, trigger bodies); 13 triggers
(automatic audit, immutability guards, `granted_by` stamping, `updated_at`,
profile provisioning from `auth.users`); extensions `pg_trgm`, `unaccent`,
`pgcrypto`, `btree_gin` in the `extensions` schema.

Conventions: reference data lives in migrations; development fixtures live in
`backend/supabase/seed/` behind a guard that refuses to run wherever a non-`test-`
tenant exists (Phase 6 §22.2). Generated types
(`backend/supabase/generated/database.types.ts`) are committed and drift-checked in CI
(`pnpm types:check`). Local and CI stacks run Postgres 17, reconciled with the
hosted project in Slice 0b ([assessment](./assessments/hosted-supabase-assessment.md)).

Environments ([ADR-0002](./adr/0002-supabase-environment-topology.md)): local
CLI stack is the primary development environment; CI uses an ephemeral stack;
the hosted project `weadxbwtupvjqaqploij` is a **non-production** Hosted
Integration Environment whose final role is open (DEC-ENV-01); production is
**not yet designated**.

## 9. Authentication

**Implemented.** Supabase Auth (GoTrue), email/password only.

- Uniform failure copy for wrong password, unknown and malformed addresses
  (Phase 5 §11.2 — no account-enumeration oracle); failures audited
  sessionlessly with an email digest, successes on the caller's own session.
- Sessions via `@supabase/ssr` cookies; middleware revalidates with
  `getUser()` on every request; sign-out is audited *before* the session is
  destroyed and clears the active-barangay cookie.
- `/auth/callback` performs PKCE code exchange for email links; failures land
  on sign-in with no detail.
- Post-sign-in destination is computed from the authorization context
  (`landingRouteFor`) — **no `?next=` redirect parameter exists anywhere**,
  removing the open-redirect class outright.
- No public sign-up **in the current build**; the approved policy
  (DEC-AUTH-01 → Option C hybrid,
  [ADR-0006](./adr/0006-resident-provisioning-and-registry-decisions.md)) is
  **Planned** for Slice 2, with anti-enumeration and rate limiting as build
  requirements. MFA enforcement remains out of scope; TOTP available
  account-side.
- **Planned:** app-level sign-in rate limiting when hosted exposure begins
  (R-1-04; Supabase defaults only today).

Details: [identity-and-access.md](./architecture/identity-and-access.md).

## 10. Authorization

**Implemented.** One pipeline used identically by pages, route handlers and
Server Actions:

```
auth_context()                    SECURITY DEFINER; scoped to auth.uid() by construction
   ↓ one RPC, zod-validated, cached per request
getAuthorizationContext()         null on ANY failure — fail closed
   ↓
requireAuthenticatedUser / requireMembership /
requirePermission / requirePlatformPermission     guards; denials audited, then thrown
   ↓
can() / activeMembership() / hasStaffCapability()  pure predicates for UI affordances
   ↓
RLS + composite FKs               the database enforces the same rules again
```

Invariants: authorization resolves from live database state
(`memberships → membership_roles → role_permissions`), **never** from JWT
claims or auth metadata (Phase 4 DB-ADR-03); client-supplied barangay IDs are
never trusted — the active-barangay cookie is re-validated against live
memberships on every read and falls back silently when forged or stale; UI
hides controls it may not offer *and* the server re-authorizes every mutation
regardless (Phase 3 ADR-01); platform authority and tenant membership are
disjoint (a platform administrator with no membership sees no tenant data —
RLS-tested).

## 11. Security Model

**Implemented controls, each with its enforcement mechanism:**

| Control | Enforced by |
| --- | --- |
| Deny-by-default database access | Zero anon grants/policies/function-execute; authenticated holds only policy-served verbs |
| Tenant isolation | Composite FKs + forced RLS + pgTAP isolation matrix |
| No secrets in the browser | ESLint restriction + `check:bundle-secrets` build scan + runtime `assertNoPublicSecrets` (three layers) |
| Secret scanning | gitleaks over full history in CI (`.gitleaks.toml`), plus credential-shaped-literal architecture tests |
| CSP | Nonce-based, `strict-dynamic`, `frame-ancestors 'none'`, built per-request in middleware; dev-only `unsafe-eval` |
| Security headers | `nosniff`, `DENY` framing, referrer and permissions policies in `next.config.ts` |
| No PII in URLs | No-parameter policy, e2e-asserted (P6-C-E) |
| No PII/secrets in logs | Central deep redaction; field names retained, values stripped |
| Wrong-tenant indistinguishable from not-found | Uniform errors at RPC, action and page level (Phase 4 §13.6) |
| Anti-enumeration | Uniform sign-in failures; uniform invite ineligibility |
| Synthetic data only | Seed guard refuses non-`test-` tenants; DEC-ENV-04 prohibition standing; hosted project verified empty (Slice 0b) |
| Environment validation | Fails at boot with named reasons; booleans parsed strictly; prod-only requirements enforced |

**Open security posture items** are tracked in the
[risk register](./risk-register.md) — highest severity: hosted free tier has no
PITR (R-0B-02), Supabase Owner account lacks MFA (R-0B-03), RA 10173 residency
unconfirmed (R-0B-09).

## 12. RLS Model

**Implemented.** RLS is ENABLED **and FORCED** on all nine tables. Forcing
applies to the table owner too, so the owner paths used by SECURITY DEFINER
helpers, triggers and seeds are explicit `to postgres, service_role` policies —
visible in `pg_policies` and pgTAP-asserted, never an implicit ownership
bypass.

Authenticated-role matrix (anon holds nothing):

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `barangays` | active member, or `platform.barangay.read` | — | — | — |
| `user_profiles` | self, or co-member via `membership.read` | — (trigger) | self row, `display_name` column only | — |
| catalogs (3) | any authenticated (capability vocabulary, no tenant data) | — | — | — |
| `memberships` | own row, or `membership.read` | `membership.manage` | `membership.manage` (status only; rebinding trigger-blocked) | — (revocation = `disabled`) |
| `membership_roles` | own membership's rows, or `membership.read` | `role.assign` | — | `role.assign` |
| `platform_role_assignments` | self, or platform admin | platform admin | — | platform admin |
| `audit_events` | tenant rows via `audit.read`; platform rows via `platform.audit.read` | — (function only) | — (trigger-refused) | — (trigger-refused) |

Self-elevation is blocked in layers: policy (staff/residents lack
`role.assign`), structure (scope CHECK + composite FK bar platform roles from
the tenant path), bootstrap (platform writes require an existing platform
admin), and provenance (`granted_by` stamped from `auth.uid()`, never input).

The 104-assertion pgTAP suite (`backend/supabase/tests/`) proves the matrix: anon
denial, tenant isolation, forged-ID structural failures, permission inertness
on invited/disabled memberships, revocation immediacy, audit immutability and
fail-closed context resolution.

## 13. Audit Model

**Implemented.** Append-only `audit_events`; design goal: an identity change
that is *not* audited must be unrepresentable, and an altered audit row must be
detectable. Full narrative: [audit-logging.md](./architecture/audit-logging.md).

- **Three write paths, exactly:** database triggers on every identity table
  (same transaction as the mutation — commit or roll back together);
  `append_audit_entry()` on the caller's session for in-session events
  (sign-in success, sign-out, authorization denials — actor derived from
  `auth.uid()`, never a parameter); the service-role `audit-append` operation
  for sessionless events only (failed sign-ins).
- **Tamper evidence:** `metadata_hash` is a STORED generated sha-256 of the
  metadata (Phase 4 DB-ADR-08), pgTAP-verified for every row.
- **Protection:** no client UPDATE/DELETE grant or policy; a trigger refuses
  mutation for **every** role including `postgres`.
- **Scoped visibility:** tenant rows to that tenant's `audit.read` holders;
  platform rows to `platform.audit.read`; profile-change events are written
  per membership tenant so member activity never leaks into the platform scope.
- **Hygiene:** metadata carries statuses, role keys, field names and digests —
  never passwords, tokens, addresses or display-name values.
- **Retention:** everything retained; schedule is a **Future** decision
  (placeholder B-21, Slice 9) with the archival mechanism sketched in the
  audit architecture document.

## 14. CI/CD

**Implemented — CI.** GitHub Actions `pull-request` workflow on every push and
PR to `main`, all four jobs **required by branch protection**:

| Job | Contents |
| --- | --- |
| typecheck · lint · unit tests · build | env-template guard, tsc, ESLint, Prettier check, Vitest with coverage gate, production build, client-bundle secret scan |
| migrations · pgTAP · type drift | ephemeral Supabase stack, full replay from empty, 104 pgTAP assertions, generated-type drift check |
| end-to-end | ephemeral stack with runtime-exported throwaway keys, Playwright desktop + mobile |
| secret scan | gitleaks over the repository and full history |

Local gates: Husky pre-commit (lint-staged), commit-msg (commitlint,
Conventional Commits), pre-push (typecheck) — installed automatically by
`pnpm install`. Dependabot maintains npm and Actions dependencies.

**CD: none, deliberately.** No deployment pipeline exists; hosted writes are
prohibited until DEC-ENV-01 resolves. The first hosted frontend must set the
auth site URL and redirect allow-list (R-0B-05) and a real email provider
(R-0B-06) as part of that work.

## 15. Coding Standards

**Implemented and machine-enforced** — the standard is what the tooling
rejects, not this prose:

- TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
  ([ADR-0003](./adr/0003-strict-typescript-flags.md)); conditional-spread idiom
  for optional properties; build fails on type or lint errors.
- Layer boundaries and per-feature module grammar via
  `eslint-plugin-boundaries`; cross-feature imports only through barrels;
  rules/ modules are pure (no I/O, no React); disabling
  `boundaries/element-types` requires an ADR ([ADR-0001](./adr/0001-single-application-repository.md)).
- Raw SQL only in repositories, scripts and `supabase/`; `console.*` only in
  the logger; the service-role import allow-list is closed (§7). A meta-check
  (`verify-boundaries.mjs`) proves these rules fire, so a silently inert lint
  config cannot pass CI.
- Conventional Commits, enforced by commitlint.
- Prettier everywhere; LF line endings pinned by `.gitattributes`.
- Database: forward-only migrations, snake_case, explicit constraints and
  comments, SECURITY DEFINER only with pinned `search_path` (pgTAP-asserted
  for every definer function).

## 16. Testing Standards

**Implemented.** Four suites, all gating merges; totals at Slice 2 close
(2A–2G, 2026-08-02) with the Slice 1 figures in parentheses:

| Suite | Where | Totals | Character |
| --- | --- | --- | --- |
| pgTAP | `backend/supabase/tests/` | **358** in 13 files (104) | The security proof: RLS matrix, isolation, audit immutability, schema structure, verification transitions, evidence Storage rules, duplicate resolution, outbox hygiene. Self-contained transactions, exact plans |
| Unit/component | `apps/web/src/**`, `apps/web/tests/unit/` | **231** in 26 files (95) | Pure rules, schemas, guards (mocked repositories), hooks, plus architecture tests that independently re-assert what lint enforces |
| End-to-end | `apps/web/tests/e2e/` | **79 per viewport project** (54) | Playwright, desktop *and* Pixel 5, seeded personas; positive *and* negative journeys (staff refused audit, platform refused tenant data, forged navigation, anonymous evidence fetch) |
| Coverage | Vitest v8 | **89.06%** statements / **90.8%** branches ≥ 80/75 gate (83.28%) | Scoped to `lib`, `utils`, `hooks`, feature `rules` and `schemas` — the layers that must be exhaustively testable without a database; widened per slice |

The coverage figure is the one a clean checkout reproduces. A higher number
(90.65%) was recorded when 2F closed and is **not** reproducible: the
coverage-scoped tree is byte-identical between the two commits, yet the
measurement is stable at 89.06% across repeated runs now. The difference is
machine state during that run, not a test that was removed — the unit totals
are unchanged at 231. Record the reproducible number.

Standards: tests are never weakened to make implementation pass (enforced in
review; the R-1-06 record shows the practice); e2e mutation tests normalise
their fixtures first so interrupted runs cannot poison later ones; synthetic
identities only (`@barangay-hub.test`, documented shared local password);
failures are investigated, not dismissed — flake claims require evidence.

## 17. Roadmap

**Completed** (history preserved across the
[repository promotion](./runbooks/repository-promotion.md)):

| Milestone | Delivered |
| --- | --- |
| Slice 0a | Engineering foundation: tooling, gates, shells, local stack, extensions migration |
| Slice 0b | Hosted read-only [assessment](./assessments/hosted-supabase-assessment.md): READY WITH CONDITIONS; PG 15→17 reconciliation; risk register and decision log created |
| Slice 1 | Identity, access control, forced RLS, append-only audit (§5, §9–§13) |
| Repository promotion | Standalone repo, CI ACTIVE, branch protection, Husky |
| Post-Slice-1 hardening | R-1-06 investigation and partial fix; DEC-SCOPE-01 recorded |

**Next: Slice 2 — DEFINED, READY TO START.** DEC-SCOPE-01 is **resolved**
(the [implementation roadmap](./IMPLEMENTATION_ROADMAP.md) is the plan of
record) and DEC-AUTH-01 is **resolved — Option C hybrid provisioning**
([ADR-0006](./adr/0006-resident-provisioning-and-registry-decisions.md)),
with all within-slice decisions D2-01…04 approved. Every Slice 2 entry
criterion is met; implementation begins on its own feature branch.

**Remaining sequence** (authoritative detail, per-slice gates and effort in
the roadmap): 3 — document catalog & request intake · 4 — certificates,
serials, QR, public verification · 5 — payments, ORs, release, day closure,
call list · 6 — complaint intake & docketing · 7 — hearings, summons,
outcomes, closure · 8 — announcements & notification delivery · 9 —
reports, settings, administration, platform ops, pilot readiness · then
v1.5 flagged work (households, assistance, feedback, SMS, e-signature, …).

## 18. Slice Breakdown

For each slice: scope as recorded in-repo, and status.

- **Slice 0a — Implemented.** Repository and engineering foundation; every
  gate runnable locally without Docker; four shells rendering in isolation;
  extensions migration; noop seed.
- **Slice 0b — Implemented (assessment).** Read-only hosted assessment across
  10 checks; deliverables under `docs/assessments/`;
  [runbook](./runbooks/supabase-project-assessment.md) with a reproducible
  headless procedure. Outcome: READY WITH CONDITIONS; DEC-ENV-01 evidence
  complete, decision open.
- **Slice 1 — Implemented.** §5 and §8–§13 in full, plus minimal verification
  UI (§3), seeds for nine personas across two synthetic tenants, and the four
  test suites. Recorded deferrals: outbox, PLT-08, full shell chrome.
- **Slice 2 — Implemented (2A–2G, 2026-08-02):** registry, verification and
  outbox foundation; public sign-up and resident onboarding; staff registry and
  walk-in creation; verification queue and decision workflow; duplicate
  review and supersede-link resolution; private evidence Storage with signed
  upload/read and browser-driven submission; and the 2G hardening, outbox
  review and accessibility baseline — see
  [architecture](./architecture/resident-registry-and-verification.md)
  ([roadmap](./IMPLEMENTATION_ROADMAP.md); provisioning ruled Option C and
  D2-01…04 approved,
  [ADR-0006](./adr/0006-resident-provisioning-and-registry-decisions.md)).
  Recorded deferrals: notification delivery (Slice 8), evidence malware
  scanning (R-2-01), a shared-store rate limiter for hosted exposure (R-1-04),
  and the shell-chrome touch targets (R-2-05, US-UI-002).
- **Slices 3–9 and v1.5 — Sequenced.** Scope, dependencies, gates and effort
  per slice in the roadmap.

### Known conflicts between planning artefacts and implementation

Recorded here per the specification's honesty rule — identified, not silently
resolved:

1. ~~**README non-negotiables table vs implementation.**~~ **RESOLVED in Slice
   2G (2026-08-02).** The table had labelled the transactional outbox
   "(Slice 1)" though it was explicitly deferred, and cited a "`QueueShell`
   param split (Slice 1)" that never existed. Both rows now name what actually
   enforces them: the outbox arrived in Slice 2A with delivery still deferred
   to Slice 8, and URL hygiene is the no-parameter policy, e2e-asserted. The
   deferral table in the decision log records the outbox's arrival rather than
   still promising it.
2. **"Eight named operations" vs nine typed reasons.** Phase-document language
   says eight system operations; `SERVICE_ROLE_REASONS` has nine members
   because scheduled jobs carry their own reason. The architecture test pins
   the list; the prose undercounts.
3. **Slice-numbering contradictions across code comments** — staff queues
   "(Slice 2)" depend on documents "(Slice 3)"; case routes "(Slice 2)" depend
   on complaints "(Slice 6)". Fully documented in DEC-SCOPE-01.
4. **Slice 1 items referenced in code but neither delivered nor in the
   recorded deferral table:** the seven additional accent palettes with their
   contrast tests (US-UI-001, `globals.css`), Sentry wiring (US-OPS-003,
   `error.tsx`), and the real public portal (US-UI-006, `(public)/page.tsx`).
   These are **Future** and should be added to the deferral record when next
   touched.

## 19. Acceptance Criteria

**Standing criteria for every change** (all currently green at `9fbd783`):

- All four required CI checks pass; no force-pushes; no direct pushes to
  `main`; branch protection never bypassed.
- `pnpm verify` and `pnpm verify:full` green; migrations replay from empty;
  generated types drift-free; coverage ≥ 80% without narrowing the measured
  set; test counts never decrease without a recorded reason.
- Every new tenant-scoped table ships with composite-FK isolation, forced RLS,
  explicit policies and pgTAP coverage; every consequential mutation writes
  its audit entry in the same transaction; every new guard denial is audited.
- No secret-shaped value, `.env.local`, or personal data enters the
  repository; placeholder-marked values stay visibly marked.
- WCAG 2.2 AA for delivered UI: one h1, landmarks, labels, skip link first,
  visible focus, 44px touch targets, keyboard operability (e2e-asserted
  baseline).
- Documentation debt is part of the change: risk register, decision log,
  ADRs and this specification updated in the same PR.

**Slice-exit criteria** are recorded per slice in the decision log; a slice
whose scope is not written down cannot be accepted (DEC-SCOPE-01 is the
current example).

## 20. Future Work

Consolidated queue, deduplicated from §6, §17 and the registers — with owners:

| Item | Blocked on / trigger | Owner |
| --- | --- | --- |
| Begin Slice 2 implementation (all entry criteria met) | next feature branch | Implementer |
| Confirm role catalog names | DEC-ROLE-01 | Product owner + Captain |
| Hosted topology; production project & PITR; residency | DEC-ENV-01/-02/-03 | Product owner, Captain, DPO, legal |
| Enable MFA on the Supabase Owner account | outstanding operational action | Repository owner |
| App-level sign-in rate limiting | first hosted exposure (R-1-04) | Slice 2+ implementer |
| R-1-06 residual: re-measure after next Next.js upgrade; optimistic UI if persistent | next framework upgrade | Slice 2+ implementer |
| Last-admin lockout recovery via provisioning | platform slice (R-1-05) | Platform implementer |
| Transactional outbox + notification delivery | notification slice (EPIC-11/14) | — |
| PLT-08 readiness endpoint | platform slice | — |
| Shell chrome (US-UI-002), accent palettes + contrast tests (US-UI-001), public portal (US-UI-006), Sentry (US-OPS-003) | UI/ops slices | — |
| Audit retention & archival schedule | Slice 9 (B-21) | — |
| Legacy JWT key disablement; network CIDR restriction; email provider | before production designation (R-0B-04/-06/-08) | — |
| Feature-flagged modules: assistance, households, feedback, SMS, e-signature | flags default off; no in-repo plan | — |

---

*Cross-reference index:*
[implementation roadmap](./IMPLEMENTATION_ROADMAP.md) ·
[ADR-0001](./adr/0001-single-application-repository.md) ·
[ADR-0002](./adr/0002-supabase-environment-topology.md) ·
[ADR-0003](./adr/0003-strict-typescript-flags.md) ·
[ADR-0004](./adr/0004-application-directory-location.md) ·
[ADR-0005](./adr/0005-slice1-role-catalog-and-provisioning.md) ·
[identity-and-access](./architecture/identity-and-access.md) ·
[audit-logging](./architecture/audit-logging.md) ·
[decision log](./decisions/blockers.md) · [risk register](./risk-register.md) ·
[placeholder register](./placeholders.yaml) · [local setup](./local-setup.md) ·
[hosted assessment](./assessments/hosted-supabase-assessment.md) ·
[promotion runbook](./runbooks/repository-promotion.md) ·
[assessment runbook](./runbooks/supabase-project-assessment.md)
