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
    ok: (value) => Number(value) >= 27,
    detail: 'expected every Slice 0a–4A migration to be recorded',
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
  {
    name: 'catalog seed present',
    sql: 'select count(*) from public.document_types',
    ok: (value) => Number(value) >= 5,
    detail: 'expected the Slice 3A document-type fixtures',
  },
  {
    // A confirmed-looking fee in a local database is how a synthetic amount
    // starts being quoted as real. B-08 is open, so every seeded row must
    // still say so.
    name: 'catalog fees still marked placeholder',
    sql: 'select count(*) from public.document_types where not values_are_placeholder',
    ok: (value) => Number(value) === 0,
    detail: 'expected every seeded document type to keep values_are_placeholder = true (B-08)',
  },
  {
    // The 3B request gate is only meaningfully testable while a member who is
    // NOT verified exists. If this fixture goes missing the suite would still
    // pass, having quietly stopped exercising the rule.
    name: 'unverified-member persona present',
    sql: `select count(*) from public.memberships m
          join public.person_accounts pa on pa.user_id = m.user_id
           and pa.barangay_id = m.barangay_id
          where m.status = 'active'
            and not exists (
              select 1 from public.verification_applications va
              where va.person_id = pa.person_id and va.state = 'approved')`,
    ok: (value) => Number(value) >= 1,
    detail: 'expected the Slice 3B active-but-unverified member fixture',
  },
  {
    name: 'request-evidence bucket created by migration',
    sql: "select count(*) from storage.buckets where id = 'request-evidence' and not public",
    ok: (value) => Number(value) === 1,
    detail: 'expected the PRIVATE request-evidence bucket (Slice 3D)',
  },
  {
    // The public catalog is the one deliberate anon grant in this database.
    // If it ever widens beyond these two tables, this check says so.
    name: 'anon reads exactly the public catalog and nothing else',
    sql: `select coalesce(string_agg(table_name, ',' order by table_name), '')
          from information_schema.role_table_grants
          where grantee = 'anon' and table_schema = 'public'`,
    ok: (value) => value === 'document_type_requirements,document_types',
    detail: 'expected anon to hold SELECT on the two catalog tables ONLY (US-UI-006)',
  },
  {
    name: 'certificate seed present',
    sql: 'select count(*) from public.certificates',
    ok: (value) => Number(value) >= 3,
    detail: 'expected the Slice 4A certificate fixtures',
  },
  {
    // The serial book must agree with its own history. If a seed ever issues a
    // certificate without advancing the counter, the next allocation collides
    // with an existing row and issuance breaks for everyone in that barangay.
    name: 'serial counters agree with issued history',
    sql: `select count(*) from public.certificate_series s
          where s.next_sequence <= coalesce(
            (select max(c.serial_sequence) from public.certificates c
             where c.series_id = s.id), 0)`,
    ok: (value) => Number(value) === 0,
    detail: 'expected every series counter to sit above its highest issued serial',
  },
  {
    // B-05/-06/-07 and the serial format are all unconfirmed. A local database
    // claiming otherwise is how invented wording starts being quoted as real.
    name: 'certificate wording and serials still marked placeholder',
    sql: `select (select count(*) from public.certificate_templates where not content_is_placeholder)
               + (select count(*) from public.certificate_series where not format_is_placeholder)`,
    ok: (value) => Number(value) === 0,
    detail:
      'expected every seeded template and series to stay placeholder-flagged (B-05/-06/-07, serial format)',
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
