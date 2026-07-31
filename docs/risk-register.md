# Risk register

Live register for Barangay Hub v2. One row per risk; full narrative lives in
the linked source document. Severity = likelihood × impact (L/M/H).
Status: `open` · `mitigated` · `accepted` · `closed`.

Created during Slice 0b (2026-07-31) from the hosted assessment
(`docs/assessments/hosted-supabase-assessment.md`). Add new risks at the
bottom; never reuse an ID.

| ID | Risk | Evidence | Likelihood | Impact | Severity | Area | Mitigation | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-0B-01 | Postgres major mismatch (hosted 17 vs local 15) changes migration behaviour | Management API + `select version()` | — | — | High | Database | `config.toml` reconciled to 17; local stack rebuilt and re-verified in Slice 0b | — | closed |
| R-0B-02 | Free plan: no PITR, no recorded backups — data loss unrecoverable | `pitr_enabled=false`, empty backup list | M | H (if ever production) / L (as HIE) | H | Operations | Non-production designation stands (ADR-0002); paid plan + PITR ≥ 7 days required before any production role | Product owner (`DEC-ENV-01`/`-02`) | open |
| R-0B-03 | Sole Owner account has MFA disabled — single point of account takeover | Org members API: 1 Owner, `mfa_enabled=false` | M | H | H | Access | Enable MFA on the Supabase account; add a second named owner or break-glass procedure later | Repository owner | open |
| R-0B-04 | Database network open to `0.0.0.0/0` and `::/0` | Network-restrictions API | M | M (empty DB today) | M | Network | Acceptable for an empty HIE; restrict CIDRs before production designation or before real synthetic-data workloads | Product owner | accepted (HIE only) |
| R-0B-05 | Auth `site_url` is `http://localhost:3000` with an empty redirect allow-list | Auth config API | H (when hosted frontend appears) | M | M | Auth | Set site URL + allow-list as part of the first hosted-frontend deployment; blocked behind `DEC-ENV-01` | Slice 1+ implementer | open |
| R-0B-06 | Built-in email sender limited to 2 emails/hour — silently breaks auth flows | Auth config API (`rate_limit_email_sent=2`), no SMTP | H (when hosted email flows tested) | M | M | Email | Configure Resend (EPIC-11) with allow-list before exercising hosted email; console provider everywhere else | Slice 1+ implementer | open |
| R-0B-07 | Unrelated project (`medisync`) shares the organization and its free-tier quotas | Projects list API | L | L | L | Governance | Note only; consider a dedicated org if the project moves toward production | Product owner | accepted |
| R-0B-08 | Legacy JWT `anon`/`service_role` keys in circulation alongside new-style keys | API-keys API (existence only) | L | M | L | Secrets | Use `sb_publishable_`/`sb_secret_` keys in all new config; plan legacy-key disablement before production | Slice 1+ implementer | open |
| R-0B-09 | RA 10173 data-residency acceptability of `ap-southeast-1` unconfirmed for government-ID images | Region API; `DEC-ENV-03` open | M | H | H | Privacy | `DEC-ENV-04` prohibition (no real resident data / ID files hosted) stands until `DEC-ENV-03` resolves | Product owner + legal (`DEC-ENV-03`) | open |
| R-1-01 | Role catalog names are a proposed working set, not owner-confirmed | ADR-0005 (proposed); `DEC-ROLE-01` | M | L (renames are row updates; nothing branches on role keys) | L | Access | Owner review of ADR-0005 before pilot | Product owner + Captain | open |
| R-1-02 | Shared seeded password (`password123-local`) would be dangerous if Tier 3 seeds ever ran hosted | Seed file; local-setup docs | L | H | M | Access | Phase 6 §22.2 guard refuses seeds where any non-`test-` tenant exists; hosted project holds 0 users (Slice 0b verified) | Tech lead | mitigated |
| R-1-03 | No automated gate runs on push while the repository lacked an active CI remote | CI ACTIVE since 2026-07-31: `github.com/heidimuadib/barangay-hub-v2`, run 30632397681 on `035f6fe` — all four jobs green (quality, database, e2e, secret scan). Husky enforces local commit/push gates | — | — | — | Process | Branch protection per `docs/runbooks/repository-promotion.md` remains a recommended follow-up | Repository owner | closed |
| R-1-06 | Under a production server (`next start`), a committed membership mutation can leave the members table showing the previous value | **Measured 2026-08-01** (see the R-1-06 note below the table) | M | L (UI staleness only — the mutation and its audit entry are always correct) | L | UI | Partly fixed: `useRefreshOnSuccess` makes the client refetch explicit. Residual documented below; re-test after the next Next.js upgrade before attempting an optimistic-UI redesign | Slice 2+ implementer | mitigated (partially) |
| R-1-04 | Sign-in rate limiting relies on Supabase Auth defaults only | Auth config (Slice 0b); no app-level limiter | M | M | M | Auth | Uniform failure copy + failed attempts audited with email digest; app-level limiter when hosted exposure begins | Slice 2+ implementer | open |
| R-1-05 | The last barangay administrator can disable their own membership, locking the tenant's admin functions | RLS permits self-status change under `membership.manage` | L | M | L | Access | Recovery = platform tenant-provisioning operation (later slice); documented limitation | Platform slice implementer | accepted |

## R-1-06 — measurement record (2026-08-01)

Kept here rather than in the table because the investigation cost real time
twice, and the next person deserves the evidence rather than the conclusion.

**Reproduction.** Local Supabase + `pnpm build && next start`, database reset
to the pristine seed before every run, one Playwright worker:

| Build under test | Result |
| --- | --- |
| Before any fix | **0 / 5 passed.** Server log confirmed each mutation committed; the chip never updated. A hard reload always showed the new value, locating the fault in the client router rather than in the data or RLS. |
| Latency probe, before fix | flip after 573 ms once; **never within 30 s** in 2 of 3 runs. |
| After `useRefreshOnSuccess` (count-based, first attempt) | 2 / 5. Latency probe showed a deterministic pattern: 1st mutation ~600 ms, 2nd **never**. |
| After switching to identity-based detection | 1st mutation reliable; later ones still unreliable, **with or without a settling delay** — so it is not a timing race. |

**Two genuine defects were found and fixed**, both in application code:

1. No explicit client refetch. `revalidatePath()` invalidates server caches but
   its implicit client refresh did not arrive under a production build.
2. The first version of the hook counted currently-successful actions, so a
   second success on the *same* form left the count unchanged and never
   refetched. A unit test covering "same form twice" now exists — the original
   test suite only covered two *different* forms and missed it.

**One approach was tried and rejected:** gating the controls on the refetch via
`useTransition`, so a second mutation could not be issued mid-refetch. Its
pending flag did not clear within 10 s under `next start`, leaving the button
disabled and relabelled — a permanently stuck control is worse than a stale
value. Reverted deliberately.

**Residual.** Later mutations within one page session may still display a stale
value until the next navigation or reload. **No effect on correctness**: pgTAP
proves the mutation, the composite-FK isolation and the audit entry; the audit
log and a reload both show the truth. Dev and CI (which run the dev server) are
unaffected — the full e2e suite passes there.

**Recommended next step**, in order of cost: re-measure after the next Next.js
upgrade (several App Router revalidation fixes have shipped since 15.5); if it
persists, replace the refetch with optimistic local state seeded from the
action's return value, which removes the dependency on router refetch entirely.
