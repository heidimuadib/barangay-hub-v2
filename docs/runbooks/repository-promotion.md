# Runbook — repository promotion (DEC-REPO-01)

How the v2 application was promoted from a subdirectory of the legacy
repository into this standalone repository, and how to recover or repeat the
procedure. Executed 2026-07-31.

## Before / after

| | Before | After |
| --- | --- | --- |
| Location | `C:\barangayhub\v2` (nested in the legacy repo) | `C:\barangay-hub-v2` (own Git root) |
| History | 3 v2 commits inside the legacy history: `500ca57` (Slice 0a), `4a0e411` (Slice 0b), `52cd9c9` (Slice 1) | same 3 commits re-rooted: `6b80f00`, `6016f78`, `1412fc4` |
| Legacy repo | intact | **intact and unmodified** — including its uncommitted legacy changes |
| Husky hooks | inactive (skipped with a notice) | active (`core.hooksPath = .husky/_`) |
| CI workflow | inert (not at a repo root) | valid at root — activates on first push |
| Remote | legacy `barangayhub` remote only | none yet (deliberately) |

## Extraction method

`git filter-repo` was not installed; `git subtree split` is built into Git and
was used instead. **All history-touching commands ran in a TEMPORARY CLONE**,
never against the working legacy repository:

```bash
# 1. Temporary clone (disposable; the backup during the operation)
git clone --no-local C:\barangayhub <temp>/promotion-clone
cd <temp>/promotion-clone
git tag promotion-backup-52cd9c9          # marks the source HEAD

# 2. Extract the v2-rooted history
git subtree split --prefix=v2 -b v2-standalone

# 3. Materialise the standalone repository
git clone --no-local --branch v2-standalone --single-branch \
    <temp>/promotion-clone C:\barangay-hub-v2
cd C:\barangay-hub-v2
git branch -m v2-standalone main
git remote remove origin                  # no accidental push target

# 4. Local setup
pnpm install --frozen-lockfile            # activates Husky via `prepare`
cp .env.example .env.local                # then paste keys from `pnpm db:start`
```

Post-extraction, `.gitattributes` (`* text=auto eol=lf`) was added: a fresh
Windows checkout with `core.autocrlf=true` produced CRLF working files, which
fails `pnpm format:check` repo-wide. Pinning LF makes clones deterministic on
every platform and matches CI's Linux runners.

## Verification performed (all from the standalone root)

`pnpm install --frozen-lockfile` · `pnpm verify` · `pnpm verify:full`
(build + bundle secret scan) · `pnpm db:reset` (full replay) ·
`pnpm db:test` (104/104 pgTAP) · `pnpm types:check` · `pnpm e2e` (54/54) ·
workflow YAML parse · `git ls-files` audits: no legacy file, no `.env.local`,
no credential-shaped content tracked.

## Recovery

The promotion is non-destructive, so recovery is simply re-running it: the
legacy repository still contains the full v2 history under `v2/` up to
`52cd9c9`. Deleting `C:\barangay-hub-v2` and repeating the extraction steps
reproduces the standalone repository bit-for-bit (subtree split is
deterministic for a given source history). Work committed ONLY to the
standalone repository after promotion is not in the legacy repository — from
promotion day forward, the standalone repository is the single source of
truth for v2 and the legacy `v2/` directory is frozen history.

## Remote setup (pending — requires owner action)

1. Create an empty GitHub repository named **`barangay-hub-v2`** (no README,
   no license — the initial push supplies everything). Private until the
   owners decide otherwise.
2. `git remote add origin git@github.com:<owner>/barangay-hub-v2.git`
3. `git push -u origin main`
4. Confirm the `pull-request` workflow's first run passes, then close R-1-03.

Never point this repository at the legacy `barangayhub` remote.

## Branch protection recommendations (apply after first push)

- Protect `main`: require a pull request; require the `pull-request` workflow
  checks (`quality`, `database`, `end-to-end`, `secret-scan`) to pass;
  require branches to be up to date; no force pushes; no deletions.
- Keep "Require linear history" on if squash/rebase merging is adopted.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `husky: skipped — no .git directory` on install | You are not at the repository root, or `.git` is missing — clone properly rather than copying files. |
| `format:check` fails on every file after a fresh clone | The clone predates `.gitattributes` or overrode it. `git config core.autocrlf false && git rm -q --cached -r . && git checkout -- .` |
| `supabase status` fails parsing `.env.local` | The file has a UTF-8 BOM (PowerShell `Out-File`). Recreate it with an editor/tool that writes plain UTF-8. |
| CI does not trigger after push | Workflow file must be on the default branch at `.github/workflows/`; confirm the repository's default branch is `main`. |
