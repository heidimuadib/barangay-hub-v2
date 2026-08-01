# Barangay Hub v2 — Implementation Roadmap

**The authoritative execution order for the remaining Phase 7 work.** This
document resolves [DEC-SCOPE-01](./decisions/blockers.md): the Phase 6
vertical-slice sequence below was supplied by the product owner and is now the
in-repository plan of record. Where a stale code comment or README slice
attribution disagrees with this document, this document wins (the known
instances are catalogued in the
[specification, §18](./PROJECT_SPECIFICATION.md)).

| | |
| --- | --- |
| Roadmap version | 1.0 |
| Plan of record since | 2026-08-01 |
| Companion document | [PROJECT_SPECIFICATION.md](./PROJECT_SPECIFICATION.md) — *what the system is*; this file — *the order it gets built* |
| Maintenance rule | A slice's section is updated in the PR that completes it; no later slice begins before the previous slice's exit gates pass |

**Status vocabulary:** `COMPLETE` · `DEFINED — BLOCKED (decision)` ·
`SEQUENCED` (ordered, high-level scope fixed, detail written when its turn
comes) · `v1.5` (feature-flagged, post-MVP).

---

## Consolidated slice table

| Slice | Title | Status | Primary outcome | Dependencies | Blockers | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| 0a | Engineering skeleton | **COMPLETE** | Verifiable foundation: tooling, gates, shells, local stack | — | — | L |
| 0b | Hosted integration assessment | **COMPLETE** | Evidence base for DEC-ENV-01; PG 17 reconciliation | 0a | — | S |
| 1 | Identity, tenant, RBAC, RLS, audit foundation | **COMPLETE** | Secure multi-tenant identity with forced RLS and append-only audit | 0a | — | XL |
| 2 | Resident registration, registry, verification | **IN PROGRESS — 2A complete** | Verified resident profiles; staff verification workflow; registry with duplicate handling | 1 | — (DEC-AUTH-01 resolved: Option C, [ADR-0006](./adr/0006-resident-provisioning-and-registry-decisions.md)) | XL |
| 3 | Document catalog and request intake | SEQUENCED | Residents and walk-ins submit document requests through one domain service | 2 | Fee/SLA confirmation (B-08) before pilot, not before build | L |
| 4 | Certificate generation, serials, QR, public verification | SEQUENCED | Accountable certificate issuance with public verifiability | 3 | Template/signatory confirmation (B-05–B-07) before pilot | L |
| 5 | Payments, exemptions, ORs, release, day closure, call list | SEQUENCED | Cash-accountable release workflow | 4 | OR series policy (B-11) before pilot | XL |
| 6 | Complaint intake, category gate, triage, docketing, evidence, timeline | SEQUENCED | Katarungang Pambarangay case intake with jurisdiction gate | 2 | Non-mediable categories (B-09) before pilot | L |
| 7 | Hearings, summons, service events, outcomes, settlement, CFA, closure | SEQUENCED | Full KP hearing lifecycle to certificate-to-file-action | 6, 4 (summons docs) | — | XL |
| 8 | Announcements, notification feed, email dispatch, digest, call-list fallback | SEQUENCED | Outbox delivery becomes real; residents reachable | 2 (outbox intents exist), 5 (call list) | Hosted email provider before any hosted send (R-0B-06) | M |
| 9 | Reports, exports, settings, staff admin, audit ops, platform admin, health, migration, pilot & release readiness | SEQUENCED | Operable, administrable, pilot-ready system | all prior | DEC-ENV-01/-02/-03; B-13–B-15, B-21; R-0B-02/-03/-04 | XL |
| v1.5 | Households · Assistance · Feedback · SMS channel · E-signature · scheduled reports · advanced dashboards · permission overrides · audit anomaly flags | v1.5 | Post-MVP expansions behind existing flags | 9 | Owner prioritisation | — |

---

## Cross-cutting rules (apply to every slice; never re-decided per slice)

These restate the standing non-negotiables so no slice section needs to:

1. **Local-first.** All development and CI against the local/ephemeral stack;
   the hosted project stays non-production until DEC-ENV-01 resolves.
2. **Synthetic data only; no real government-ID files anywhere hosted**
   (DEC-ENV-04). Seed guard refuses non-`test-` tenants.
3. **Deny by default** — grants, policies and function-execute alike.
4. **Authorization from live database state** (`auth_has_permission()`), never
   JWT claims.
5. **Forced RLS + composite tenant FKs** on every tenant-scoped table; owner
   paths are explicit policies.
6. **The server is the sole mutation authority**; Server Action chain with
   zod → audited guard → service → repository.
7. **One domain service for resident and walk-in paths** — never two code
   paths for the same transaction.
8. **Consequential mutation + audit entry in one transaction**; notification
   intent enqueued in that same transaction once the outbox exists (Slice 2);
   delivery after commit (Slice 8).
9. **No PII in URLs** or analytics; no personal value a resident could paste
   into a chat message.
10. **Private Storage only, brokered signed URLs**; no public buckets for
    resident material; no service-role key in browser code (nine typed
    reasons, allow-listed imports, ADR required to grow).
11. **Accessibility is Definition of Done** — WCAG 2.2 AA per slice.
12. **Process:** feature branches → protected PRs → all four required CI jobs
    green → merge; no direct pushes to `main`; no force-push; **no later slice
    begins before its predecessor's exit gates pass**.

---

## Slice 0a — Engineering skeleton

1. **Slice/title:** 0a — Engineering skeleton
2. **Status:** COMPLETE (history: `6b80f00`; promoted per the
   [promotion runbook](./runbooks/repository-promotion.md))
