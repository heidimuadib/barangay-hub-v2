# Hosted Supabase assessment — Slice 0b

- **Project:** `weadxbwtupvjqaqploij` ("Barangay Hub")
- **Classification:** Hosted Integration Environment (HIE) — **non-production** (ADR-0002, Option 3 in force)
- **Assessment date:** 2026-07-31 (Asia/Manila)
- **Assessed by:** Claude Code session, authorized via `supabase login` by the repository owner
- **Blocker addressed:** `B-02′` — evidence base for `DEC-ENV-01`

## Executive summary

The hosted project is **brand new** (created 2026-07-31T02:12Z), **empty of all
user objects**, and healthy. Nothing in it conflicts with the Phase 1–6
architecture, and no reconciliation or baseline migration is required: future
migrations can be applied to a clean database. The single blocking mismatch —
hosted PostgreSQL **17** vs the local stack's pinned **15** — was resolved
during this assessment by reconciling `supabase/config.toml` to `17` (an action
the runbook pre-authorizes).

The project is **READY WITH CONDITIONS** for its intended role as the
non-production integration environment. The conditions are operational, not
structural, and are listed at the end of this report. The **free plan tier**
(no PITR, minimal backup guarantees, 2 auth emails/hour) fails ADR-0002's
Option 1 production criteria, so the recommendation for `DEC-ENV-01` is
**Option 2**: keep this project as staging/integration and provision a separate
production project before pilot.

## Scope and methods

Read-only assessment per `docs/runbooks/supabase-project-assessment.md`.
No setting was changed, no schema applied, no data written, no key value
copied. Methods:

