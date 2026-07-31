# Hosted ↔ local drift report — Slice 0b

Comparison of hosted project `weadxbwtupvjqaqploij` against the local
migrations, generated types, and Phase 1–6 intent, as of 2026-07-31.
Classification vocabulary: `expected` · `legacy` · `missing locally` ·
`missing remotely` · `potentially dangerous` · `unknown`.

## Summary

The hosted database has never had a migration applied and contains zero user
objects, so **there is no object-level drift and no legacy surface**. The only
material difference was the Postgres major version, which was reconciled
locally during this assessment.

## Differences

| # | Difference | Hosted | Local | Class | Severity | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Postgres major version | 17.6 | was pinned 15 in `config.toml` | **potentially dangerous** (migration behaviour differs across majors) | High → resolved | `config.toml` reconciled to `17` in this slice, local stack rebuilt and re-verified. No further action. |
| 2 | Migration history | `supabase_migrations.schema_migrations` absent | one migration applied | expected | None | Hosted has never been migrated — correct while ADR-0002 forbids changes. Resolves automatically when migrations are first applied post-Slice 1. |
| 3 | Extensions `pg_trgm`, `unaccent`, `btree_gin` | not installed (available: 1.6 / 1.1 / 1.3) | installed in `extensions` schema | missing remotely | Low | Installed by migration `20260801000000` whenever hosted migration is authorized. No pre-work needed. |
| 4 | Extension `pgcrypto` | installed 1.3 (platform default) | installed 1.3 via migration | expected | None | Migration uses `if not exists`; applies cleanly. |
| 5 | Platform-default extensions (`pg_stat_statements`, `supabase_vault`, `uuid-ossp`) | present | absent locally | expected | None | Hosted platform additions; not referenced by application code. |
| 6 | Auth: email confirmation | required | disabled (local convenience) | expected | None | Deliberate per Phase 6 §20.2; local `config.toml` documents it. |
| 7 | Auth: `site_url` / redirect list | `http://localhost:3000` / empty | same values, but local is correct for local | expected today, wrong for any hosted frontend | Medium (deferred) | Must change when a hosted frontend exists — tracked as R-0B-05. |
| 8 | RLS policies | none | none (no tables yet) | expected | None | Slice 1 defines the regime. |
| 9 | Storage buckets | none | none | expected | None | — |
| 10 | Edge Functions | none | none | expected | None | — |

No `legacy` and no `unknown` items exist. No hosted-only user objects exist.

## Generated-type implications

`src/types/database.types.ts` is generated from the **local** stack. Because
hosted `public` is empty and local `public` is empty, the types are compatible
with both. After the PG 15→17 reconciliation the local generator output was
re-verified unchanged (`pnpm types:check`).

## Migration-history drift

None possible: hosted has no history table. **Recommended future approach**
(recommendation only — not executed in this slice): when hosted integration is
first authorized, `supabase link` the repo, then apply the repo's migrations to
the clean database via the standard CLI flow. No baseline squash, no repair
commands, and no manual reconciliation are needed. If any object appears in
the hosted `public` schema before that point, re-run this assessment first.

## Policy drift

None: neither side has policies yet.