3. **User-visible outcome:** none by design — a clean clone reaches a running,
   fully gated application in under 15 minutes.
4. **Included:** Next.js/TypeScript scaffold; four shell route groups; design
   tokens; strict tsconfig; boundaries lint + meta-verifier; logger with
   redaction; error/Result architecture; env validation; local Supabase config;
   extensions migration; CI workflow; secret scanning; Husky; docs skeleton.
5. **Exclusions:** all business behaviour, auth, database domain objects.
6. **Primary roles:** developers only.
7. **Dependencies:** none. 8. **Decisions:** ADR-0001/-0003 accepted;
   DEC-REPO-01 raised. 9. **Database scope:** `extensions` schema only.
10. **RLS/authz:** none yet (no tables). 11. **Audit events:** none.
12. **Storage:** none. 13. **Jobs/outbox:** none. 14. **UI routes:** shell
    placeholders `/`, `/sign-in`, `/dashboard`, `/staff`, `/platform`.
15. **Accessibility:** skip link, single h1, landmarks, focus ring, zoom —
    e2e-asserted from day one. 16. **Security:** headers, env guards,
    three-layer bundle-secret defence. 17. **Tests:** smoke e2e, unit
    foundation, pgTAP baseline. 18. **Observability:** structured logger,
    correlation IDs. 19. **Flags:** five v1.5 flags defined, off.
20. **Rollback:** revert commits; nothing external. 21. **Entry:** empty repo.
22. **Exit (met):** `pnpm verify` green without Docker; stack + reset + pgTAP
    green with it. 23. **Proof:** Slice 0a commit + CI. 24. **Risks:** repo
    location (became R-1-03, resolved). 25. **Effort:** L.

## Slice 0b — Hosted integration assessment

1. **Slice/title:** 0b — Hosted integration assessment
2. **Status:** COMPLETE (`6016f78`)
3. **Outcome:** decision evidence, not features:
   [assessment](./assessments/hosted-supabase-assessment.md) — READY WITH
   CONDITIONS.
4. **Included:** read-only 10-check assessment; machine inventory; drift
   report; risk register + decision log created; PG 15→17 reconciliation;
   reproducible headless [runbook](./runbooks/supabase-project-assessment.md).
5. **Exclusions:** any hosted write. 6. **Roles:** operator/owner.
7. **Dependencies:** 0a. 8. **Decisions:** evidence for DEC-ENV-01/-02/-03.
9. **Database:** local major-version bump only. 10–13: n/a (assessment).
14. **UI:** none. 15–16: redaction rules; no key values recorded.
17. **Tests:** re-verified suite on PG 17. 18: n/a. 19: none. 20: n/a.
21. **Entry:** owner-authorised read access. 22. **Exit (met):** deliverables
    merged; config reconciled. 23. **Proof:** assessment docs. 24. **Risks:**
    R-0B-01…09 raised. 25. **Effort:** S.

## Slice 1 — Secure identity, tenant, RBAC, RLS, audit foundation

1. **Slice/title:** 1 — Identity & access foundation
2. **Status:** COMPLETE (`1412fc4` + hardening `9fbd783`)
3. **Outcome:** sign-in/out with anti-enumeration; live-database RBAC; tenant
   isolation; append-only audit; minimal admin surfaces proving all of it.
4. **Included:** 9 tables, 2 enums, 14 definer functions, 13 triggers; the
   guard pipeline; roster/role/audit admin UI; nonce CSP; middleware gating;
   9 seeded personas over 2 synthetic tenants; 104 pgTAP + 95 unit + 54 e2e.
5. **Exclusions (recorded deferrals):** outbox table (→ Slice 2 producer,
   Slice 8 delivery), PLT-08 (→ Slice 9), shell chrome US-UI-002 (→ with first
   heavy staff UI, Slice 3), palettes US-UI-001 / public portal US-UI-006 /
   Sentry US-OPS-003 (→ §18 of the specification; scheduled below).
6. **Roles:** all four (catalog proposed, DEC-ROLE-01).
7. **Dependencies:** 0a. 8. **Decisions:** ADR-0005 proposed; DEC-AUTH-01
   raised. 9–13: see specification §8–§13 (authoritative detail).
14. **UI routes:** `(auth)/sign-in`, `/auth/callback`, `/access-denied`,
    `/dashboard`, `/account`, `/staff`, `/staff/members`, `/staff/audit`,
    `/platform`. 15–18: per specification §11, §16.
19. **Flags:** none consumed. 20. **Rollback:** pre-hosted; revert PR.
21. **Entry (was):** 0a exit. 22. **Exit (met):** acceptance criteria of
    specification §19 at `9fbd783`. 23. **Proof:** persona walk-through:
    resident self-service; staff read-only; admin manages + audit trail shows
    it; platform sees no tenant data. 24. **Risks:** R-1-01…06 raised;
    R-1-06 partially mitigated with measurement record. 25. **Effort:** XL.

---

## Slice 2 — Resident registration, registry, and verification

1. **Slice number and title:** PHASE 7 SLICE 2 — RESIDENT REGISTRATION,
   REGISTRY, AND VERIFICATION

