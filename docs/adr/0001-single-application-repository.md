# ADR-0001 — Single application repository, not a monorepo

- **Status:** **Superseded by [ADR-0007](./0007-monorepo-workspace-structure.md)** (2026-08-02)
- **Date:** Phase 6 §15.1
- **Decision owner:** Tech lead

> **Supersession note (2026-08-02):** none of the migration triggers below
> fired; the move to a pnpm workspace was an owner decision taken between
> Slice 2 and Slice 3 — see ADR-0007 for what changed and, as importantly,
> what did not (the boundaries-lint guarantee this ADR established remains in
> force inside `apps/web`).

## Context

Phase 6 offered a monorepo (`apps/` + `packages/`) or a single Next.js
repository. The project has one deployable application, one primary developer,
and no external consumer of the design system.

## Decision

A **single repository** with path-aliased internal modules (`@/*` → `./src/*`)
and lint-enforced import direction.

## Rationale

- One deployable application; the four shells are route groups, not deployments.
- No second consumer of `packages/ui` — no mobile app, nothing published.
- Workspace orchestration adds install and build-graph resolution to every CI
  run for zero benefit at this size.
- Package boundaries are not the only way to enforce architecture.
  `eslint-plugin-boundaries` achieves the same guarantee against the same
  dependency graph.

## Consequences

- Architectural boundaries are enforced by lint rather than by package
  resolution. A disabled lint rule silently removes the guarantee, so
  `boundaries/element-types` may not be disabled without an ADR.
- `supabase/` sits at the repository root, as it would either way.

## Migration trigger

Move to a monorepo when **any one** of the following occurs:

1. A second deployable application is approved.
2. The design system acquires an external consumer.
3. The team reaches four permanent engineers with independent release cadences.

Until then the cost is real and the benefit is hypothetical.
