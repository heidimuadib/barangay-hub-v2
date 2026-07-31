# ADR-0004 — Application directory location

- **Status:** **Open** (`DEC-REPO-01`) — awaiting owner decision
- **Date:** Phase 7, Slice 0a
- **Decision owner:** Tech lead / repository owner

## Context

Phase 1 audited the legacy PHP application at the repository root and required it
to remain unmodified. Slice 0a therefore created the v2 application in a `v2/`
subdirectory of that repository. Nothing in the legacy tree was changed.

This was a working choice made to protect the audit subject, not a considered
decision — and it has real, measured consequences.

## Measured consequences

Both were observed during Slice 0a, not predicted:

1. **Git hooks do not install.** Husky requires the package directory to be the
   Git root. `pnpm install` invoked bare `husky` and failed on every install.
   Mitigated by `scripts/setup-husky.mjs`, which skips with an explanation
   instead of failing or being silenced with `|| true`. Pre-commit formatting,
   lint, commit-message and pre-push checks are therefore **not enforced
   locally** — only via `pnpm verify` and CI.

2. **CI does not run.** GitHub Actions reads `.github/workflows/` only at the
   repository root. `v2/.github/workflows/pr.yml` is inert where it currently
   sits. The same applies to `.github/dependabot.yml`.

Neither is worked around in a way that hides the problem, because both disappear
the moment the decision is made.

## Options

1. **Promote `v2/` to its own repository.** Both consequences resolve with no
   code change: the workflow, Dependabot config and Husky hooks activate exactly
   as written. The legacy application keeps its own repository and its audit
   history intact.
2. **Keep `v2/` as a subdirectory and adapt the tooling.** Move `.github/` to the
   repository root and add `defaults.run.working-directory: v2` to every job;
   accept that Husky hooks cannot install, or configure a custom hooks path at
   the outer root that delegates into `v2/`.
3. **Move v2 to the repository root and relocate the legacy application.**
   Rejected: it modifies the Phase 1 audit subject, which Phase 1 forbade.

## Recommendation

**Option 1.** The two systems have no shared code, no shared dependencies, no
shared release cadence and no shared history worth preserving jointly. Option 2
spends ongoing configuration complexity to preserve an arrangement whose only
rationale was protecting the audit — a constraint that no longer binds once v2 is
separate.

## Consequences of leaving it open

Slice 0a is fully verifiable regardless: every gate runs locally through
`pnpm verify` and `pnpm e2e`. The exposure is that **no automated gate runs on a
push** until this resolves, so a regression can only be caught by someone
remembering to run the checks. That should not persist past Slice 1.