2. **Status:** **IN PROGRESS.** Delivered in subparts on
   `feature/slice-2-resident-registry-verification`:

   | Subpart | Scope | State |
   | --- | --- | --- |
   | **2A** | Database and domain foundation: six tables, capabilities, RLS, audit triggers, verification state machine, duplicate detection, supersede-and-link, outbox enqueue, rules/schemas/service layer, synthetic seeds, 107 new pgTAP + 24 new unit assertions | **COMPLETE** |
   | **2B** | Public sign-up (uniform anti-enumeration, two-window rate-limit seam), mandatory email confirmation — now enabled locally and exercised through Mailpit — barangay directory, resident onboarding into the shared registry, verification status page and dashboard card | **COMPLETE** |
   | 2C | Staff registry and walk-in creation UI | pending |
   | 2D | Verification queue and decision UI | pending |
   | 2E | Duplicate review and resolution UI | pending |
   | 2F | Evidence Storage bucket, signed upload/read brokering | pending |
   | 2G | Outbox intents review, hardening, e2e, docs, PR | pending |

   Architecture as built: [resident-registry-and-verification.md](./architecture/resident-registry-and-verification.md).
   DEC-AUTH-01 is resolved —
   **Option C, hybrid provisioning**
   ([ADR-0006](./adr/0006-resident-provisioning-and-registry-decisions.md)):
   public email/password sign-up with mandatory confirmation, unverified
   until reviewer approval, staff creation/invitation retained, one shared
   domain-service set for both paths, manual audited matching and
   supersede-and-link duplicate handling, rate limiting + anti-enumeration
   gating any hosted public exposure. All within-slice decisions D2-01…04
   are APPROVED.

3. **User-visible outcome:** A resident can create or complete an account
   according to the approved provisioning policy, submit the minimum required
   onboarding and identity/residency evidence, track verification status, and
   receive a verified resident profile. Authorized staff can create walk-in
   residents, search the registry, identify potential duplicates, review
   applications side by side, request more information, approve, reject with a
   reason, match an account to an existing person, and resolve permitted
   duplicates — without bypassing audit, tenant isolation, or identity
   safeguards.

4. **Included capabilities**
   - Resident onboarding flow per the DEC-AUTH-01 ruling (A, B or C below).
   - **Person registry distinct from auth accounts**: person records exist for
     walk-ins with no account; account↔person matching links them. This is
     the foundation the "same domain service for resident and walk-in"
     non-negotiable stands on.
   - Resident profile foundation beyond the minimal auth profile (names,
     birthdate, contact, address within the barangay), all placeholder-marked
     where formats are unconfirmed.
   - **Residency basis** per person (e.g. owner/renter/household member —
     final vocabulary is a within-slice owner sign-off, D2-01).
   - Identity/residency **evidence metadata** in the database; the files
     themselves in **private Storage** (below). Synthetic evidence only —
     DEC-ENV-04 stands.
   - **Verification application** with an explicit state machine:
     `draft → submitted → in_review → info_requested → resubmitted →
     approved | rejected` (terminal states re-enterable only via a new
     application; every transition audited with actor and reason where
     required; rejection **requires** a reason).
   - Resident-facing status tracking and resubmission.
   - **Staff verification queue** (filter by state, oldest-first), review
     detail with side-by-side comparison against duplicate candidates,
     approve / request-more-info / reject actions.
   - **Walk-in resident creation** by staff through the same domain service
     as self-registration.
   - **Duplicate candidate detection** on name/birthdate similarity —
     `pg_trgm` + `unaccent` were installed in Slice 0a precisely for
     fuzzy resident-name matching (migration `20260801000000`, Phase 4 §19).
   - **Account-to-person matching** and **controlled duplicate resolution**:
     supersede-and-link only (loser record marked superseded, pointer to
     survivor, both sides audited). Destructive merge is out unless the owner
     explicitly approves it (D2-02).
   - **Transactional outbox introduced here**: verification decisions enqueue
     notification intent in the domain transaction (README non-negotiable);
     *delivery* is Slice 8 — locally the console provider logs intent.
   - Audit, accessibility, responsive and low-bandwidth behaviour, tenant
     isolation tests, synthetic personas, full test-pyramid coverage — per
     the sections below.

5. **Explicit exclusions:** document requests · certificate generation ·
   payments · complaints · hearings · announcements · production deployment ·
   real government IDs or real resident data · Households as a feature (the
   `FLAG_HOUSEHOLDS_MODULE` flag remains the only seam) · Assistance ·
   Feedback · SMS · e-signature.

6. **Primary roles:** `resident` (apply, track, resubmit);
   `barangay_staff` (+new capabilities: registry read, verification review —
   exact capability keys are part of schema design D2-04);
   `barangay_administrator` (everything staff can, plus duplicate resolution
   and walk-in creation if the capability split lands that way);
   `platform_administrator` (**no tenant data** — unchanged).

7. **Dependencies:** Slice 1 exit gates (met). Supabase Storage enabled in the
   local stack (it is). No hosted dependency.

8. **Decisions — all resolved
   ([ADR-0006](./adr/0006-resident-provisioning-and-registry-decisions.md)):**
   - **DEC-AUTH-01 → RESOLVED:** Option C hybrid (18-point ruling in the ADR).
   - **D2-01 → APPROVED:** residency keys `property_owner` / `renter` /
     `household_member` / `caretaker` / `informal_resident` / `other`
     (explanation required for `other`).
   - **D2-02 → APPROVED:** supersede-and-link only; administrator capability
     + reason + full audit; no destructive or automatic merge; reversal only
     via a future audited correction workflow.
   - **D2-03 → APPROVED:** private bucket, server-brokered signed uploads,
     metadata row before upload, `{barangay}/{application}/{evidence}` paths,
     authorized short-lived read URLs, synthetic files only.
   - **D2-04 → APPROVED:** ten capability keys
     (`registry.read`, `registry.create_walk_in`, `registry.match_account`,
     `registry.resolve_duplicates`, `verification.read`,
     `verification.review`, `verification.request_information`,
     `verification.approve`, `verification.reject`,
     `verification.evidence.read`) with the staff/administrator/resident/
     platform mapping recorded in the ADR. Note the approved keys split
     review from decide (`approve`/`reject`) more finely than this
     document's earlier sketch — the ADR wording governs.

