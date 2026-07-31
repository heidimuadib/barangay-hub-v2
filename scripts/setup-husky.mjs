#!/usr/bin/env node
/**
 * Installs Git hooks, but only when this package directory is itself a Git
 * repository root.
 *
 * While DEC-REPO-01 is unresolved, the application lives in `v2/` inside the
 * legacy repository, whose `.git` sits one level up. Husky v9 refuses to install
 * from a subdirectory, so a bare `husky` in `prepare` fails every install.
 *
 * This script skips with an explanation rather than failing, and rather than
 * being silenced with `|| true` — a swallowed failure would hide the day the
 * hooks genuinely stop installing.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const gitDir = resolve(process.cwd(), '.git')

if (!existsSync(gitDir)) {
  console.log(
    [
      'husky: skipped — no .git directory in this package.',
      '',
      'The application is currently a subdirectory of the legacy repository, so',
      'commit hooks cannot be installed here (DEC-REPO-01). Formatting, linting,',
      'commit-message and pre-push checks still run in CI and via `pnpm verify`.',
      '',
      'This resolves itself once DEC-REPO-01 promotes this directory to its own',
      'repository — no code change is needed.',
    ].join('\n'),
  )
  process.exit(0)
}

const result = spawnSync('husky', [], { stdio: 'inherit', shell: true })
process.exit(result.status ?? 1)
