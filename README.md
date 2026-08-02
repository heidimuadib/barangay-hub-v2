# Barangay Hub v2

Multi-tenant civic services platform for Philippine barangays.

**Current state: Phase 7, Slice 2 complete; Slice 3 in progress (3A).**
Slice 2 delivered public sign-up with email confirmation, the person registry
and walk-in creation, the staff verification queue and its decision workflow,
duplicate supersede-and-link resolution, and private evidence Storage with
signed upload/read. **Slice 3A** adds the document catalog and request-intake
*domain* — schema, state machine, capabilities, RLS, audit and outbox — with
the resident and staff surfaces still to come in 3B/3C. Certificates and
payments are not built, and notification *delivery* is not — the outbox
enqueues intent only. See `docs/local-setup.md` to get running,
`docs/architecture/identity-and-access.md` for the access model,
`docs/architecture/resident-registry-and-verification.md` for the registry and
`docs/architecture/document-catalog-and-requests.md` for the catalog.

Fees, processing times and validity periods shown anywhere in this system are
**not confirmed** by any barangay (blocker B-08) and are carried as data that
says so — see `values_are_placeholder` in the catalog.

**Plan of record:** [docs/PROJECT_SPECIFICATION.md](./docs/PROJECT_SPECIFICATION.md)
(what the system is) and
[docs/IMPLEMENTATION_ROADMAP.md](./docs/IMPLEMENTATION_ROADMAP.md)
(the order it gets built — currently Slice 3, document requests; provisioning
ruled as Option C hybrid, [ADR-0006](./docs/adr/0006-resident-provisioning-and-registry-decisions.md)).

**This is the STANDALONE v2 repository** (DEC-REPO-01, resolved). It was
promoted out of the legacy `barangayhub` repository with v2 history preserved
via `git subtree split` — see `docs/runbooks/repository-promotion.md`. The
legacy PHP application stays in its original repository and is never modified
from here. Git hooks (Husky) and the GitHub Actions pipeline activate
automatically in this layout.

## Non-negotiables

These are enforced by tooling, not by convention. Read `docs/adr/` before changing any of them.

| Rule | Enforced by |
| --- | --- |
| The server is the sole mutation authority | Server Actions + action chain (Slice 1) |
| Every tenant-scoped table is isolated by composite FKs **and** forced RLS | Migrations + CI isolation suite (Slice 1) |
| Authorization resolves from live database state, never from JWT claims | `auth_has_permission()` (Slice 1) |
| Every consequential mutation writes its audit entry in the same transaction | `append_audit_entry()` (Slice 1) |
| Notification intent is enqueued in the domain transaction; delivery happens after commit | Transactional outbox (Slice 2; delivery is Slice 8) |
| Resident and walk-in transactions use the same domain service | Shared registry services (Slice 2) |
| The service-role client is restricted to eight named operations | `eslint.config.mjs` allow-list |
| No secret carries the `NEXT_PUBLIC_` prefix | ESLint + `check:bundle-secrets` + runtime assertion |
| No personal value appears in a shareable URL | No-parameter policy: opaque ids and state keys only, e2e-asserted (Slice 2) |
| Unconfirmed fees, SLAs, templates and legal text stay visibly marked as placeholders | `docs/placeholders.yaml` + `values_are_placeholder` |
| WCAG 2.2 AA is part of Definition of Done | Lint, axe, manual pass per slice |

## Environments

| Environment | Supabase | Data |
| --- | --- | --- |
| Local | Supabase CLI (Docker) — **primary development environment** | Synthetic |
| CI | Ephemeral CLI instance per job | Fixtures |
| Hosted integration | `weadxbwtupvjqaqploij` — **NON-PRODUCTION** | Synthetic only |
| Production | **Not yet designated** — open decision `DEC-ENV-01` | — |

**No real resident data and no government ID files may be placed in any hosted
environment** until `DEC-ENV-01` resolves and the designated production
environment passes its readiness checklist (`DEC-ENV-04`).

## Commands

```bash
pnpm install          # install dependencies
pnpm db:start         # start the local Supabase stack (requires Docker)
pnpm db:reset         # drop, re-apply all migrations, run seeds
pnpm db:reset:verified  # the same, but verifies the OUTCOME (see below)
pnpm db:test          # pgTAP database tests
pnpm types:gen        # regenerate backend/supabase/generated/database.types.ts
pnpm dev              # run the app at http://localhost:3000

pnpm test             # unit + component tests (Vitest)
pnpm e2e              # end-to-end suite (Playwright, port 3100) — needs Docker
pnpm e2e:local        # the same, one worker per project (see docs/local-setup.md)

pnpm verify           # typecheck · lint · format · env template · boundaries · tests
pnpm verify:full      # verify + build + client-bundle secret scan
pnpm verify:slice2    # verify:full + verified db reset + pgTAP + generated-types check
```

`pnpm verify` needs no Docker — the static gates and the unit/component tests
run without the database. The `db:*` scripts, `types:gen` and **`pnpm e2e`** do
require it: from Slice 2 the end-to-end suites drive real registry data,
Storage and confirmation email.

Prefer `db:reset:verified` locally. The Supabase CLI can exit non-zero after a
*successful* reset when a container misses its health-check window; the wrapper
checks the resulting database instead of the exit code, so a real failure still
fails and a spurious one no longer trains you to ignore it.

## Layout

pnpm workspace ([ADR-0007](./docs/adr/0007-monorepo-workspace-structure.md)):

```
apps/web/            the Next.js application (server actions · repositories · services)
  src/app/           routing only — thin route shells
  src/features/      all behaviour, one directory per module (Slice 1+)
  src/components/    ui primitives · patterns · domain components · dialogs
  src/lib/           framework and infrastructure adapters, no domain vocabulary
  src/services/      cross-cutting infrastructure (audit, outbox, storage, pdf…)
  src/utils/         pure functions only
  tests/             unit · component · Playwright e2e
backend/supabase/    migrations · seeds · pgTAP tests · generated types · local config
packages/config/     shared workspace configuration (strict tsconfig base)
packages/shared/     reserved for a second consumer (Slice 8 worker); empty by design
docs/                ADRs · runbooks · guides · placeholder register
```

Every command above runs from the repository root — the root `package.json`
delegates into the right workspace package, so `pnpm dev`, `pnpm db:reset`,
`pnpm e2e` and the rest behave exactly as they did before the workspace split.

Import direction inside the app is `app → features → services → lib → utils`,
enforced by `eslint-plugin-boundaries`. Domain code must not import React.
The backend is Supabase itself (PostgreSQL, Auth, Storage, RLS) — there is
deliberately **no separate API server**.
