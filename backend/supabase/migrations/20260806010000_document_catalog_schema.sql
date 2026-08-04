-- ============================================================================
-- Slice 3A · Document catalog and request intake schema
--
-- Implements docs/IMPLEMENTATION_ROADMAP.md Slice 3 §9:
--   • the catalog is TENANT data, not global reference data — each barangay
--     runs its own document types, fees and turnaround promises
--   • fees, SLAs and validity periods are UNCONFIRMED (blocker B-08) and every
--     catalog row says so in a column, not in a comment: `values_are_placeholder`
--     is the README non-negotiable's named mechanism
--   • a request may exist for a person with no account (walk-in), exactly as a
--     person may (ADR-0006 point 16) — both channels converge on one table
--   • every tenant-scoped table carries barangay_id with a composite FK
--     (Phase 4 DB-ADR-01) — cross-tenant references are unrepresentable
--
-- Deliberately ABSENT: serials, certificate artifacts, QR payloads, payment
-- rows, release records. Those are Slices 4–5; `ready_for_issue` is the
-- hand-off point and this slice stops there.
-- ============================================================================

-- ── Enumerations ────────────────────────────────────────────────────────────

-- Roadmap Slice 3 §4: draft → submitted → in_review → ready_for_issue.
--
-- There is deliberately NO decline/cancel state. The roadmap documents four
-- states and assigns issuance (and whatever refusal accompanies it) to Slice
-- 4; inventing a terminal state here would be scope the owner never approved.
-- Recorded as an open question in docs/decisions/blockers.md (DEC-REQ-01).
create type public.document_request_state as enum (
  'draft', 'submitted', 'in_review', 'ready_for_issue'
);

-- How the request reached the system. Mirrors public.person_source but is a
-- SEPARATE type on purpose: a walk-in person may later file a request online,
-- and a self-registered person may have a request filed for them at the
-- counter. Sharing one enum would imply the two channels are the same fact.
create type public.request_source as enum ('self', 'staff');

-- The shape of a per-document-type requirement input. Kept deliberately small:
-- these drive plain form controls, not a form builder.
create type public.requirement_input_kind as enum (
  'text', 'textarea', 'number', 'date', 'boolean', 'select'
);

-- ── Document catalog (tenant data) ──────────────────────────────────────────

create table public.document_types (
  id           uuid primary key default gen_random_uuid(),
  barangay_id  uuid not null references public.barangays (id),

  -- Stable machine key, unique per tenant. Used in URLs and audit metadata,
  -- so it must never carry personal data — CHECK pins it to a slug.
  code         text not null check (code ~ '^[a-z][a-z0-9-]{1,48}[a-z0-9]$'),
  name         text not null check (btrim(name) <> '' and length(name) <= 120),
  description  text check (description is null or length(description) <= 2000),

  -- Inactive types stay readable by staff and disappear from resident view;
  -- rows are never deleted, because requests reference them forever.
  is_active    boolean not null default true,

  -- ── B-08: UNCONFIRMED commercial terms ──────────────────────────────────
  -- Nullable because "not yet decided" is a real state that must not be
  -- rendered as zero. A fee of NULL means "no amount has been confirmed",
  -- which is different from a confirmed fee of 0.00 (free document).
  fee_amount    numeric(10, 2) check (fee_amount is null or fee_amount >= 0),
  fee_currency  text not null default 'PHP' check (fee_currency ~ '^[A-Z]{3}$'),
  sla_days      integer check (sla_days is null or sla_days between 0 and 365),
  validity_days integer check (validity_days is null or validity_days between 1 and 3650),

  -- The README non-negotiable, as a column. TRUE until the barangay captain
  -- and product owner confirm the schedule (blocker B-08). The UI reads this
  -- to render the RES-06 "not yet confirmed" chip; it is NOT derived from
  -- nullness, because a confirmed row may legitimately hold the same values.
  values_are_placeholder boolean not null default true,

  -- Drives the Slice 3D supporting-evidence surface. Declared here so the
  -- catalog is complete in 3A and the flag can be seeded and tested now.
  requires_supporting_evidence boolean not null default false,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Composite anchor (Phase 4 DB-ADR-01).
  unique (id, barangay_id),
  unique (barangay_id, code)
);

create index document_types_active_idx
  on public.document_types (barangay_id, is_active, name);

comment on table public.document_types is
  'Tenant document catalog (roadmap Slice 3 §9). Fees, SLAs and validity are UNCONFIRMED until B-08 resolves — `values_are_placeholder` carries that fact in data, not in prose, and no interface may present a placeholder amount as final.';