9. **Database scope (planning-level; final DDL is implementation):**
   `persons` (tenant-scoped, composite-FK anchored, name/birthdate/contact/
   address columns, `superseded_by` self-reference for resolution);
   `person_accounts` (person↔auth link, one active account per person per
   tenant); `residency_bases` catalog or enum per D2-01;
   `verification_applications` (person, state, timestamps, decided_by,
   decision_reason); `verification_evidence` (application-scoped metadata:
   kind, storage path, content hash, size — **no file bytes in the DB**);
   `outbox_events` (tenant-scoped intent: event type, payload keys — no PII
   values beyond what the notification template needs, dispatch state for
   Slice 8); plus capability rows (D2-04), triggers (audit, immutability,
   `updated_at`), and `pg_trgm`/GIN indexes for registry search. Generated
   types refreshed; seeds gain verification-scenario personas (applicant,
   info-requested, rejected, duplicate pair, walk-in without account).

10. **RLS and authorization scope:** forced RLS + composite FKs on every new
    table (non-negotiable). Residents: SELECT/UPDATE own draft application and
    own person record's self-editable columns only; никогда other residents.
    Staff: registry/queue read via `registry.read`/`verification.review`;
    decisions via `verification.decide` with WITH CHECK on state transitions;
    duplicate resolution via its own capability. Evidence rows follow their
    application's visibility. Outbox: no client SELECT at all (service path
    only). Storage policies mirror table policies (owner-write during draft,
    reviewer-read). pgTAP proves the matrix including forged-tenant attempts
    and state-transition bypasses.

11. **Audit events (same-transaction, trigger-backed where table-shaped):**
    `person.created` (self vs walk-in distinguished in metadata) ·
    `person.updated` (field names only) · `person.superseded` ·
    `person_account.linked` / `.unlinked` · `verification.submitted` ·
    `verification.state_changed` (from/to, actor; reason required on
    rejection) · `verification.evidence_added` / `.evidence_removed`
    (metadata: kind + hash, never filename) · `outbox.enqueued`. Denials via
    the existing `authz.denied` path.

12. **Storage requirements:** one **private** bucket (working name
    `verification-evidence`); path convention
    `{barangay_id}/{application_id}/{evidence_id}`; uploads through
    server-brokered signed upload URLs; reads through short-lived signed URLs
    issued only after the caller passes the same guard as the metadata row;
    MIME/size limits enforced at bucket and app layer; content hash recorded
    for tamper evidence; no public URL ever; e2e asserts an unauthenticated
    fetch of a known path fails.

13. **Background jobs / outbox:** outbox **table + enqueue only** (in the
    domain transaction). No dispatcher, no cron, no delivery — Slice 8. The
    console email provider logs intent locally so the seam is testable.

14. **UI routes and shells:** `(resident)`: `/onboarding` (multi-step,
    resumable draft), `/verification` (status + evidence + resubmission);
    dashboard card upgraded to real verification status (replacing the RES-06
    placeholder chip's data source; the chip itself stays placeholder-marked
    until Slice 3 copy is confirmed). `(staff)`: `/staff/registry` (search,
    duplicate indicators), `/staff/verification` (queue),
    `/staff/verification/[id]` (review detail, side-by-side, actions),
    `/staff/registry/new` (walk-in). Uses existing shells; the full US-UI-002
    chrome still waits for Slice 3's heavy staff surfaces.

15. **Accessibility:** WCAG 2.2 AA as DoD: labelled multi-step form with error
    summaries and per-field messages; file-upload controls keyboard-operable
    with progress announced via `role="status"`; queue tables with proper
    headers; review actions reachable and operable by keyboard; no
    information conveyed by colour alone for states; axe pass + the standing
    e2e baseline extended to the new routes.

16. **Security requirements:** everything in the cross-cutting rules, plus:
    evidence privacy per item 12; **no PII in URLs** (application IDs are
    opaque UUIDs; search terms POSTed, never query-strung); anti-enumeration
    on matching flows (uniform outcomes, as the invite RPC already models);
    uploads virus-scanning is **not** in scope (no infrastructure exists) —
    recorded as a risk with MIME/size/hash mitigations (R-2-01); rejection
    reasons are staff-authored — logged fields treated as PII (redaction
    already central).

17. **Test requirements:** pgTAP — every new table's forced-RLS matrix,
    state-machine legality (illegal transitions refused at the database),
    supersede integrity, outbox enqueue atomicity with its domain mutation,
    audit coverage of §11's events. Unit — state-machine rules, duplicate
    scoring thresholds, schema validation, guard extensions. Component —
    onboarding step behaviour, review-action forms. e2e — full resident
    journey (per ruled option), staff approve / info-request / reject /
    resubmit loops, walk-in creation, duplicate review, cross-tenant denial,
    storage-privacy probe. Coverage gate stays ≥ 80% with the measured set
    widened to the new rules/schemas. **All counts strictly increase.**

18. **Observability:** structured logs for every state transition and
    decision (IDs and states, never names); correlation IDs through the
    action chain; queue-depth derivable from the database (no new infra);
    audit trail is the operational record.

19. **Feature flags:** none — Slice 2 is MVP-core. The five existing v1.5
    flags remain off and unconsumed.

