# Runbook — Hosted Supabase project assessment (Slice 0b)

**Project:** `weadxbwtupvjqaqploij`
**Classification:** Hosted Integration Environment — **non-production**
**Blocker:** `B-02′` (Integration level)
**Purpose:** produce the evidence base for `DEC-ENV-01`.

> **Every step is READ-ONLY. No schema is applied, no setting is changed, no data
> is written, and no key value is ever copied into this document or anywhere
> else.**

Duration: about 30 minutes.

## Checklist

| # | Check | Where | Record | Result (2026-07-31) |
| --- | --- | --- | --- | --- |
| 1 | Region | Project Settings → General | Region code | `ap-southeast-1` |
| 2 | Plan tier | Billing | Tier; PITR available? Backup retention? | Free; PITR off; no backups recorded |
| 3 | Database branching | Branches, or `supabase branches list` | Available / unavailable | Unavailable (free tier) |
| 4 | Postgres major version | Settings → Database | Version — **must match `supabase/config.toml`** | **17** (17.6.1.155) — config.toml reconciled 15→17 |
| 5 | Existing schema objects | read-only catalog queries (see procedure) | Empty / experimental objects present | Empty — zero user objects, no migration history |
| 6 | Auth configuration | Authentication → Providers, Emails, URL config | Email confirmation on/off; redirect URLs; SMTP set? MFA enabled? | Confirmation ON; site_url localhost, allow-list empty; no SMTP (2 emails/h); TOTP on |
| 7 | Storage buckets | Storage | Bucket names; which are public | None |
| 8 | Extensions | Database → Extensions | `pg_trgm`, `unaccent`, `pgcrypto`, `btree_gin` present or installable | `pgcrypto` installed; other three available on PG17 |
| 9 | API keys issued | Settings → API | **Existence only. Never copy a value.** | Legacy anon + service_role; new publishable + secret |
| 10 | Access membership | Organization → Members | Who has access, at what role | 1 Owner (named), **MFA disabled** |

## Findings

Completed 2026-07-31 — full report: `docs/assessments/hosted-supabase-assessment.md`;
machine-readable: `docs/assessments/hosted-supabase-inventory.json`;
drift: `docs/assessments/hosted-local-drift.md`; risks: `docs/risk-register.md`.

- Region: `ap-southeast-1` (Singapore) — immutable; `DEC-ENV-03` still open
- Plan tier / PITR: free / PITR unavailable — fails Option 1 criterion
- Branching: unavailable on free tier
- Postgres version vs `config.toml`: hosted 17 vs pinned 15 → **reconciled to 17**
- Existing objects: none — project created 2026-07-31, never migrated, 0 users, 0 buckets
- Auth configuration gaps: site_url/allow-list unset for hosted; no SMTP; Owner MFA off
- Storage state: empty
- Extensions: all four required are installed-or-installable
- Access list: single named Owner; MFA disabled (R-0B-03)

## Recommendation for `DEC-ENV-01`

Assessed against the five Option 1 conditions in `docs/adr/0002`:

- [ ] Region acceptable under `DEC-ENV-03` — undetermined (pending residency review)
- [ ] Plan supports PITR ≥ 7 days — **fails** (free tier)
- [x] Project empty of experimental objects, or a full reset is acceptable — passes
- [ ] A staging project can be provisioned in its place before M3 — n/a yet
- [ ] Access reducible to named, logged individuals — partial (MFA off)

**Recommended option:** _2_ (proposed — decision remains with the owners)
**Rationale:** free tier structurally fails the PITR criterion and access
hardening is incomplete; the project is ideal as staging/integration precisely
because it is empty and non-production. See the assessment report §10.

## Actions arising

- [x] Reconcile `db.major_version` in `supabase/config.toml` with check 4 (done 2026-07-31)
- [x] Record the outcome in `docs/decisions/blockers.md` (evidence + proposal recorded; owner decision pending)
- [ ] If Option 2 is recommended, open `DEC-ENV-02` for cost approval (opened in `docs/decisions/blockers.md`, awaiting DEC-ENV-01)

