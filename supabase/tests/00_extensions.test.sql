-- ============================================================================
-- pgTAP smoke test — Slice 0a
-- Run with: pnpm db:test
--
-- pgTAP is created inside the test transaction and rolled back with it, so the
-- testing extension leaves no footprint in any migrated database.
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- Extensions required by Phase 4 §19.1
select has_extension('pg_trgm', 'pg_trgm is installed (fuzzy name search)');
select has_extension('unaccent', 'unaccent is installed (diacritic folding)');
select has_extension('pgcrypto', 'pgcrypto is installed (hashing, tokens)');
select has_extension('btree_gin', 'btree_gin is installed (composite GIN indexes)');

-- The extension functions must actually be callable through the search path.
select is(
  extensions.unaccent('Peña'),
  'Pena',
  'unaccent folds diacritics used in Filipino names'
);

select ok(
  extensions.similarity('dela cruz juan', 'juan dela cruz') > 0,
  'pg_trgm similarity is computable across reordered name tokens'
);

select * from finish();

rollback;