comment on column public.document_types.values_are_placeholder is
  'TRUE while fee/SLA/validity await owner confirmation (B-08). Never set FALSE to make a screen look finished (Phase 6 §2.7).';

-- ── Per-type requirements ───────────────────────────────────────────────────

create table public.document_type_requirements (
  id               uuid primary key default gen_random_uuid(),
  barangay_id      uuid not null,
  document_type_id uuid not null,

  -- Machine key, unique within its type; answers reference the row id, but the
  -- key is what application code and tests read.
  key         text not null check (key ~ '^[a-z][a-z0-9_]{1,48}[a-z0-9]$'),
  label       text not null check (btrim(label) <> '' and length(label) <= 200),
  help_text   text check (help_text is null or length(help_text) <= 500),
  input_kind  public.requirement_input_kind not null default 'text',
  is_required boolean not null default true,

  -- Choices for `select`; ignored otherwise. Trigger enforces the pairing.
  options     jsonb not null default '[]'::jsonb,

  sort_order  integer not null default 0,

  created_at  timestamptz not null default now(),

  unique (id, barangay_id),
  unique (document_type_id, key),
  foreign key (document_type_id, barangay_id)
    references public.document_types (id, barangay_id) on delete cascade
);

create index document_type_requirements_type_idx
  on public.document_type_requirements (document_type_id, sort_order);

comment on table public.document_type_requirements is
  'What a barangay asks for when someone requests this document type. Ordered, typed and labelled here so the request form is data-driven rather than hard-coded per document.';

-- ── Requests ────────────────────────────────────────────────────────────────

create table public.document_requests (
  id               uuid primary key default gen_random_uuid(),
  barangay_id      uuid not null,
  document_type_id uuid not null,
  -- The subject of the request. A person, NOT an account: a walk-in with no
  -- login is a first-class requester (roadmap Slice 3 §3).
  person_id        uuid not null,

  state            public.document_request_state not null default 'draft',

  -- Roadmap Slice 3 §4: provenance is explicit, never inferred from whether
  -- created_by happens to be null.
  source_channel   public.request_source not null,
  -- Staff actor for the assisted channel; null for self-service. No FK:
  -- request history outlives staff accounts (same rule as persons.created_by).
  created_by       uuid,
  -- Required for the staff channel — trigger-enforced, mirroring persons.
  creation_reason  text
    check (creation_reason is null or length(btrim(creation_reason)) between 1 and 500),

  -- Why the resident needs the document. Free text, so it is treated as
  -- personal data: it never enters audit metadata or an outbox payload.
  purpose          text not null
    check (length(btrim(purpose)) between 1 and 500),

  -- Lifecycle timestamps, each set by the function that causes it.
  submitted_at      timestamptz,
  review_started_at timestamptz,
  ready_at          timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (id, barangay_id),
  foreign key (person_id, barangay_id)
    references public.persons (id, barangay_id),
  foreign key (document_type_id, barangay_id)
    references public.document_types (id, barangay_id)
);

-- The staff intake queue: tenant, state, oldest actionable first.
create index document_requests_queue_idx
  on public.document_requests (barangay_id, state, submitted_at);

-- Resident tracking: "my requests, newest first".
create index document_requests_person_idx
  on public.document_requests (person_id, created_at desc);

comment on table public.document_requests is
  'One document request. The resident and staff-assisted channels converge here through the SAME domain functions (roadmap Slice 3 §3) — source_channel records which door it came through, and nothing else differs.';

comment on column public.document_requests.purpose is
  'Resident free text. Personal data: never copied into audit metadata or an outbox payload (Phase 6 §37.2).';

-- ── Answers to the type's requirements ──────────────────────────────────────

create table public.document_request_answers (
  id             uuid primary key default gen_random_uuid(),
  barangay_id    uuid not null,
  request_id     uuid not null,
  requirement_id uuid not null,

  -- Everything is stored as text and validated against the requirement's
  -- input_kind by trigger. One column keeps the answer set queryable as a
  -- unit; typed columns would mean five mostly-null columns per row.
  value          text not null check (length(btrim(value)) between 1 and 1000),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (id, barangay_id),
  unique (request_id, requirement_id),
  foreign key (request_id, barangay_id)
    references public.document_requests (id, barangay_id) on delete cascade,
  foreign key (requirement_id, barangay_id)
    references public.document_type_requirements (id, barangay_id)
);

create index document_request_answers_request_idx
  on public.document_request_answers (request_id);

comment on table public.document_request_answers is
  'Answers to the document type''s requirements. Values are resident-supplied personal data — audited by PRESENCE and count only, never by content.';
