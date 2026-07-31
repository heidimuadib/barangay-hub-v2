# Barangay Hub v2

Multi-tenant civic services platform for Philippine barangays.

**Current state: Phase 7, Slice 1 complete — identity, access control, RLS and
audit foundation.** Authentication, memberships, roles/permissions, forced RLS
and the append-only audit trail are live; business features (requests,
certificates, payments) are not. See `docs/local-setup.md` to get running and
`docs/architecture/identity-and-access.md` for the access model.

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
| Notification intent is enqueued in the domain transaction; delivery happens after commit | Transactional outbox (Slice 1) |
| Resident and walk-in transactions use the same domain service | Shared services (Slice 2+) |
| The service-role client is restricted to eight named operations | `eslint.config.mjs` allow-list |
| No secret carries the `NEXT_PUBLIC_` prefix | ESLint + `check:bundle-secrets` + runtime assertion |
| No personal value appears in a shareable URL | `QueueShell` param split (Slice 1) |
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
pnpm db:test          # pgTAP database tests
pnpm types:gen        # regenerate src/types/database.types.ts
pnpm dev              # run the app at http://localhost:3000

pnpm test             # unit + component tests (Vitest)
pnpm e2e              # end-to-end smoke suite (Playwright, port 3100)

pnpm verify           # typecheck · lint · format · env template · boundaries · tests
pnpm verify:full      # verify + build + client-bundle secret scan
```

`pnpm verify` needs no Docker — Slice 0a's static gates, unit tests and e2e suite
all run without the database. Only the `db:*` scripts and `types:gen` require it.

## Layout

```
src/app/          routing only — thin route shells
src/features/     all behaviour, one directory per module (Slice 1+)
src/components/   ui primitives · patterns · domain components · dialogs
src/lib/          framework and infrastructure adapters, no domain vocabulary
src/services/     cross-cutting infrastructure (audit, outbox, storage, pdf…)
src/utils/        pure functions only
supabase/         migrations · seeds · pgTAP tests · local config
docs/             ADRs · runbooks · guides · placeholder register
```

Import direction is `app → features → services → lib → utils`, enforced by
`eslint-plugin-boundaries`. Domain code must not import React.
