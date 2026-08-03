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

The environment belongs to the web application, so both files live in
`apps/web/` (ADR-0007):

```bash
cp apps/web/.env.example apps/web/.env.local   # PowerShell: Copy-Item apps/web/.env.example apps/web/.env.local
```

Paste the values printed by `pnpm db:start` into `apps/web/.env.local`:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← the printed `anon key`
- `SUPABASE_SERVICE_ROLE_KEY` ← the printed `service_role key`

Leave `NEXT_PUBLIC_SUPABASE_URL` pointing at `http://127.0.0.1:54321`.

`.env.local` is gitignored. Never commit it, and never paste a hosted project's
keys into it without a specific reason.

## 4. Apply migrations and seeds

```bash
pnpm db:reset:verified
```

This drops the local database, replays every migration from empty, and runs the
seed files. It is safe to run as often as you like — that is the point of a local
stack.

`db:reset:verified` wraps the plain `pnpm db:reset`. The Supabase CLI restarts
its containers after seeding and waits for them to report healthy; on a loaded
machine the Storage container can miss that window, and the CLI exits non-zero
**after the database was already reset correctly**. An exit code that is wrong
half the time teaches you to ignore it — and then a genuine reset failure sends
the whole suite against a half-migrated database. That happened once during 2F
and cost a full verification cycle.

So the wrapper checks the resulting database rather than the exit status: every
migration recorded, both synthetic tenants present, the registry fixtures
present, and the private evidence bucket created. It prints which check failed
and exits non-zero if any does — it never converts a real failure into a pass.
Use plain `pnpm db:reset` in CI, where the stack is fresh and the exit code is
trustworthy.

## 5. Generate database types

```bash
pnpm types:gen
```