**Assessed by:** Claude Code session (owner-authorized via `supabase login`)  **Date:** 2026-07-31

---

## Reproducible headless procedure

The checklist above names dashboard pages, but the assessment can be run
entirely from a terminal. This is the procedure used on 2026-07-31.

### Prerequisites

- Repo installed (`pnpm install`); the pinned CLI is a devDependency.
- Owner-level Supabase account access.
- No Docker needed; nothing touches the local stack.

### Credential handling

1. Run `pnpm exec supabase login` **in a real terminal** (the flow needs a TTY; it opens a browser). The token lands in the OS credential store (Windows: Credential Manager, target `Supabase CLI:supabase`).
2. Never echo, export, paste, or commit the token. Scripts must read it in-process from the credential store and validate it matches `^sbp_[A-Za-z0-9_]+$` before use.
3. Cleanup: `pnpm exec supabase logout` removes the stored token when the assessment is done, or leave it if hosted work continues.

### Read-only commands

All Management API calls are **GET**, except `database/query`, which must be
sent **single read-only `SELECT`/`SHOW`/`WITH` statements only** and should be
wrapped in a guard that refuses everything else (fail closed):

| Check | Source |
| --- | --- |
| 1, 4, identity | `supabase projects list` (also shows version, region, status) |
| 2 | GET `/v1/organizations/{slug}` (`plan`), GET `/v1/projects/{ref}/database/backups` (`pitr_enabled`) |
| 3 | GET `/v1/projects/{ref}/branches` |
| 5 | `database/query` SELECTs over `pg_tables`, `pg_views`, `pg_matviews`, `pg_proc`, `pg_policies`, `information_schema.*`, `to_regclass('supabase_migrations.schema_migrations')` |
| 6 | GET `/v1/projects/{ref}/config/auth` — **redact on display** (below) |
| 7 | GET `/v1/projects/{ref}/storage/buckets` and/or `select count(*) from storage.buckets` |
| 8 | `select … from pg_extension` / `pg_available_extensions` |
| 9 | GET `/v1/projects/{ref}/api-keys?reveal=false` — record **name/type only** |
| 10 | GET `/v1/organizations/{slug}/members` |
| extras | GET `network-restrictions`, `custom-hostname`, `config/database/postgres`, `functions` |

### Redaction rules

- API-key values: never retrieved, never recorded — names/types only.
- Auth config: values of any field matching `secret|pass|key|token` are recorded as `[SET]`/`[empty]` only. Over-redaction is fine; under-redaction is not.
- Member emails: redact to first/last character (`b***t@…`) in anything committed.
- Row data: don't select from user tables at all unless a structural question requires it; then minimum columns, personal values redacted, justification recorded in the report.

### Expected outputs

- `docs/assessments/hosted-supabase-assessment.md` — narrative report
- `docs/assessments/hosted-supabase-inventory.json` — metadata-only inventory
- `docs/assessments/hosted-local-drift.md` — classified drift table
- `docs/risk-register.md` — new/updated risk rows
- `docs/decisions/blockers.md` — evidence recorded against open decisions
- This runbook's checklist/findings filled in

### Forbidden commands

Anything that writes to the hosted project, including but not limited to:
`supabase db push`, `supabase migration up|repair`, `supabase db reset --linked`,
`supabase functions deploy`, `supabase secrets set|unset`, `supabase config push`,
`supabase storage …` mutations, any non-SELECT SQL via `database/query`, any
Management API `POST`/`PATCH`/`PUT`/`DELETE` other than the guarded
`database/query`. `supabase link` is technically local-only but unnecessary for
assessment — avoid it so no tooling gains an ambient write path.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Cannot use automatic login flow inside non-TTY environments` | Run `supabase login` in a real terminal window, not an embedded shell. |
| `Access token not provided` | Login again; confirm the credential-store entry exists. |
| Management API 400 on `custom-hostname` | Means none is configured — record “none”. |
| `database/query` returns 5xx | Project may be paused; check `supabase projects list` status first. |
