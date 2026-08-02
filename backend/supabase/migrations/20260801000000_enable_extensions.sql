-- ============================================================================
-- Slice 0a · US-DB-001 · Enable required PostgreSQL extensions
--
-- Source: Phase 4 §19.1 (Search and Indexing Strategy).
--   pg_trgm    fuzzy resident-name matching (Phase 4 §19.2)
--   unaccent   diacritic folding for name normalisation
--   pgcrypto   hashing for audit payload hashes and opaque tokens
--   btree_gin  composite GIN indexes over (barangay_id, tsvector)
--
-- Extensions live in the `extensions` schema, which Supabase provides and adds
-- to `extra_search_path`. Functions used inside GENERATED columns in Slice 1
-- must be schema-qualified, because generated-column expressions do not honour
-- search_path.
-- ============================================================================

create schema if not exists extensions;

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gin with schema extensions;

comment on schema extensions is
  'Third-party extensions. Application objects live in public. See Phase 4 §19.1.';