Writes `backend/supabase/generated/database.types.ts`. CI fails if the committed file drifts from
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
pnpm e2e:local    # the same suite, one worker per project — prefer this locally
pnpm db:test      # database (pgTAP) — requires Docker
pnpm verify:slice2  # the whole gate: verify:full + verified reset + pgTAP + types
```

**Run `pnpm db:test` on a freshly reset database, and before `pnpm e2e` — not
after.** Several pgTAP assertions check exact seeded counts ("all nine seeded
memberships were captured by the audit trigger"), which is the only way to
prove a trigger fired for *every* row rather than merely for some. The e2e
suites deliberately create residents and drive real approvals, so running them
first leaves 11 memberships where the seed had 9, and those assertions fail
with `have: 11 / want: 9`. That is the suite reporting a changed database
correctly, not a defect — reset and re-run. `pnpm verify:slice2` sequences this
for you.

Before the first `pnpm e2e`, install the browser once:

```bash
pnpm exec playwright install chromium
```

Playwright starts its own dev server on **port 3100** so it never collides with a
dev server you already have on 3000. Override with `PLAYWRIGHT_PORT`.

**Since Slice 1 the e2e suite signs in with seeded accounts**, so it needs
`pnpm db:start` (with seeds applied — a fresh start or `pnpm db:reset:verified`
both do) and a `.env.local` carrying the local stack keys.

### Running the e2e suite locally without fighting it

Four things learned the hard way in Slices 2C–2G. None is a workaround for a
product defect; each is a property of this environment.

1. **Use `pnpm e2e:local`, or pass `--workers=1` yourself.** On Windows,
   parallel Playwright workers intermittently die with `0xC0000142` and can take
   the shared dev server down with them. One worker per project is slower and
   honest; a crashed worker otherwise reads as a test failure.

2. **Never run `pnpm build` while the e2e suite is running.** Both write the
   same `.next` directory, and the resulting failures look like application
   bugs. Run the gates in sequence, which is what `verify:slice2` does.

3. **Reset the database before a full run, not between specs.** Several suites
   mint their own residents through sign-up; a stale database from a previous
   run is the usual cause of a first-run-only failure.

4. **Public sign-up is rate-limited, deliberately (R-1-04):** 10 per client per
   15 minutes and 3 per email digest per hour. A suite that signs up more often
   than that will see throttled attempts — which by design return the same
   uniform response as success but send **no** email, so the test hangs waiting
   on Mailpit. If you hit it, wait out the window rather than raising the limit:
   the limit is a security control, and the e2e suites are written to lean on
   seeded personas precisely to stay under it.

If the stack has been running for a long time, containers can degrade in ways a
reset alone will not clear. `pnpm db:stop && pnpm db:start` is the fix.

### Memory is the binding constraint, and it looks like test failures

The full suite needs roughly **2 GB of headroom** beyond the Supabase stack. On
an 8 GB machine running Docker, a full-suite dev server grows past 1.2 GB and
free memory falls under 10% — at which point Next cannot fork render workers
and the run fails in two distinctive ways. Both look like application bugs and
neither is one:

| Symptom | What it actually means |
| --- | --- |
| `Jest worker encountered N child process exceptions, exceeding retry limit`, repeating on one route | The dev server cannot spawn render workers. Measured in 2G at 8% free RAM. |
| A wall of `net::ERR_CONNECTION_REFUSED` starting abruptly mid-run | The dev server died. Playwright cannot tell a dead server from a broken page, so **one** failure is reported as dozens — in 2G, 67 tests passed, the 68th timed out, and the remaining 12 were all refused. Re-run in isolation, all 12 passed. |

**Check free memory before blaming a test.** If it is under ~15%, close the
other consumers or run the suite in chunks of two or three spec files, which
keeps each dev server short-lived:

```bash
pnpm e2e --project=chromium-mobile --workers=1 tests/e2e/smoke.spec.ts tests/e2e/verification.spec.ts
```

(The spec paths are relative to `apps/web` — Playwright runs there — but the
command works verbatim from the repository root, because the root `pnpm e2e`
delegates into the app package and forwards its arguments.)

Chunking is how the 2G mobile run was completed (19 + 32 + 28 = 79) after the
single-process run exhausted memory partway through. It is a workaround for the
machine, not for the suite: CI runs the whole thing in one go.

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
| `resident.sanisidro@barangay-hub.test` | Resident self-service — the one **verified** persona, so the only one that may file a document request (Slice 3B) |
| `unverified.sanisidro@barangay-hub.test` | ACTIVE member whose registration is still `submitted`: browses the catalog, and is refused a request (Slice 3B verification gate) |
| `platform.admin@barangay-hub.test` | Platform console WITHOUT tenant access |

**Walking the verification workflow (Slice 2D).** Sign in as
`staff.sanisidro@` and open **Verification** — `applicant.sanisidro@`'s
submitted application is waiting. Start the review, request more information,
then sign in as `applicant.sanisidro@` to see the note and resubmit. Come back
as `admin.sanisidro@` to re-open the review and approve or reject it; only the
administrator is offered those two.

**Requesting a document (Slice 3B).** Sign in as `resident.sanisidro@` and
open **Documents**. Every fee, processing time and validity period you see is
INVENTED for testing and marked "Not yet confirmed" (blocker B-08); *Business
Permit Endorsement* has no decided fee at all and says so rather than showing
₱0.00. Pick *Barangay Clearance*, request it, answer the two required
questions, and you land on the draft — nothing has reached the barangay yet.
Submit it there, and it moves to "Waiting for review".

Then sign in as `unverified.sanisidro@` and try the same thing: the catalog
still opens (browsing needs membership), but the request control is replaced
by an explanation and a link to their registration. The database refuses it
too — `create_own_request` raises `RESIDENT_NOT_VERIFIED` — so the screen is
explaining a rule rather than being the rule.

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

pgTAP files in `backend/supabase/tests/` each manage their own transaction and roll back,
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
| `port 54321 already in use` | Another Supabase stack is running. `pnpm db:stop`, or change the ports in `backend/supabase/config.toml`. |
| `supabase start` rejects a config key | The pinned CLI does not recognise it. The error names the key — remove that line from `backend/supabase/config.toml` and open an issue so the omission is deliberate. |
| `pnpm types:gen` says the stack is not running | Run `pnpm db:start` first. |
| `db:start` exits with `uv_spawn` / `EUNKNOWN` after "Seeding data…" | A crash in the npm CLI wrapper, not the stack — the containers usually came up anyway. Check `docker ps`; if `supabase_studio_*` or `supabase_pg_meta_*` show `Exited`, run `docker start supabase_pg_meta_barangay-hub supabase_studio_barangay-hub`. |
| Typecheck errors mentioning `exactOptionalPropertyTypes` | Prefer conditional spreads (`...(x === undefined ? {} : { x })`) over passing `undefined`. See ADR-0003 before relaxing the flag. |
| ESLint reports `boundaries/element-types` on new code | The import crosses an architectural boundary. Route it through the feature's `index.ts` barrel, or move the code. Do not disable the rule. |
