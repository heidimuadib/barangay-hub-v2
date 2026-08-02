#!/usr/bin/env node
/**
 * Guards `.env.example`.
 *
 * Two failure modes this catches:
 *   1. A real credential pasted into the committed template.
 *   2. A secret-like variable given the NEXT_PUBLIC_ prefix, which would inline
 *      it into the browser bundle (Phase 6 §19.3).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ENV_EXAMPLE = resolve(process.cwd(), '.env.example')

const FORBIDDEN_PUBLIC_FRAGMENTS = [
  'SERVICE_ROLE',
  'SECRET',
  'PASSWORD',
  'PRIVATE',
  'CREDENTIAL',
  'ACCESS_TOKEN',
  'REFRESH_TOKEN',
]
const PUBLIC_EXEMPTIONS = new Set(['NEXT_PUBLIC_SUPABASE_ANON_KEY'])

/** Values that look like real credentials rather than placeholders. */
const REAL_VALUE_PATTERNS = [
  { pattern: /\beyJ[A-Za-z0-9_-]{10,}\./, label: 'JWT-shaped value' },
  { pattern: /\bsb[ps]_[A-Za-z0-9_-]{20,}/, label: 'Supabase key-shaped value' },
  { pattern: /\bre_[A-Za-z0-9]{20,}/, label: 'Resend key-shaped value' },
  { pattern: /-----BEGIN /, label: 'private key block' },
]

/** Variables that must always be present in the template. */
const REQUIRED_KEYS = [
  'APP_ENV',
  'NEXT_PUBLIC_APP_ENV',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_PROJECT_REF',
  'EMAIL_PROVIDER',
  'LOG_LEVEL',
]

if (!existsSync(ENV_EXAMPLE)) {
  console.error('.env.example is missing.')
  process.exit(1)
}

const lines = readFileSync(ENV_EXAMPLE, 'utf8').split(/\r?\n/)
const problems = []
const seenKeys = new Set()

lines.forEach((line, index) => {
  const lineNumber = index + 1
  const trimmed = line.trim()
  if (trimmed === '' || trimmed.startsWith('#')) return

  const separator = trimmed.indexOf('=')
  if (separator === -1) {
    problems.push(`line ${lineNumber}: not a KEY=VALUE assignment`)
    return
  }

  const key = trimmed.slice(0, separator).trim()
  const value = trimmed.slice(separator + 1).trim()
  seenKeys.add(key)

  if (key.startsWith('NEXT_PUBLIC_') && !PUBLIC_EXEMPTIONS.has(key)) {
    const upper = key.toUpperCase()
    const offending = FORBIDDEN_PUBLIC_FRAGMENTS.find((fragment) => upper.includes(fragment))
    if (offending) {
      problems.push(
        `line ${lineNumber}: ${key} uses the NEXT_PUBLIC_ prefix on a secret-like name (${offending}).`,
      )
    }
  }

  for (const { pattern, label } of REAL_VALUE_PATTERNS) {
    if (pattern.test(value)) {
      problems.push(
        `line ${lineNumber}: ${key} appears to contain a real credential (${label}). Use a placeholder.`,
      )
    }
  }
})

for (const key of REQUIRED_KEYS) {
  if (!seenKeys.has(key)) problems.push(`missing required key: ${key}`)
}

if (problems.length > 0) {
  console.error('.env.example failed validation:\n')
  for (const problem of problems) console.error(`  • ${problem}`)
  process.exit(1)
}

console.log(`.env.example is clean — ${seenKeys.size} variable(s) documented, no real values.`)