- Supabase CLI (pinned devDependency, v2.110.0) — `projects list`, authenticated via `supabase login` (token in the OS credential store; never in chat, files, or env vars).
- Supabase Management API — **GET endpoints only** (org, members, auth config, API-key existence with `reveal=false`, storage buckets, backups, branches, functions, network restrictions, postgres config).
- Management API `database/query` endpoint — **single-statement `SELECT` catalog queries only**, guarded by a fail-closed wrapper that refuses anything not clearly read-only (see the runbook's headless procedure).
- One unauthenticated reachability probe (HTTP 401 confirmed the gateway is up and enforcing keys).

**Limitations:** dashboard-only surfaces (billing UI details, exact backup
retention wording for the free tier) were not inspected; the Management API
response is authoritative for everything reported here. Edge Function secrets
were not enumerated (no functions exist).

## 1 · Project identity and environment classification

| Item | Value |
| --- | --- |
| Ref | `weadxbwtupvjqaqploij` (already public throughout this repo) |
| Name | Barangay Hub |
| Organization | `kfukvsffkqmdlamxesei` ("heidimuadib's Org"), **free plan** |
| Region | `ap-southeast-1` (Singapore) — immutable |
| Status | `ACTIVE_HEALTHY` |
| Created | 2026-07-31T02:12:33Z — the day of this assessment |
| Postgres | 17.6 (`17.6.1.155`, engine 17, GA release channel) |
| Classification | HIE, non-production — consistent with ADR-0002 and this repo's docs; no conflicting designation found |
| CLI link state | **Not linked** (`supabase/.temp` contains local start-secrets only) |
| Other usage | None observed — no users, no data, no functions |

The same organization contains one unrelated, `INACTIVE` project
(`medisync`, `ap-northeast-1`). It does not affect this project but is an
organization-hygiene observation (shared quota/billing surface).

## 2 · Database schema inventory

Schemas present: `auth`, `extensions`, `graphql`, `graphql_public`,
`pgbouncer`, `public`, `realtime`, `storage`, `vault` — **platform schemas
only**.

In `public`: **zero** tables, views, materialized views, functions, enums,
sequences, and triggers. No grants to `anon`/`authenticated` on any object
(there are no objects). `auth.users` count: **0**. `storage.buckets` count: **0**.

Installed extensions (all platform defaults): `pg_stat_statements` 1.11,
`pgcrypto` 1.3, `plpgsql` 1.0, `supabase_vault` 0.3.1, `uuid-ossp` 1.1.

Of the four extensions required by migration `20260801000000_enable_extensions.sql`:

| Extension | Hosted state | Available on PG17 |
| --- | --- | --- |
| `pgcrypto` | installed (platform default) | 1.3 |
| `pg_trgm` | not installed | yes, 1.6 |
| `unaccent` | not installed | yes, 1.1 |
| `btree_gin` | not installed | yes, 1.3 |

All four are installable, so the repo's migrations will apply cleanly when
hosted integration begins. See `hosted-local-drift.md` for the classified
comparison.

## 3 · Migration state

- `supabase_migrations.schema_migrations` does **not exist** — no migration has ever been applied.
- No manually created objects exist.
- **No baseline migration is required.** When hosted integration is authorized (post-Slice 1), linking and applying the repo's migrations to the clean database is sufficient. Future reconciliation can be automated safely because there is nothing to reconcile.

## 4 · Row-Level Security

No user tables exist, therefore no RLS policies exist and none are missing.
`pg_policies` is empty. There is no anon/authenticated exposure of any kind.
The RLS regime for tenant tables is defined by Slice 1 migrations and its CI
isolation suite; nothing hosted conflicts with it.

## 5 · Authentication

Factory-default GoTrue configuration, untouched:

- Email/password enabled; **email confirmation required** (`mailer_autoconfirm = false`) — matches the Phase 6 §20.2 requirement for hosted environments (local deliberately disables it).
- Signups open (`disable_signup = false`); anonymous sign-ins disabled; no external OAuth/SAML/phone providers configured (all provider secrets empty).
- `site_url = http://localhost:3000`; redirect allow-list **empty** — must be set when any hosted frontend exists.
- No custom SMTP — the built-in sender is rate-limited to **2 emails/hour**, unusable for any real flow.
- JWT expiry 3600s, refresh-token rotation on, reuse interval 10s — matches local `config.toml`.
- MFA: TOTP enroll/verify enabled (default); no auth hooks; captcha disabled.
- Users: **0** — no legacy or test users.
- No role/custom-claim conventions exist hosted; authorization-from-database (`auth_has_permission()`, Slice 1) is unconstrained by hosted state.

## 6 · Storage

Zero buckets, zero objects, no storage policies. No sensitive-document risk
exists today. The Slice 1+ document-management design starts from a blank
slate.

## 7 · Edge Functions and integrations

None. No functions deployed, no webhooks, no scheduled jobs, no external
integrations, no function secrets to enumerate.

## 8 · Security and privacy

- **API keys:** legacy JWT `anon` + `service_role` keys exist alongside new-style `publishable` + `secret` keys (existence verified; values never retrieved). Prefer the new-style keys for Slice 1+ hosted use; plan eventual legacy-key disablement.
- **Access:** exactly one organization member (Owner, GitHub-linked account, email redacted: `b***t@gmail.com`). **MFA is disabled** on this account — the single highest-value hardening action available.
- **Network:** database accepts connections from `0.0.0.0/0` and `::/0` (platform default). Acceptable for an empty HIE; restrict before any production designation.
- **No resident personal data** exists hosted (0 users, 0 rows, 0 objects), so no RA 10173 exposure exists today. `DEC-ENV-04` (no real resident data / government ID files in any hosted environment) remains in force.
- Repository secret scanning (gitleaks config, bundle-secret check) already guards the codebase; no hosted secrets were found in the repo.

## 9 · Operational

- **Plan:** free tier. `pitr_enabled = false`; WAL-G enabled; **no backups recorded**. PITR ≥ 7 days (ADR-0002 Option 1 criterion) requires a paid plan.
- **Branching:** none (not available on free tier).
- **Custom domain:** none configured.
- **Observability:** platform defaults only (`pg_stat_statements` present). No log drains.
- **Email delivery:** built-in, 2/hour — see Auth findings.
- **Environment separation:** local (CLI) and CI (ephemeral) are fully independent of this project; Slice 0a/1 have no hosted dependency (ADR-0002). Production does not exist yet.

## 10 · Compatibility and readiness

**Rating: READY WITH CONDITIONS** — for its designated role as the
non-production Hosted Integration Environment supporting post-Slice-1
integration and the preview-deployment exit criterion.

Conditions (none block local/CI Slice 1 work):

1. **Enable MFA on the Owner account** before any hosted integration work begins. (R-0B-03)
2. Keep **synthetic data only**; `DEC-ENV-04` prohibition stands. (standing)
3. Set `site_url` and the redirect allow-list when the first hosted frontend appears. (R-0B-05)
4. Configure a real email provider (Resend per EPIC-11) before exercising any hosted email flow. (R-0B-06)
5. Use new-style publishable/secret keys, not legacy JWT keys, in all new configuration. (R-0B-08)
6. The free plan is acceptable **only** while the project is non-production; any production designation requires a paid plan with PITR (`DEC-ENV-01`/`DEC-ENV-02`). (R-0B-02)

### Recommendation for `DEC-ENV-01` (proposed, not decided)

**Option 2** — retain this project as staging/integration; provision a separate
production project (paid plan, PITR ≥ 7 days, restricted network, hardened
access) before pilot deployment. Rationale: the free tier structurally fails
two of the five Option 1 criteria (PITR; access controls partially — MFA off),
while the region (`ap-southeast-1`) is the closest available to the
Philippines and is likely acceptable pending `DEC-ENV-03`. Option 1 would
become viable only after a plan upgrade plus access hardening; Option 3 (status
quo) remains the fallback until the owners decide.

Decision owner: Product owner + Barangay Captain. Recorded in
`docs/decisions/blockers.md`.

## Required decisions before Slice 1 closes

| ID | Decision | Owner | Urgency |
| --- | --- | --- | --- |
| `DEC-ENV-01` | Final role of the hosted project (proposal: Option 2) | Product owner + Barangay Captain | Before M6 / pilot planning |
| `DEC-ENV-02` | Cost approval for a second (production) project — required if Option 2 is accepted | Product owner | With DEC-ENV-01 |
| `DEC-ENV-03` | RA 10173 data-residency acceptability of `ap-southeast-1` for government-ID images | Product owner + legal reviewer | Before any ID-file storage anywhere hosted |
| — | Enable MFA for the Owner account (operational, no ADR needed) | Repository owner | Immediately |

## Proposed next actions

1. Commit this assessment (done in the Slice 0b commit).
2. Owner enables MFA on the Supabase account.
3. Owners review `docs/decisions/blockers.md` and rule on `DEC-ENV-01`/`-02`/`-03`.
4. Proceed to Slice 1 — entirely local/CI; no hosted dependency.
