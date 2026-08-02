-- ============================================================================
-- Slice 2A · Resident registry, verification and outbox schema
--
-- Implements the structures ruled in ADR-0006 (DEC-AUTH-01 Option C,
-- D2-01…D2-04) per docs/IMPLEMENTATION_ROADMAP.md Slice 2 §9:
--   • persons are DISTINCT from auth accounts, applications and memberships
--     (ADR-0006 point 17); a walk-in person may exist without any account
--     (point 16)
--   • every tenant-scoped table carries barangay_id with a composite FK
--     (Phase 4 DB-ADR-01) — cross-tenant references are unrepresentable
--   • duplicate resolution is supersede-and-link ONLY (point 11 / D2-02)
--   • evidence rows are METADATA; file bytes live in private Storage (D2-03)
--   • the transactional outbox lands here as enqueue-only; delivery is
--     Slice 8 (roadmap §13)
-- ============================================================================

-- ── Enumerations ────────────────────────────────────────────────────────────

-- ADR-0006 §D2-01 fixes the residency vocabulary; the catalog TABLE below
-- carries display names and the explanation rule. This enum pins the keys at
-- the type level as well, so a typo'd key cannot exist even on owner paths.
create type public.residency_basis as enum (
  'property_owner', 'renter', 'household_member', 'caretaker',
  'informal_resident', 'other'
);

-- How a person record came to exist (ADR-0006 point 7). 'self' = the resident
-- created it through onboarding; 'staff' = walk-in / assisted creation.
create type public.person_source as enum ('self', 'staff');

-- Verification lifecycle (roadmap Slice 2 §4). Transition legality is
-- enforced by trigger + function; see the transitions table in
-- docs/architecture/resident-registry-and-verification.md.
create type public.verification_state as enum (
  'draft', 'submitted', 'in_review', 'info_requested', 'resubmitted',
  'approved', 'rejected'
);

-- Evidence classification. The minimum-evidence rule (one identity + one
-- residency item before submission) reads these kinds.
create type public.evidence_kind as enum ('identity', 'residency', 'supporting');

-- ── Residency-basis catalog (D2-01) ─────────────────────────────────────────

create table public.residency_bases (
  key                  public.residency_basis primary key,
  name                 text not null check (btrim(name) <> ''),
  requires_explanation boolean not null default false
);

comment on table public.residency_bases is
  'D2-01 catalog (ADR-0006). Reference data written by migration only; the enum pins the keys, this table carries labels and the explanation rule.';

-- ── Persons (the registry) ──────────────────────────────────────────────────

create table public.persons (
  id            uuid primary key default gen_random_uuid(),
  barangay_id   uuid not null references public.barangays (id),

  first_name    text not null check (btrim(first_name) <> '' and length(first_name) <= 100),
  middle_name   text check (middle_name is null or length(middle_name) <= 100),
  last_name     text not null check (btrim(last_name) <> '' and length(last_name) <= 100),
  suffix        text check (suffix is null or length(suffix) <= 20),
  -- Nullable: a walk-in may be registered before documents are to hand.
  -- Names and birthdates are duplicate SIGNALS, never identity proof
  -- (ADR-0006 point 9).
  birthdate     date check (birthdate is null or birthdate > date '1900-01-01'),

  contact_phone text check (contact_phone is null or length(contact_phone) <= 30),
  address_line  text check (address_line is null or length(address_line) <= 200),

  residency_basis_key public.residency_basis not null references public.residency_bases (key),
  -- Required iff the catalog row demands it ('other') — trigger-enforced,
  -- because a CHECK cannot consult the catalog.
  residency_basis_explanation text
    check (residency_basis_explanation is null
           or length(btrim(residency_basis_explanation)) between 1 and 500),

  -- ADR-0006 point 7: provenance of the record.
  source_channel  public.person_source not null,
  -- Staff actor for staff-created records; null for self-created. No FK:
  -- registry history outlives staff accounts.
  created_by      uuid,
  -- Required for staff-channel creation — trigger-enforced.
  creation_reason text
    check (creation_reason is null or length(btrim(creation_reason)) between 1 and 500),

  -- D2-02 supersede-and-link: the losing record stays, frozen, pointing at
  -- the survivor. The composite FK keeps the pointer inside the tenant.
  superseded_by     uuid,
  superseded_at     timestamptz,
  superseded_reason text
    check (superseded_reason is null or length(btrim(superseded_reason)) between 1 and 500),

  -- Maintained by trigger: lower(unaccent(names)) for pg_trgm candidate
  -- search (Phase 4 §19). Never rendered to users.
  search_text   text not null default '',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Composite anchor (Phase 4 DB-ADR-01).
  unique (id, barangay_id),
  foreign key (superseded_by, barangay_id) references public.persons (id, barangay_id),
  check (superseded_by is null or superseded_by <> id),
  -- The three supersede fields travel together.
  check ((superseded_by is null) = (superseded_at is null)
     and (superseded_by is null) = (superseded_reason is null))
);

create index persons_barangay_idx on public.persons (barangay_id);
-- btree_gin was installed in Slice 0a for exactly this composite shape:
-- tenant-scoped trigram search in one index.
create index persons_search_trgm_idx on public.persons
  using gin (barangay_id, search_text extensions.gin_trgm_ops);

