#!/usr/bin/env node
/**
 * Generates `src/types/database.types.ts` from the LOCAL Supabase stack.
 *
 * Written as a Node script rather than a shell redirect because PowerShell's `>`
 * operator writes UTF-16, which corrupts the generated file on Windows.
 *
 * Usage:
 *   node scripts/gen-types.mjs           regenerate and write
 *   node scripts/gen-types.mjs --check   fail if the committed file is stale (CI)
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const OUTPUT_PATH = resolve(process.cwd(), 'src/types/database.types.ts')
const CHECK_MODE = process.argv.includes('--check')

const HEADER = [
  '// GENERATED FILE — do not edit by hand.',
  '// Regenerate with: pnpm types:gen   (requires a running local stack: pnpm db:start)',
  '// Drift is checked in CI with: pnpm types:check',
  '',
  '',
].join('\n')

function run() {
  // Single command string: Node deprecates mixing `shell: true` with an args
  // array. The command is a fixed literal with no interpolation.
  const result = spawnSync('pnpm exec supabase gen types typescript --local', {
    encoding: 'utf8',
    shell: true,
    maxBuffer: 32 * 1024 * 1024,
  })

  if (result.error) {
    console.error('Failed to invoke the Supabase CLI:', result.error.message)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error('supabase gen types failed.')
    if (result.stderr) console.error(result.stderr.trim())
    console.error('\nIs the local stack running?  pnpm db:start')
    process.exit(1)
  }

  const body = result.stdout.replace(/\r\n/g, '\n').trimEnd()
  if (!body.includes('export type Database')) {
    console.error('Unexpected generator output: no `Database` type found. Refusing to write.')
    process.exit(1)
  }

  return `${HEADER}${body}\n`
}

const generated = run()

if (CHECK_MODE) {
  if (!existsSync(OUTPUT_PATH)) {
    console.error(`Missing ${OUTPUT_PATH}. Run: pnpm types:gen`)
    process.exit(1)
  }
  const committed = readFileSync(OUTPUT_PATH, 'utf8').replace(/\r\n/g, '\n')
  if (committed !== generated) {
    console.error('Database types are out of date with the migrations.')
    console.error('Run `pnpm types:gen` and commit the result.')
    process.exit(1)
  }
  console.log('Database types are up to date.')
  process.exit(0)
}

mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
writeFileSync(OUTPUT_PATH, generated, { encoding: 'utf8' })
console.log(`Wrote ${OUTPUT_PATH}`)
