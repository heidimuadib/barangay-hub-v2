# ADR-0004 — Application directory location

- **Status:** **Resolved** (`DEC-REPO-01`) — Option 1 executed, Phase 7 post-Slice-1
- **Date:** Phase 7, Slice 0a; resolved 2026-07-31
- **Decision owner:** Tech lead / repository owner

## Resolution (2026-07-31)

**Option 1 was executed.** The application was promoted to its own standalone
repository with v2 history preserved:

- Method: `git subtree split --prefix=v2` run in a TEMPORARY clone of the
  legacy repository — the legacy repository itself was never rewritten,
  reset, or modified.
- The three v2 commits (Slice 0a `500ca57`, Slice 0b `4a0e411`, Slice 1
  `52cd9c9`) map to the standalone commits `6b80f00`, `6016f78`, `1412fc4`
  with messages preserved and every path re-rooted (no `v2/` wrapper).
- Both measured consequences resolved exactly as predicted: Husky installs
  via the unchanged `prepare` script, and `.github/workflows/pr.yml` is now
  at a repository root where Actions reads it.
- Procedure and recovery: `docs/runbooks/repository-promotion.md`.

The legacy repository remains intact at its original location with the legacy
application and its own remote, unmodified.

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
