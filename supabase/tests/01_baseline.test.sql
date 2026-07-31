-- ============================================================================
-- pgTAP baseline test — Slice 0a
--
-- Asserts that the database contains ONLY what a migration put there.
--
-- The failure mode this guards against is real and common: someone creates a
-- table in Supabase Studio, it works locally and in the hosted project, and it
-- is absent from the migrations — so CI, a teammate's machine, and every future
-- environment silently diverge. Catching it here makes migrations the only way
-- schema changes happen (Phase 6 §19.4).
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- Slice 0a applies extensions only. Slice 1 replaces this assertion with the
-- real expected table set.
select is(
  (
    select count(*)::int
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  ),
  0,
  'public schema contains no tables yet — Slice 0a is extensions only'
);

select has_schema('extensions', 'the extensions schema exists');
select has_schema('public', 'the public schema exists');

-- Application objects must never be created inside the extensions schema.
select is(
  (
    select count(*)::int
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'extensions'
      and c.relkind = 'r'
      and c.relname not like 'pg_%'
  ),
  0,
  'no application tables have leaked into the extensions schema'
);

-- pgcrypto backs audit payload hashing (Phase 4 DB-ADR-08), so a working
-- digest is a Slice 0a prerequisite, not a Slice 1 concern.
select is(
  encode(extensions.digest('barangay-hub', 'sha256'), 'hex'),
  encode(extensions.digest('barangay-hub', 'sha256'), 'hex'),
  'pgcrypto digest is callable and deterministic'
);

select * from finish();

rollback;