20. **Rollback approach:** additive, forward-only migrations (new tables and
    capability rows; no destructive change to Slice 1 objects); UI reachable
    only through new routes, so reverting the PR(s) restores the prior
    surface cleanly; no hosted exposure, so no data-migration rollback exists
    to design yet. Supersede-and-link (D2-02) keeps duplicate resolution
    reversible at the data level.

21. **Entry criteria — ALL MET (2026-08-01):** roadmap adopted
    (DEC-SCOPE-01 resolved) ✓; Slice 1 exit gates green ✓; DEC-AUTH-01 ruled
    — Option C ✓; D2-01…04 approved ✓
    ([ADR-0006](./adr/0006-resident-provisioning-and-registry-decisions.md)).
    Implementation may begin on the next approved feature branch.

22. **Exit criteria:** every gate in specification §19; the §17 test matrix
    green locally and in CI; pgTAP/unit/e2e counts increased; demo (below)
    performed against seeded synthetic data; docs updated (specification,
    this roadmap's status, decision log D2-01…04 outcomes, risk register,
    local-setup personas); no exclusion crept in.

23. **Expected proof/demo:** with the local stack: a resident (per the ruled
    option) completes onboarding, uploads two synthetic evidence files, sees
    `submitted`; staff finds the application in the queue, requests more info;
    resident resubmits; staff sees a duplicate candidate side-by-side (seeded
    pair), approves the application, resolves the duplicate by supersede;
    a walk-in person is created by staff without any account; every action
    appears in the tenant audit log; tenant-B staff can see none of it; an
    unauthenticated evidence-URL fetch fails; the outbox holds the decision
    intents; `verify:full`, db suite and e2e all green.

24. **Risks:** R-2-01 (evidence handling — PII-shaped synthetic files at
    rest; no AV scanning), R-2-02 (duplicate resolution semantics — bounded
    by the approved supersede-and-link ruling), R-1-04 **now activated**:
    Option C makes public sign-up part of Slice 2, so rate limiting and
    anti-enumeration are build requirements locally and hard gates before
    hosted exposure (ADR-0006 point 13), plus the standing register.

25. **Effort:** **XL** — the largest remaining schema+workflow slice besides
    5 and 7.

### DEC-AUTH-01 — RESOLVED: Option C (2026-08-01)

The product owner selected **Option C — hybrid provisioning** from the three
recorded alternatives (A public-only, B staff-invitation-only, C hybrid). The
authoritative 18-point ruling lives in
[ADR-0006](./adr/0006-resident-provisioning-and-registry-decisions.md);
the decision log carries the summary. Consequences absorbed into this slice:
the first anonymous write surface arrives with the sign-up flow, so rate
limiting and anti-enumeration are Slice 2 build requirements (R-1-04
activated); local email-confirmation UX runs through Mailpit; hosted sending
remains gated by R-0B-06 and the deployment blockers (ADR-0006 point 14).

---

## Slice 3 — Document catalog and request intake — SEQUENCED

1–2. **3 — Document catalog & request intake**; SEQUENCED.
3. **Outcome:** a verified resident — or staff serving a walk-in through the
   same domain service — selects a document type, provides purpose and
   required inputs, and submits a tracked request; staff work an intake queue.
4. **Included:** tenant document catalog (types, requirements, fees/SLAs as
   **placeholder-marked** values per B-08); request entity + state machine
   (draft→submitted→in_review→ready-for-issue hand-off to Slice 4);
   resident request tracking (US-RES-004 dashboard content becomes real);
   staff intake queue — the real staff home (supersedes the stale
   "US-STF-003/Slice 2" comment); request audit; outbox intents for status
   changes; first heavy staff surfaces → **US-UI-002 shell chrome lands
   here**, with US-UI-001 palettes + contrast tests and the US-UI-006 public
   portal (catalog browsing is the public content that justifies it).
5. **Excluded:** issuance/serials (4), payments (5), everything later.
6. **Roles:** resident, staff (+`requests.*` capabilities per catalog
   extension), admin. 7. **Depends:** Slice 2 (verified residents, persons,
   outbox). 8. **Decisions:** fee schedule/SLA/validity confirmation (B-08)
   gates **pilot**, not build — placeholders carry until then; document-type
   catalog content sign-off. 9. **DB:** `document_types`,
   `document_requests`, request-requirement rows, indexes; catalog is
   reference+tenant data. 10. **RLS:** resident sees own requests only; staff
   by capability; forced + composite FKs; pgTAP matrix. 11. **Audit:**
   request lifecycle events, catalog changes. 12. **Storage:** only if a
   document type requires supporting uploads — reuse the Slice 2 evidence
   pattern verbatim. 13. **Outbox:** status-change intents. 14. **UI:**
   public catalog page, resident request wizard + list, staff queue + detail;
   QueueShell-style layout realises the long-promised shells. 15–16:
   standing rules; no fee amount presented as final (placeholder chip
   RES-06). 17. **Tests:** full pyramid; queue filtering; walk-in-equals-
   resident service-level test. 18. Queue metrics derivable from DB.
   19. **Flags:** none. 20. Additive migrations; revert-PR rollback.
21. **Entry:** Slice 2 exit. 22. **Exit:** §19 gates + demo.
23. **Demo:** resident submits request; walk-in equivalent by staff through
    the same service; queue shows both; audit trail complete.
24. **Risks:** placeholder fees mistaken for real (mitigated by RES-06/SET-04
    machinery). 25. **Effort:** L (XL if the deferred UI chrome proves heavy).

## Slice 4 — Certificate generation, serial accountability, QR, public verification — SEQUENCED