comment on table public.persons is
  'The resident registry. Distinct from auth accounts, applications and memberships (ADR-0006 point 17). Superseded rows are preserved and frozen (D2-02) — never deleted.';

-- ── Account ↔ person links ──────────────────────────────────────────────────

create table public.person_accounts (
  person_id   uuid primary key,
  barangay_id uuid not null,
  user_id     uuid not null references public.user_profiles (user_id),
  linked_at   timestamptz not null default now(),
  -- Stamped from auth.uid() by trigger; null when linked by seed/system.
  linked_by   uuid,

  foreign key (person_id, barangay_id) references public.persons (id, barangay_id),
  -- One person per account per barangay; the PK gives one account per person.
  unique (barangay_id, user_id)
);

comment on table public.person_accounts is
  'Account-to-person links (ADR-0006 points 8/17). Created only through the authorized, audited matching workflow or the resident''s own onboarding — never inferred.';

-- ── Verification applications ───────────────────────────────────────────────

create table public.verification_applications (
  id            uuid primary key default gen_random_uuid(),
  barangay_id   uuid not null,
  person_id     uuid not null,

  state         public.verification_state not null default 'draft',
  submitted_at  timestamptz,
  -- Set by request_information; carried back to the resident.
  info_request_note text
    check (info_request_note is null or length(btrim(info_request_note)) between 1 and 1000),
  decided_at    timestamptz,
  decided_by    uuid,
  -- REQUIRED on rejection (ADR-0006 / roadmap): trigger-enforced together
  -- with transition legality.
  decision_reason text
    check (decision_reason is null or length(btrim(decision_reason)) between 1 and 1000),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (id, barangay_id),
  foreign key (person_id, barangay_id) references public.persons (id, barangay_id)
);

-- One open application per person: terminal states free the slot; a new
-- application is the only way past a terminal state (roadmap Slice 2 §4).
create unique index verification_applications_one_open_idx
  on public.verification_applications (person_id)
  where state not in ('approved', 'rejected');

create index verification_applications_queue_idx
  on public.verification_applications (barangay_id, state, submitted_at);

comment on table public.verification_applications is
  'Verification lifecycle for one person. Terminal states are locked; reopening requires a NEW application (enforced by trigger + partial unique index).';

-- ── Verification evidence (metadata only — D2-03) ───────────────────────────

create table public.verification_evidence (
  id             uuid primary key default gen_random_uuid(),
  barangay_id    uuid not null,
  application_id uuid not null,

  kind           public.evidence_kind not null,
  -- D2-03 MIME allow-list. Enforced again at the Storage layer in 2F.
  mime_type      text not null check (mime_type in
                   ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  -- Opaque, tenant/application/evidence-scoped Storage path (D2-03). Set by
  -- the domain function; contains only UUIDs — no PII, no original filename.
  storage_path   text not null unique,
  -- Declared at metadata creation; verified size recorded at upload
  -- confirmation. 10 MiB ceiling matches supabase/config.toml.
  declared_size_bytes bigint not null check (declared_size_bytes between 1 and 10485760),
  size_bytes     bigint check (size_bytes is null or size_bytes between 1 and 10485760),
  -- sha-256 recorded at upload confirmation (D2-03 checksum requirement).
  content_hash   text check (content_hash is null or content_hash ~ '^[a-f0-9]{64}$'),
  uploaded_at    timestamptz,

  created_at     timestamptz not null default now(),

  unique (id, barangay_id),
  foreign key (application_id, barangay_id)
    references public.verification_applications (id, barangay_id) on delete cascade,
  -- Upload confirmation is all-or-nothing.
  check ((uploaded_at is null) = (content_hash is null)
     and (uploaded_at is null) = (size_bytes is null))
);

create index verification_evidence_application_idx
  on public.verification_evidence (application_id);

comment on table public.verification_evidence is
  'Evidence METADATA only (D2-03): the metadata row exists before any upload; bytes live in private Storage under an opaque {barangay}/{application}/{evidence} path. Synthetic files only until DEC-ENV-03/-04 resolve.';

-- ── Transactional outbox (enqueue-only in Slice 2) ──────────────────────────

create table public.outbox_events (
  id              bigint generated always as identity primary key,
  barangay_id     uuid not null references public.barangays (id),
  event_type      text not null check (event_type ~ '^[a-z_]+(\.[a-z_]+)+$'),
  -- Template keys and ids only — no free narrative, no PII values beyond
  -- what the eventual notification template needs (roadmap §13).
  payload         jsonb not null default '{}'::jsonb,
  correlation_id  uuid,
  dispatch_status text not null default 'pending'
                  check (dispatch_status in ('pending', 'dispatched', 'failed')),
  created_at      timestamptz not null default now(),
  dispatched_at   timestamptz
);

create index outbox_events_pending_idx
  on public.outbox_events (dispatch_status, created_at) where dispatch_status = 'pending';

comment on table public.outbox_events is
  'Transactional outbox (README non-negotiable): intent is enqueued in the SAME transaction as the domain mutation. Slice 2 enqueues only; the dispatcher and delivery arrive in Slice 8. No client role holds any privilege here.';
