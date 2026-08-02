import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { SERVICE_ROLE_REASONS } from '@/lib/supabase/service-role'

/**
 * Architectural guard tests.
 *
 * The ESLint boundary rules are the primary enforcement, but a disabled rule or
 * an `eslint-disable` comment would remove them silently. These tests assert the
 * same invariants independently, so weakening the lint config alone cannot make
 * a violation pass CI (Phase 6 §16.4).
 */

const ROOT = resolve(__dirname, '../../..')
const SRC = join(ROOT, 'src')

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full))
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      found.push(full)
    }
  }
  return found
}

const ALL_SOURCE = sourceFiles(SRC)

function repoPath(file: string): string {
  return relative(ROOT, file).split(sep).join('/')
}

describe('service-role client', () => {
  it('declares exactly the eight named system operations plus scheduled jobs', () => {
    // Phase 4 §25.6. Growing this list is a deliberate architectural act that
    // requires an ADR — this test exists to make silent growth impossible.
    expect([...SERVICE_ROLE_REASONS]).toEqual([
      'audit-append',
      'outbox-dispatch',
      'generation-worker',
      'certificate-artifact-write',
      'scheduled-job',
      'public-certificate-verification',
      'public-request-tracking',
      'tenant-provisioning',
      'support-grant-establishment',
    ])
  })

  it('is imported ONLY by the allow-listed audit service (Slice 1)', () => {
    const importers = ALL_SOURCE.filter((file) => {
      if (repoPath(file) === 'src/lib/supabase/service-role.ts') return false
      return /from ['"]@\/lib\/supabase\/service-role['"]/.test(readFileSync(file, 'utf8'))
    }).map(repoPath)

    // Slice 1 adds exactly one legitimate importer: the 'audit-append'
    // operation for sessionless security events. Any addition to this list is
    // a deliberate architectural act requiring an ADR (Phase 4 §25.6).
    expect(importers.sort()).toEqual(['src/services/audit/security-events.ts'])
  })

  it('keeps the ESLint allow-list aligned with the documented modules', () => {
    const config = readFileSync(join(ROOT, 'eslint.config.mjs'), 'utf8')
    const block = /const SERVICE_ROLE_ALLOWLIST = \[([\s\S]*?)\]/.exec(config)

    expect(block).not.toBeNull()
    const entries = [...(block?.[1] ?? '').matchAll(/'([^']+)'/g)].flatMap((match) =>
      match[1] === undefined ? [] : [match[1]],
    )

    expect(entries).toContain('src/services/audit/**')
    expect(entries).toContain('src/services/outbox/**')
    expect(entries).toContain('src/app/api/cron/**')
    // Nothing under src/components or src/app outside the cron route may appear.
    for (const entry of entries) {
      expect(entry.startsWith('src/components')).toBe(false)
      if (entry.startsWith('src/app/')) expect(entry).toBe('src/app/api/cron/**')
    }
  })
})

describe('server/client separation', () => {
  it('marks every server-only module with the server-only import', () => {
    const mustBeServerOnly = [
      'src/lib/config/env.server.ts',
      'src/lib/supabase/server.ts',
      'src/lib/supabase/service-role.ts',
    ]

    for (const file of mustBeServerOnly) {
      const contents = readFileSync(join(ROOT, file), 'utf8')
      expect(contents, `${file} must import 'server-only'`).toMatch(/^import 'server-only'/m)
    }
  })

  it('never reads a server-only variable from a client component', () => {
    const clientComponents = ALL_SOURCE.filter((file) =>
      /^['"]use client['"]/m.test(readFileSync(file, 'utf8')),
    )

    for (const file of clientComponents) {
      const contents = readFileSync(file, 'utf8')
      expect(contents, `${repoPath(file)} must not import env.server`).not.toMatch(
        /@\/lib\/config\/env\.server/,
      )
      // process.env in a client component is inlined at build time; only
      // NEXT_PUBLIC_ names and NODE_ENV are legitimate there.
      for (const [, name] of contents.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
        expect(
          name === 'NODE_ENV' || name?.startsWith('NEXT_PUBLIC_'),
          `${repoPath(file)} reads process.env.${String(name)} in a client component`,
        ).toBe(true)
      }
    }
  })

  it('keeps the Edge middleware free of Node-only server configuration', () => {
    const middleware = readFileSync(join(ROOT, 'src/middleware.ts'), 'utf8')
    const supabaseMiddleware = readFileSync(join(ROOT, 'src/lib/supabase/middleware.ts'), 'utf8')

    expect(middleware).not.toMatch(/@\/lib\/config\/env\.server/)
    expect(supabaseMiddleware).not.toMatch(/@\/lib\/config\/env\.server/)
    expect(supabaseMiddleware).not.toMatch(/service-role/)
  })
})

describe('logging discipline', () => {
  it('routes all output through the logger', () => {
    const offenders = ALL_SOURCE.filter((file) => {
      const path = repoPath(file)
      // The logger writes to stdout by definition; error boundaries are client
      // components whose development-only console call is explicitly annotated.
      if (path === 'src/lib/logger/logger.ts') return false
      const contents = readFileSync(file, 'utf8')
      if (/eslint-disable(-next-line)? no-console/.test(contents)) return false
      return /\bconsole\.(log|info|warn|error|debug)\(/.test(contents)
    }).map(repoPath)

    expect(offenders).toEqual([])
  })
})

describe('secret hygiene', () => {
  it('contains no NEXT_PUBLIC_ reference to a secret-like name anywhere in src', () => {
    const forbidden =
      /NEXT_PUBLIC_[A-Z0-9_]*(SERVICE_ROLE|SECRET|PASSWORD|PRIVATE|CREDENTIAL|ACCESS_TOKEN|REFRESH_TOKEN)/

    const offenders = ALL_SOURCE.filter((file) => {
      const path = repoPath(file)
      // These two modules define the deny-list itself.
      if (path === 'src/lib/config/env.schema.ts') return false
      return forbidden.test(readFileSync(file, 'utf8'))
    }).map(repoPath)

    expect(offenders).toEqual([])
  })

  it('contains no committed credential-shaped literal in src', () => {
    const credentialShaped = [
      /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./,
      /\bsb[ps]_[A-Za-z0-9_-]{20,}/,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    ]

    const offenders = ALL_SOURCE.filter((file) => {
      const contents = readFileSync(file, 'utf8')
      return credentialShaped.some((pattern) => pattern.test(contents))
    }).map(repoPath)

    expect(offenders).toEqual([])
  })
})
