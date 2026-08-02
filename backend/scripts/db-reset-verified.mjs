#!/usr/bin/env node
/**
 * `db:reset` that reports the truth.
 *
 * WHY THIS EXISTS. `supabase db reset` applies every migration and seed, then
 * restarts the stack's containers and waits for them to report healthy. On a
 * loaded machine the Storage container can miss that window, and the CLI exits
 * non-zero *after the database was already reset correctly*. Observed
 * repeatedly during Slices 2E–2G:
 *
 *     ...Seeding data from supabase/seed/02_slice2_registry_fixtures.sql...
 *     supabase_storage_barangay-hub container is not ready: starting
 *     failed to bootstrap the local database: exit 1
 *
 * A non-zero exit that does not mean failure is worse than a failure: it
 * teaches everyone to ignore the exit code, and then a REAL reset failure runs
 * the whole suite against a half-migrated database. That happened once during
 * 2F and cost a full verification cycle.
 *
 * So this wrapper distinguishes the two cases by checking the OUTCOME rather
 * than trusting the exit status:
 *
 *   1. run `supabase db reset`, streaming its output;
 *   2. regardless of exit code, verify the database is actually usable —
 *      every migration recorded, the seed fixtures present, and the evidence
 *      bucket created by migration;
 *   3. exit 0 only if those hold; otherwise exit non-zero and say which check
 *      failed.
 *
 * It never suppresses a genuine failure, and it is deliberately not used in
 * CI, where the stack is fresh and `supabase db reset` is trustworthy.
 */
import { spawnSync } from 'node:child_process'

const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** Runs one SQL scalar through the stack's own psql container. */
function scalar(sql) {
  const result = spawnSync(
    'docker',
    ['exec', 'supabase_db_barangay-hub', 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', sql],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) return null
  return (result.stdout ?? '').trim()
}

// One command string rather than args + shell:true — the latter concatenates
// without escaping, which Node deprecates for good reason.
const reset = spawnSync('pnpm exec supabase db reset', { stdio: 'inherit', shell: true })

const checks = [
  {
    name: 'migrations recorded',
    sql: 'select count(*) from supabase_migrations.schema_migrations',
    ok: (value) => Number(value) >= 16,
    detail: 'expected every Slice 0a–2F migration to be recorded',
  },
  {
    name: 'seed fixtures present',
    sql: "select count(*) from public.barangays where code like 'test-%'",
    ok: (value) => Number(value) >= 2,
    detail: 'expected the two synthetic tenants from the Slice 1 seed',
  },
  {
    name: 'registry seed present',
    sql: 'select count(*) from public.persons',
    ok: (value) => Number(value) >= 8,
    detail: 'expected the Slice 2A person fixtures',
  },
  {
    name: 'evidence bucket created by migration',
    sql: "select count(*) from storage.buckets where id = 'verification-evidence' and not public",
    ok: (value) => Number(value) === 1,
    detail: 'expected the PRIVATE verification-evidence bucket',
  },
]

let failed = false
for (const check of checks) {
  const value = scalar(check.sql)
  if (value === null || !check.ok(value)) {
    console.error(`  ✗ ${check.name}: got ${value ?? 'no answer'} — ${check.detail}`)
    failed = true
  } else {
    console.log(`  ✓ ${check.name} (${value})`)
  }
}

if (failed) {
  console.error(
    '\ndb:reset did NOT leave a usable database. Do not run tests against it.\n' +
      'If the stack has been up a long time, `pnpm db:stop && pnpm db:start` first.',
  )
  process.exit(1)
}

if (reset.status !== 0) {
  console.log(
    '\nNote: the Supabase CLI exited ' +
      String(reset.status) +
      ', but the database verified clean above — this is the container ' +
      'health-check race described in scripts/db-reset-verified.mjs, not a reset failure.',
  )
}

console.log(`\nDatabase reset and verified (${DB}).`)
