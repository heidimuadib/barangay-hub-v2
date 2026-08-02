#!/usr/bin/env node
/**
 * Proves that the architectural lint rules actually fire.
 *
 * A boundary configuration that reports nothing is indistinguishable from one
 * that is silently inert — a mistyped pattern, a wrong `mode`, or a plugin
 * upgrade can disable enforcement without producing a single error. Since
 * ADR-0001 accepts lint as the *only* mechanism holding the dependency
 * direction, that failure has to be detectable.
 *
 * This writes small violating fixtures into the real source tree (they must live
 * in the real folders, because the rules are path-based), lints them, asserts
 * the expected rule fired, and removes them again.
 *
 * Fixtures are always deleted, including on failure.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const CASES = [
  {
    name: 'utils may not import lib (dependency direction)',
    file: 'src/utils/__boundary_check.ts',
    source: [
      "import { logger } from '@/lib/logger'",
      'export const probe = () => logger.info("probe")',
      '',
    ].join('\n'),
    expect: ['boundaries/element-types'],
  },
  {
    name: 'components may not import the service-role client',
    file: 'src/components/__boundary_check.ts',
    source: [
      "import { createServiceRoleClient } from '@/lib/supabase/service-role'",
      "export const probe = () => createServiceRoleClient('audit-append')",
      '',
    ].join('\n'),
    expect: ['no-restricted-imports'],
  },
  {
    name: 'raw SQL is rejected outside repositories and scripts',
    file: 'src/lib/__boundary_check.ts',
    source: [
      'export const probe = (id: string) =>',
      '  `SELECT * FROM residents WHERE id = ${id}`',
      '',
    ].join('\n'),
    expect: ['no-restricted-syntax'],
  },
  {
    name: 'direct console output is rejected outside the logger',
    file: 'src/lib/__boundary_check_console.ts',
    source: ['export const probe = () => console.log("probe")', ''].join('\n'),
    expect: ['no-console'],
  },
  {
    name: 'an allow-listed module MAY import the service-role client',
    file: 'src/services/audit/__boundary_check.ts',
    source: [
      "import { createServiceRoleClient } from '@/lib/supabase/service-role'",
      "export const probe = () => createServiceRoleClient('audit-append')",
      '',
    ].join('\n'),
    expect: [],
  },
]

const root = process.cwd()
const written = []

function cleanup() {
  for (const file of written) {
    rmSync(resolve(root, file), { force: true })
  }
  // Only removes the directory when empty, so a real src/services/audit is safe.
  try {
    rmSync(resolve(root, 'src/services/audit'), { recursive: false })
  } catch {
    // Directory is absent or not empty — both are fine.
  }
}

let failures = 0

try {
  for (const testCase of CASES) {
    const absolute = resolve(root, testCase.file)
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, testCase.source, 'utf8')
    written.push(testCase.file)
  }

  // Single command string rather than an args array: Node deprecates mixing
  // `shell: true` with separate args because they are concatenated unescaped.
  // Every path here is a fixed literal defined above, none contain spaces.
  const result = spawnSync(`pnpm exec eslint --format json ${written.join(' ')}`, {
    encoding: 'utf8',
    shell: true,
    maxBuffer: 16 * 1024 * 1024,
  })

  const jsonStart = result.stdout.indexOf('[')
  if (jsonStart === -1) {
    console.error('ESLint produced no JSON report.')
    console.error(result.stdout || result.stderr)
    process.exit(1)
  }

  const report = JSON.parse(result.stdout.slice(jsonStart))

  for (const testCase of CASES) {
    const absolute = resolve(root, testCase.file)
    const entry = report.find((item) => resolve(item.filePath) === absolute)
    const rulesFired = new Set((entry?.messages ?? []).map((message) => message.ruleId))

    const missing = testCase.expect.filter((rule) => !rulesFired.has(rule))
    // For the positive case, the architectural rules specifically must stay quiet.
    const architectural = ['boundaries/element-types', 'no-restricted-imports', 'no-console']
    const unexpected =
      testCase.expect.length === 0 ? architectural.filter((rule) => rulesFired.has(rule)) : []

    if (missing.length === 0 && unexpected.length === 0) {
      console.log(`  ok    ${testCase.name}`)
      continue
    }

    failures += 1
    console.error(`  FAIL  ${testCase.name}`)
    if (missing.length > 0) {
      console.error(`        expected rule(s) did not fire: ${missing.join(', ')}`)
    }
    if (unexpected.length > 0) {
      console.error(`        rule(s) fired that should not: ${unexpected.join(', ')}`)
    }
    console.error(`        rules reported: ${[...rulesFired].join(', ') || '(none)'}`)
  }
} finally {
  cleanup()
}

if (failures > 0) {
  console.error(`\nArchitectural lint enforcement is not working (${failures} case(s) failed).`)
  process.exit(1)
}

console.log(`\nArchitectural lint enforcement verified — ${CASES.length} case(s).`)
