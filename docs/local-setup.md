# Local setup

Target: a clean clone to a running application with a seeded local database in
under 15 minutes.

## Prerequisites

| Tool | Minimum | Check |
| --- | --- | --- |
| Node.js | 22.13+ (pnpm 11 requires it) | `node -v` |
| pnpm | 10 | `pnpm -v` |
| Docker Desktop | 24 | `docker info` — the **daemon must be running** |
| Git | 2.40 | `git --version` |

The Supabase CLI is a pinned devDependency. Do not install it globally — the
pinned version is what CI uses.

## 1. Install

```bash
git clone <your-fork-or-origin>/barangay-hub-v2.git
cd barangay-hub-v2
pnpm install
```

`pnpm install` also installs the Git hooks (Husky) automatically — this
repository is its own Git root since DEC-REPO-01 was resolved.

## 2. Start the local database

Docker Desktop must be running first.

```bash
pnpm db:start
```

The first run pulls several images and takes a few minutes. On success the CLI
prints the local API URL, the `anon key`, and the `service_role key`. These are
throwaway local values.

## 3. Configure the environment

```bash
cp .env.example .env.local      # PowerShell: Copy-Item .env.example .env.local
```

Paste the values printed by `pnpm db:start` into `.env.local`:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← the printed `anon key`
- `SUPABASE_SERVICE_ROLE_KEY` ← the printed `service_role key`

Leave `NEXT_PUBLIC_SUPABASE_URL` pointing at `http://127.0.0.1:54321`.

`.env.local` is gitignored. Never commit it, and never paste a hosted project's
keys into it without a specific reason.

## 4. Apply migrations and seeds

```bash
pnpm db:reset
```

This drops the local database, replays every migration from empty, and runs the
seed files. It is safe to run as often as you like — that is the point of a local
stack.

## 5. Generate database types

```bash
pnpm types:gen
```

Writes `src/types/database.types.ts`. CI fails if the committed file drifts from
the migrations, so regenerate and commit whenever you add a migration.

## 6. Run the checks and the app

```bash
pnpm verify
pnpm dev
```

`pnpm verify` runs typecheck, lint, formatting, the environment-template guard,
the architectural-boundary enforcement check and the unit tests. None of it needs
Docker, so it works before step 2 as well.

Email confirmation is **enabled locally** (ADR-0006 point 2), so a new sign-up
must open the link Mailpit captured before signing in — nothing leaves the
machine, and the e2e suite reads the link from Mailpit's API.

- App: <http://localhost:3000>
- Health: <http://localhost:3000/api/health>
- Supabase Studio: <http://127.0.0.1:54323>
- Mail catcher (Inbucket): <http://127.0.0.1:54324>

## Tests

```bash
pnpm test         # unit + component (Vitest + Testing Library)
pnpm e2e          # end-to-end (Playwright) — REQUIRES the local stack since Slice 1
pnpm db:test      # database (pgTAP) — requires Docker
```

Before the first `pnpm e2e`, install the browser once:

```bash
pnpm exec playwright install chromium
```

Playwright starts its own dev server on **port 3100** so it never collides with a
dev server you already have on 3000. Override with `PLAYWRIGHT_PORT`.

**Since Slice 1 the e2e suite signs in with seeded accounts**, so it needs
`pnpm db:start` (with seeds applied — a fresh start or `pnpm db:reset` both do)
and a `.env.local` carrying the local stack keys.

## Local test accounts (Slice 1 seeds)

Synthetic fixtures only. Password for every account: `password123-local`.
The full matrix, including the negative-case accounts, is documented in
`docs/architecture/identity-and-access.md`; the Slice 2 registry personas
(including the account-less walk-in, the duplicate pair and the cross-tenant
name twin) are in
`docs/architecture/resident-registry-and-verification.md`.

| Email | What it demonstrates |
| --- | --- |
| `admin.sanisidro@barangay-hub.test` | Barangay administrator — full member/role/audit admin, plus all Slice 2 registry capabilities |
| `applicant.sanisidro@barangay-hub.test` | Submitted verification application with evidence (Slice 2) |
| `inforeq.sanisidro@barangay-hub.test` | Application returned for more information (Slice 2) |
| `rejected.sanisidro@barangay-hub.test` | Rejected application — terminal state (Slice 2) |
| `staff.sanisidro@barangay-hub.test` | Staff: reads the roster and registry, starts reviews and requests information — but is refused approve/reject (Slice 2D capability split) |
| `resident.sanisidro@barangay-hub.test` | Resident self-service |
| `platform.admin@barangay-hub.test` | Platform console WITHOUT tenant access |

