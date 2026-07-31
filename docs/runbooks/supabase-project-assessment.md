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

| # | Check | Where | Record | Result |
| --- | --- | --- | --- | --- |
| 1 | Region | Project Settings → General | Region code | |
| 2 | Plan tier | Billing | Tier; PITR available? Backup retention? | |
| 3 | Database branching | Branches, or `supabase branches list` | Available / unavailable | |
| 4 | Postgres major version | Settings → Database | Version — **must match `supabase/config.toml`** | |
| 5 | Existing schema objects | `supabase db dump --schema public --dry-run` (output stays local) | Empty / experimental objects present | |
| 6 | Auth configuration | Authentication → Providers, Emails, URL config | Email confirmation on/off; redirect URLs; SMTP set? MFA enabled? | |
| 7 | Storage buckets | Storage | Bucket names; which are public | |
| 8 | Extensions | Database → Extensions | `pg_trgm`, `unaccent`, `pgcrypto`, `btree_gin` present or installable | |
| 9 | API keys issued | Settings → API | **Existence only. Never copy a value.** | |
| 10 | Access membership | Organization → Members | Who has access, at what role | |

## Findings

_Complete after running the checklist._

- Region:
- Plan tier / PITR:
- Branching:
- Postgres version vs `config.toml`:
- Existing objects:
- Auth configuration gaps:
- Storage state:
- Extensions:
- Access list:

## Recommendation for `DEC-ENV-01`

Assess against the five Option 1 conditions in `docs/adr/0002`:

- [ ] Region acceptable under `DEC-ENV-03`
- [ ] Plan supports PITR ≥ 7 days
- [ ] Project empty of experimental objects, or a full reset is acceptable
- [ ] A staging project can be provisioned in its place before M3
- [ ] Access reducible to named, logged individuals

**Recommended option:** _1 / 2 / 3_
**Rationale:**

## Actions arising

- [ ] Reconcile `db.major_version` in `supabase/config.toml` with check 4
- [ ] Record the outcome in `docs/decisions/blockers.md`
- [ ] If Option 2 is recommended, open `DEC-ENV-02` for cost approval

**Assessed by:** ______________  **Date:** ______________
