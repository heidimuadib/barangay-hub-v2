# Local setup

Target: a clean clone to a running application with a seeded local database in
under 15 minutes.

## Prerequisites

| Tool | Minimum | Check |
| --- | --- | --- |
| Node.js | 22.11 LTS | `node -v` |
| pnpm | 10 | `pnpm -v` |
| Docker Desktop | 24 | `docker info` — the **daemon must be running** |
| Git | 2.40 | `git --version` |

The Supabase CLI is a pinned devDependency. Do not install it globally — the
pinned version is what CI uses.

## 1. Install

```bash
cd v2
pnpm install
```

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
`docs/architecture/identity-and-access.md`.

| Email | What it demonstrates |
| --- | --- |
| `admin.sanisidro@barangay-hub.test` | Barangay administrator — full member/role/audit admin |
| `staff.sanisidro@barangay-hub.test` | Read-only staff |
| `resident.sanisidro@barangay-hub.test` | Resident self-service |
| `platform.admin@barangay-hub.test` | Platform console WITHOUT tenant access |

pgTAP files in `supabase/tests/` each manage their own transaction and roll back,
so database tests never leave state behind.

## Git hooks

Hooks live in `.husky/` but are **not installed** while the application is a
subdirectory of the legacy repository — Husky requires the package to sit at the
Git root (`DEC-REPO-01`). `pnpm install` prints a notice explaining this rather
than failing. Until it is resolved, run `pnpm verify` before committing; CI runs
the same gates.

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
