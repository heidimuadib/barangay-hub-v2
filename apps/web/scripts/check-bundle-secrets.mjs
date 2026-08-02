#!/usr/bin/env node
/**
 * Scans the CLIENT bundle for secret material.
 *
 * Layer 2 of the three-layer control (Phase 6 §34.2):
 *   1. ESLint rejects `NEXT_PUBLIC_` names containing secret-like fragments.
 *   2. This scan inspects what actually shipped.
 *   3. `assertNoPublicSecrets` asserts at runtime.
 *
 * Only `.next/static` is scanned. `.next/server` legitimately contains server
 * code that references `process.env.SUPABASE_SERVICE_ROLE_KEY` by name, so
 * scanning it would produce false positives and train people to ignore this.
 *
 * Run after `pnpm build`.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const CLIENT_BUNDLE_DIR = resolve(process.cwd(), '.next/static')
const SCANNABLE = new Set(['.js', '.mjs', '.cjs', '.json', '.map', '.css', '.txt', '.html'])

/** Literal fragments that must never appear in a client bundle. */
const FORBIDDEN = [
  { pattern: /SUPABASE_SERVICE_ROLE_KEY/g, label: 'service-role key name' },
  { pattern: /SUPABASE_DB_PASSWORD/g, label: 'database password name' },
  { pattern: /RESEND_API_KEY/g, label: 'email provider key name' },
  { pattern: /CRON_SECRET/g, label: 'cron secret name' },
  { pattern: /"role"\s*:\s*"service_role"/g, label: 'decoded service-role JWT payload' },
  { pattern: /\bservice_role\b/g, label: 'service_role literal' },
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, label: 'private key block' },
]

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) yield* walk(full)
    else yield full
  }
}

if (!existsSync(CLIENT_BUNDLE_DIR)) {
  console.error(`No client bundle found at ${CLIENT_BUNDLE_DIR}. Run \`pnpm build\` first.`)
  process.exit(1)
}

const findings = []
let filesScanned = 0

for (const file of walk(CLIENT_BUNDLE_DIR)) {
  const ext = file.slice(file.lastIndexOf('.'))
  if (!SCANNABLE.has(ext)) continue

  filesScanned += 1
  const contents = readFileSync(file, 'utf8')

  for (const { pattern, label } of FORBIDDEN) {
    pattern.lastIndex = 0
    if (pattern.test(contents)) {
      findings.push({ file: file.replace(process.cwd(), '.'), label })
    }
  }
}

if (findings.length > 0) {
  console.error('SECRET MATERIAL DETECTED IN THE CLIENT BUNDLE\n')
  for (const finding of findings) {
    console.error(`  ${finding.label}\n    ${finding.file}`)
  }
  console.error(
    '\nA value referenced with the NEXT_PUBLIC_ prefix is inlined into the browser bundle.',
  )
  console.error('Remove the prefix and read the value only in server code.')
  process.exit(1)
}

console.log(`Client bundle clean — ${filesScanned} file(s) scanned, no secret material found.`)