1–2. **4 — Certificates**; SEQUENCED.
3. **Outcome:** an approved request becomes a numbered certificate with a QR
   code that anyone can verify publicly without exposing resident data.
4. **Included:** per-tenant serial series with gap accountability (voids
   recorded, never deleted); template rendering with placeholder-marked
   wording/signatories (B-05–B-07); PDF artifact generation and **private**
   storage; QR + public verification endpoint returning only
   validity + type + issue date (no PII — Phase 4 §13.6 spirit); issuance
   audit; release hand-off state for Slice 5.
5. **Excluded:** payments/release (5); e-signature (v1.5) — wet-signature
   process per B-07 placeholders.
6. **Roles:** staff issue per capability; public verifies anonymously.
7. **Depends:** 3. 8. **Decisions:** template wording, signatory titles,
   wet-signature process (B-05/-06/-07) gate pilot; serial format gates build
   of the series module (owner sign-off within slice).
9. **DB:** `certificate_series`, `certificates`, void records, artifact
   metadata. 10. **RLS:** tenant-scoped as ever; the public verification path
   reads via **service-role reasons already reserved for exactly this**
   (`generation-worker`, `certificate-artifact-write`,
   `public-certificate-verification` — the allow-list anticipated this slice;
   no new reasons needed). 11. **Audit:** issue, void, verify-hit (rate-
   limited, anonymised). 12. **Storage:** private `certificates` bucket;
   signed URLs for the resident/staff; the public endpoint never serves the
   artifact, only status. 13. **Outbox:** "ready for release" intent.
14. **UI:** staff issuance detail; public `/verify/[code]` page (tenant-
    neutral, no enumeration). 15–16: standing; QR payload contains an opaque
    code only. 17. **Tests:** serial-gap pgTAP invariants; artifact privacy
    probe; public endpoint returns no PII (e2e). 18. Issue metrics from DB.
19. None. 20. Additive; voids make corrections non-destructive.
21. **Entry:** 3 exit. 22. **Exit:** §19 + demo. 23. **Demo:** approve →
    issue → scan QR → public validity page; void → re-issue accountability
    trail. 24. **Risks:** template/legal placeholders; public endpoint as
    reconnaissance surface (mitigated: opaque codes, rate limits, no PII).
25. **Effort:** L.

## Slice 5 — Payments, exemptions, official receipts, release, day closure, call list — SEQUENCED

1–2. **5 — Payments & release**; SEQUENCED.
3. **Outcome:** cash-accountable issuance: collect or exempt, issue OR from a
   controlled series, release the document, close the day with a balanced
   summary, and work a call list of residents whose documents are ready.
4. **Included:** OR series per B-11 (placeholder format until confirmed);
   payment records incl. exemption grounds; release events tying certificate
   → payer → releaser; day-closure snapshot with discrepancy surfacing; call
   list (ready-not-released) with call-attempt logging — the list Slice 8's
   fallback consumes. 5. **Excluded:** online payment channels (no in-repo
   evidence of any gateway — would need an ADR + owner decision), reports
   beyond the day sheet (9). 6. **Roles:** cashier-capable staff (capability
   split per catalog extension), admin. 7. **Depends:** 4.
8. **Decisions:** OR series format + voided-number policy (B-11) — gates
   pilot; exemption grounds vocabulary (owner). 9. **DB:** `receipt_series`,
   `receipts`, `payments`, `exemptions`, `release_events`, `day_closures`,
   `call_attempts`. 10. **RLS:** standing rules; cashier capabilities;
   closure records immutable once finalised (trigger-refused like audit).
11. **Audit:** every peso-adjacent mutation; closure finalisation.
12. **Storage:** none new (ORs are data + print CSS, no artifact store unless
    owner asks). 13. **Outbox:** "ready for release/pickup" intents.
14. **UI:** counter payment screen (dense staff layout earns its Phase 5 §12
    density tokens), release screen, day-closure sheet (print CSS exists
    since 0a), call-list view. 15. Dense-but-accessible tables; `tabular`
    numerals (already in tokens — 0/O 1/I legibility was designed for this).
16. Standing + immutable financial records. 17. pgTAP series/closure
    invariants; balancing tests; e2e counter flow. 18. Closure discrepancies
    are the observability. 19. None. 20. Additive; voids not deletes.
21. **Entry:** 4 exit. 22. §19 + demo. 23. **Demo:** pay → OR → release →
    closure balances; exemption path; call list turnover.
24. **Risks:** cash-handling policy gaps are organisational, not technical —
    surface via placeholders; series misconfiguration (pgTAP-guarded).
25. **Effort:** XL.

## Slice 6 — Complaint intake, category gate, triage, docketing, evidence, case timeline — SEQUENCED

1–2. **6 — Complaints (KP intake)**; SEQUENCED.
3. **Outcome:** complaints enter the Katarungang Pambarangay process through a
   jurisdiction gate; non-mediable categories are referred out with guidance;
   mediable cases are docketed with parties, evidence and a visible timeline.
4. **Included:** category catalog with **non-mediable gate** (B-09 placeholder
   until confirmed); complaint entity, parties (complainant/respondent as
   registry persons — walk-in creation from Slice 2 reused), docket numbers,
   evidence (Slice 2 storage pattern), case timeline (event-sourced view over
   audit-grade case events); staff triage queue. 5. **Excluded:** hearings,
   summons, outcomes (7); feedback module (v1.5). 6. **Roles:** intake staff,
   case-capable staff (capability extension), admin; residents see own cases
   only if the owner confirms resident visibility (within-slice decision —
   default staff-only, the conservative reading). 7. **Depends:** 2 (persons,
   evidence pattern); 3's shells. 8. **Decisions:** non-mediable categories +
   referral text (B-09) gates pilot; resident case visibility (owner).
