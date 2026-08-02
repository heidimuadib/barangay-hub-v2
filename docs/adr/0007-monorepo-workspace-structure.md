# ADR-0007 — pnpm workspace structure (supersedes ADR-0001)

- **Status:** Accepted
- **Date:** 2026-08-02 (between Slice 2 completion and Slice 3 start)
- **Decision owner:** Product owner (structure requested); tech lead (execution)
- **Supersedes:** [ADR-0001](./0001-single-application-repository.md)

## Context

ADR-0001 chose a single repository over a monorepo and named three migration
triggers. **None of them has fired** — there is still one deployable
application, no external consumer of the design system, and no four-engineer
team. This restructure is an owner decision taken ahead of the triggers, with
the stated goals of (a) a deployment-shaped layout before hosting decisions
land — frontend and backend deployable independently without moving files
again — and (b) a home for the Slice 8 outbox dispatcher that is not inside
the web application. Executing it between slices, on a tree with 968 green
tests, is the cheapest moment it will ever have.

## Decision

A pnpm workspace with the application, the backend, and shared configuration
as separate packages:

| Path | Package | Contents |
| --- | --- | --- |
| `apps/web` | `@barangay-hub/web` | The entire Next.js application: `src`, `tests` (unit + e2e), its configs (`next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.mjs`), its guard scripts, `.env.example` |
| `backend` | `@barangay-hub/supabase` | `supabase/` (config.toml, migrations, seeds, pgTAP tests, **generated types**) plus the db scripts (`db-reset-verified.mjs`, `gen-types.mjs`) |
| `packages/config` | `@barangay-hub/config` | `tsconfig.base.json` — the ADR-0003 strict flag set every package extends |
| `packages/shared` | `@barangay-hub/shared` | **Reserved and empty** — populated the day code has a second consumer (Slice 8 dispatcher). `packages/ui` was not created at all: no shared UI exists |

The root `package.json` keeps every pre-existing script name (`dev`, `verify`,
`db:reset`, `e2e:local`, …) and delegates via `pnpm --filter`, so documentation,
CI, and muscle memory survive the split unchanged.

### What deliberately did NOT change

- **The backend is still Supabase** — PostgreSQL, GoTrue, Storage, RLS. No
  Express, no NestJS, no separate API server, no microservices. The Next.js
  app keeps using Server Actions → services → repositories under RLS.
- **The import direction inside `apps/web`** is still enforced by
  `eslint-plugin-boundaries` + `verify-boundaries.mjs`. The workspace adds
  package seams around the app; it does not replace the lint guarantee inside
  it (ADR-0001's core argument stays honoured).
- **The service-role allow-list, the four CI job names** (required by the
  main-branch ruleset by exact string), the migration files, the seeds, and
  every test assertion. Test totals before and after: 231 unit / 358 pgTAP /
  79 Playwright per viewport project.
- **Database schema:** zero migrations added or modified.

### Generated database types

`database.types.ts` is a Supabase artifact, so it moved from
`src/types/` to `backend/supabase/generated/`, still committed and still
drift-checked in CI (`pnpm types:check`). The app consumes it as
`@barangay-hub/supabase/types` through a `tsconfig` path alias rather than a
workspace dependency: every one of the seven importers is `import type`, so
the specifier never reaches a bundler at runtime and a type-system-only
resolution is sufficient — and it keeps the backend package free of any
publish/exports machinery it does not need.

### Deployment shape

- **Frontend:** Vercel with *Root Directory* = `apps/web`. `next.config.ts`
  sets `outputFileTracingRoot` to the repository root so file tracing works
  from the workspace. No application code changes required to deploy.
- **Backend:** hosted Supabase, operated from `backend/` (`supabase link` /
  `db push` read `backend/supabase/config.toml`). Still blocked by
  DEC-ENV-01/-02/-03 — this ADR changes the layout, not the hosting rulings.

## Consequences

- `pnpm install` resolves a multi-importer lockfile; per-package
  `node_modules` replace the single root tree. Tooling that must run
  repo-wide (prettier, husky, lint-staged, commitlint, gitleaks) stays at the
  root; lint-staged uses per-package configs so staged files are linted by
  the package that owns them.
- The root ESLint config lints only root and backend scripts; the app's full
  config (typed rules, boundaries, allow-lists) lives in `apps/web` — nothing
  that was linted before stops being linted.
- `.gitleaks.toml` allow-list patterns cover both the old and new paths,
  because the scan runs over full history where files exist at both.
- History is preserved: the restructure is `git mv` (212 renames, zero
  rewrites); `git log --follow` works across the move.

## Revisit

When the Slice 8 dispatcher lands, its shared code moves into
`packages/shared` and the outbox delivery worker becomes the second `apps/*`
or a backend worker — whichever the Slice 8 design rules. If a design-system
consumer outside `apps/web` ever appears, `packages/ui` is created then, not
before.
