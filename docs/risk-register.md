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
| R-1-03 | No automated gate runs on push while `DEC-REPO-01` is open — Slice 1's security tests only run when invoked | ADR-0004; CI inert in `v2/` subdirectory | H | M | H | Process | Resolve `DEC-REPO-01` (promote v2 to its own repository) — ADR-0004 says this should not persist past Slice 1 | Repository owner | open |
| R-1-04 | Sign-in rate limiting relies on Supabase Auth defaults only | Auth config (Slice 0b); no app-level limiter | M | M | M | Auth | Uniform failure copy + failed attempts audited with email digest; app-level limiter when hosted exposure begins | Slice 2+ implementer | open |
| R-1-05 | The last barangay administrator can disable their own membership, locking the tenant's admin functions | RLS permits self-status change under `membership.manage` | L | M | L | Access | Recovery = platform tenant-provisioning operation (later slice); documented limitation | Platform slice implementer | accepted |