9. **DB:** `case_categories`, `cases`, `case_parties`, `case_events`,
   evidence rows; docket series per tenant. 10. **RLS:** the most sensitive
   tenant data yet — case access by capability, `no-referrer` tightening on
   case routes (the `next.config.ts` note finally lands where it belongs);
   parties never resolvable cross-tenant. 11. **Audit:** intake, gate
   outcomes incl. referrals, docketing, party/evidence changes — case_events
   and audit_events reconciled by design note. 12. **Storage:** case-evidence
   prefix, same brokered pattern. 13. **Outbox:** docketing/referral intents.
14. **UI:** intake wizard (staff), triage queue, case detail with timeline.
15–16: standing; extreme copy caution — referral text is legal-adjacent and
   placeholder-marked. 17. Full pyramid; gate-refusal paths; cross-tenant
   party probes. 18. Case-age derivable. 19. None. 20. Additive.
21. **Entry:** 2 exit (3 recommended for shells). 22. §19 + demo.
23. **Demo:** non-mediable complaint → referral with guidance; mediable →
    docket with parties + evidence + timeline. 24. **Risks:** legal-text
    placeholders; party privacy. 25. **Effort:** L.

## Slice 7 — Hearings, summons, service events, outcomes, settlement, repudiation, CFA, closure — SEQUENCED

1–2. **7 — Hearings & case lifecycle**; SEQUENCED.
3. **Outcome:** docketed cases proceed through scheduled hearings with
   summons generation and service tracking to recorded outcomes — settlement,
   repudiation window, certificate-to-file-action, closure.
4. **Included:** hearing scheduling with KP deadline awareness
   (placeholder-marked periods until legal confirmation); summons documents
   via the Slice 4 generation machinery (template B-06); service events
   (served/refused/failed with server-recorded metadata); outcome recording;
   settlement terms; repudiation window tracking; CFA issuance (a Slice 4
   certificate type); case closure locking further mutation (immutability
   trigger pattern). 5. **Excluded:** announcements (8), reports (9).
6. **Roles:** case staff, Lupon-adjacent roles **only if** the owner extends
   the catalog (DEC-ROLE-01 revisit — flagged, not assumed). 7. **Depends:**
   6 and 4. 8. **Decisions:** deadline/period vocabulary and any new role
   names (owner). 9. **DB:** `hearings`, `summons`, `service_events`,
   `case_outcomes`, `settlements`, closure states on `cases`.
10. **RLS:** as Slice 6; closed cases read-only for everyone below a
    narrowly-scoped capability. 11. **Audit:** every lifecycle event; service
    events are themselves evidence-grade. 12. **Storage:** summons artifacts
    (Slice 4 bucket pattern). 13. **Outbox:** hearing notices, outcome
    notices. 14. **UI:** hearing calendar/list, case lifecycle actions,
    closure view. 15–16: standing. 17. Deadline arithmetic unit-tested
    exhaustively; lifecycle pgTAP; closure immutability. 18. Deadline-breach
    visibility derivable. 19. None. 20. Additive; closure reversal only via
    audited administrative capability if the owner approves one.
21. **Entry:** 6 exit (4 for document machinery). 22. §19 + demo.
23. **Demo:** schedule → summons → service → settlement → repudiation window
    → closure; CFA alternative path. 24. **Risks:** statutory-period
    correctness (placeholder-marked, owner-confirmed); the heaviest domain
    logic in the plan. 25. **Effort:** XL.

## Slice 8 — Announcements, notification feed, email dispatch, digest, call-list fallback — SEQUENCED

1–2. **8 — Announcements & notification delivery**; SEQUENCED.
3. **Outcome:** the outbox becomes real: residents receive email (and an
   in-app feed) for the intents Slices 2–7 enqueued; staff publish
   announcements; residents without reliable email surface on the existing
   call list.
