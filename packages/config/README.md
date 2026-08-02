# @barangay-hub/config

Shared workspace configuration.

- `tsconfig.base.json` — the strict TypeScript flag set ruled in ADR-0003,
  extended by `apps/web` and `packages/shared`. The flags live here so a new
  workspace package cannot quietly start life with a weaker compiler than the
  application.

Formatting (`.prettierrc.json`), commit conventions (`commitlint.config.mjs`)
and Git hooks (`.husky/`) are **repository-level** concerns and deliberately
stay at the root — they apply to files that belong to no package (docs,
workflows, root scripts).