**Walking the verification workflow (Slice 2D).** Sign in as
`staff.sanisidro@` and open **Verification** — `applicant.sanisidro@`'s
submitted application is waiting. Start the review, request more information,
then sign in as `applicant.sanisidro@` to see the note and resubmit. Come back
as `admin.sanisidro@` to re-open the review and approve or reject it; only the
administrator is offered those two.

**Uploading evidence and submitting (Slice 2F).** Sign up a fresh account,
confirm it through Mailpit, onboard, then on **My registration** add one
identity document and one proof of residency. Any small JPEG, PNG, WebP or PDF
works — **use a synthetic file, never a real ID** (DEC-ENV-04). The picker
uploads straight into the private `verification-evidence` bucket through a
short-lived one-object ticket; the server then verifies the object exists
before the document counts. "Send for verification" only enables once both
categories show *added*. As a reviewer with
`verification.evidence.read` (`admin.sanisidro@`), the review detail lists
metadata and mints a signed URL only when you press **View** — nothing is
embedded or prefetched. The bucket is private: a signed URL expires in about a
minute, and there is no public URL form.

**Reviewing a duplicate pair (Slice 2E).** Open the registry as
`admin.sanisidro@` and search "maria santos" — the seeded pair (plain and
accented spellings, same birthdate) each show the side-by-side comparison on
their record pages, with a "Resolve as the same person…" control. Staff see
the same comparison without the control. Resolving is **permanent** (the
loser is frozen forever), so keep the seeded pair for demos and practice on a
fresh pair: create two walk-ins with the same name and birthdate, then
resolve those. `pnpm db:reset` restores everything.

Note that a decision is **terminal**, so the seeded applications are a
one-shot demo: `pnpm db:reset` restores them. Note also that a resident who
onboards from scratch lands in `draft` and cannot reach the queue through the
browser yet — evidence upload is subpart 2F (recorded as R-2-04 in the
[risk register](./risk-register.md)).

pgTAP files in `supabase/tests/` each manage their own transaction and roll back,
so database tests never leave state behind.

## Git hooks

Installed automatically by `pnpm install` (`prepare` → `scripts/setup-husky.mjs`;
active since the repository promotion, DEC-REPO-01). The split keeps everyday
commits fast — nothing on the commit path needs Docker:

| Hook | Runs |
| --- | --- |
| `pre-commit` | `lint-staged` — ESLint `--fix` + Prettier on staged files |
| `commit-msg` | `commitlint` — Conventional Commits (Phase 6 §18.1) |
| `pre-push` | `pnpm run typecheck` |

Full verification (database tests, e2e, build) runs via `pnpm verify` /
`pnpm verify:full` and in CI on every push and pull request.

## Resetting everything

```bash
pnpm db:stop
docker volume prune          # optional — removes local Supabase volumes
pnpm db:start && pnpm db:reset
```

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `failed to connect to docker daemon` | Docker Desktop is not running. Start it and retry. |
| `port 54321 already in use` | Another Supabase stack is running. `pnpm db:stop`, or change the ports in `supabase/config.toml`. |
| `supabase start` rejects a config key | The pinned CLI does not recognise it. The error names the key — remove that line from `supabase/config.toml` and open an issue so the omission is deliberate. |
| `pnpm types:gen` says the stack is not running | Run `pnpm db:start` first. |
| `db:start` exits with `uv_spawn` / `EUNKNOWN` after "Seeding data…" | A crash in the npm CLI wrapper, not the stack — the containers usually came up anyway. Check `docker ps`; if `supabase_studio_*` or `supabase_pg_meta_*` show `Exited`, run `docker start supabase_pg_meta_barangay-hub supabase_studio_barangay-hub`. |
| Typecheck errors mentioning `exactOptionalPropertyTypes` | Prefer conditional spreads (`...(x === undefined ? {} : { x })`) over passing `undefined`. See ADR-0003 before relaxing the flag. |
| ESLint reports `boundaries/element-types` on new code | The import crosses an architectural boundary. Route it through the feature's `index.ts` barrel, or move the code. Do not disable the rule. |