4. **Included:** announcements entity + publishing UI + resident feed;
   outbox dispatcher as the `outbox-dispatch` + `scheduled-job` service-role
   operations (reasons reserved since 0a) behind `api/cron` with
   `CRON_SECRET`; Resend integration behind the existing provider seam with
   the **allow-list safety net for every non-production environment**
   (env schema already enforces it); digest batching; delivery-state
   tracking; call-list fallback marking (consumes Slice 5's list).
5. **Excluded:** SMS channel (v1.5 flag), scheduled *reports* (9/v1.5).
6. **Roles:** announcement-capable staff; residents. 7. **Depends:** 2
   (outbox), 5 (call list); hosted sending additionally on R-0B-06 resolution
   — local Mailpit first. 8. **Decisions:** none blocking locally; hosted
   provider config is a Slice 9 readiness item. 9. **DB:** `announcements`,
   `notification_deliveries`, dispatch bookkeeping on `outbox_events`.
10. **RLS:** feed rows per-recipient; announcements tenant-scoped readable.
11. **Audit:** publish/retract; dispatch failures. 12. **Storage:** none.
13. **Jobs:** the first real cron path — `api/cron` route exempt from session
    middleware by design since 0a, authenticated by `CRON_SECRET`.
14. **UI:** staff announcements admin; resident feed; notification
    preferences **only if** owner asks (default: none — email+feed).
15–16: standing; unsubscribe/digest copy placeholder-marked. 17. Dispatcher
    idempotency + at-least-once tests; provider-seam unit tests; e2e feed.
18. Dispatch metrics from delivery table. 19. None (SMS stays flagged off).
20. Dispatcher disable = stop cron; additive schema. 21. **Entry:** 2 exit
    (5 for fallback wiring; announceable without it). 22. §19 + demo.
23. **Demo:** decision in Slice 2 flow → intent → local dispatch → Mailpit
    email + feed entry; announcement publish → feed; failed-address →
    call-list mark. 24. **Risks:** R-0B-06 (hosted 2/hr built-in sender)
    forces provider config before any hosted test; accidental real-send
    guarded by env schema + allow-list. 25. **Effort:** M.

## Slice 9 — Reports, exports, settings, staff administration, audit operations, platform administration, health, migration, pilot & release readiness — SEQUENCED

1–2. **9 — Operations & readiness**; SEQUENCED.
3. **Outcome:** the system becomes operable and administrable: tenant
   reports/exports, settings with the **undismissable placeholder banner**
   (SET-04), staff administration beyond Slice 1's minimum, audit retention
   operations, real platform administration (tenant provisioning, support
   grants), authenticated readiness (PLT-08), legacy-data migration decision,
   pilot gate (PLT-05).
4. **Included:** report views + CSV exports (no PII in filenames/URLs);
   settings module driving SET-04 banner + office identity placeholders
   (B-13–B-15); staff admin (deactivation flows, the R-1-05 last-admin
   recovery via platform); audit retention/archival per B-21 ruling;
   platform provisioning (`tenant-provisioning` reason — creates tenant +
   first administrator, closing the Slice 1 bootstrap note), time-boxed
   audited **support grants** (`support-grant-establishment` — the Phase 4
   §16.4 mechanism finally lands), PLT-08 readiness endpoint (job queues now
   exist to probe), go-live checklist gate (PLT-05); hosted readiness items:
   DEC-ENV-01/-02 execution, site URL/allow-list (R-0B-05), MFA (R-0B-03),
   network CIDRs (R-0B-04), legacy-key disablement (R-0B-08), PITR
   (R-0B-02); legacy PHP data migration **assessment and owner decision**
   (import is not presumed — the legacy DB's shape is known but no import
   was ever approved). 5. **Excluded:** advanced dashboards, scheduled
   reports, permission overrides, audit anomaly flags — all v1.5.
6. **Roles:** admins + platform operators (support-grant semantics per
   Phase 4 §16.4). 7. **Depends:** everything prior. 8. **Decisions:** the
   full pilot cluster — DEC-ENV-01/-02/-03, DEC-ROLE-01 confirmation, B-13…
   B-15, B-21, migration ruling. 9–14: per module above; provisioning and
   grants are service-role operations already reserved and allow-listed.
15–16: standing; exports are the largest new PII-egress surface — audited,
   capability-gated, no-cache. 17. Export redaction tests; grant expiry
   pgTAP; provisioning idempotency. 18. PLT-08 + platform health views.
19. Flags stay off; v1.5 gets its own plan after 9. 20. Per-module additive;
   pilot gate blocks release until every placeholder is confirmed or
   consciously accepted (Phase 6 §2.7). 21. **Entry:** 8 exit + owner
   availability for the decision cluster. 22. **Exit:** PLT-05 checklist
   green = **MVP release-ready**. 23. **Demo:** provision a fresh tenant end
   to end; support grant with expiry; reports/exports; banner disappears only
   as placeholders resolve. 24. **Risks:** decision-cluster latency; hosted
   environment posture (register R-0B-*). 25. **Effort:** XL.

---

## v1.5 — Feature-flagged post-MVP work

Behind the five existing environment flags (all off; the flags are the only
compatibility seams built into MVP) plus items the owner deferred:
**Households** (`FLAG_HOUSEHOLDS_MODULE`) · **Assistance**
(`FLAG_ASSISTANCE_MODULE`) · **Feedback** (`FLAG_FEEDBACK_MODULE`) ·
**SMS channel** (`FLAG_SMS_CHANNEL`) · **E-signature** (`FLAG_ESIGNATURE`) ·
scheduled reports · advanced dashboards · permission overrides · audit
anomaly flags. None of these enters an MVP slice. Planning for v1.5 happens
after Slice 9's exit gate, with its own roadmap revision.

## Blockers and owner decisions (live index)

| Decision | Blocks | Status | Owner |
| --- | --- | --- | --- |
| DEC-AUTH-01 (provisioning) | — | **RESOLVED — Option C** ([ADR-0006](./adr/0006-resident-provisioning-and-registry-decisions.md)) | Product owner |
| DEC-ROLE-01 (role names) | pilot (revisit at Slice 7 for case roles) | OPEN | Owner + Captain |
| DEC-ENV-01/-02 (topology, production project) | Slice 9 hosted items, pilot | OPEN | Owner (+Captain) |
| DEC-ENV-03 (residency) | any real ID files, pilot | OPEN | Owner + DPO + legal |
| B-08 fees/SLAs | Slice 3 **pilot** exposure | OPEN | Owner |
| B-05/-06/-07 templates & signatories | Slice 4/7 pilot | OPEN | Owner + Captain |
| B-11 OR series | Slice 5 pilot | OPEN | Owner |
| B-09 non-mediable categories | Slice 6 pilot | OPEN | Owner + legal |
| B-13–B-15, B-21 | Slice 9 / release | OPEN | Owner |
| D2-01…D2-04 | — | **APPROVED** ([ADR-0006](./adr/0006-resident-provisioning-and-registry-decisions.md)) | Owner / tech lead |
| MFA on Supabase owner account (R-0B-03) | should not wait — operational | OPEN | Repository owner |

DEC-SCOPE-01 is **resolved by this document** (decision log updated in the
same change).
