-- ============================================================================
-- Slice 4A · Certificate generation and serial accountability — schema
--
-- Implements docs/IMPLEMENTATION_ROADMAP.md Slice 4 §9:
--   • per-tenant serial series with GAP ACCOUNTABILITY — voids are recorded,
--     never deleted, and a voided serial stays consumed;
--   • certificates originate ONLY from a request in `ready_for_issue`, which
--     is where Slice 3 deliberately stopped;
--   • the verification token is opaque and non-sequential from the first
--     migration, because a token that was ever guessable cannot be un-leaked;
--   • artifact metadata exists before any bytes do (the Slice 2F/3D pattern),
--     so an artifact that never lands is visibly absent rather than silently.
--
-- Deliberately ABSENT: payments, official receipts, release, day closure.
-- Those are Slice 5. Issuance is where this slice stops.
--
-- TWO OPEN DECISIONS ARE CARRIED AS DATA RATHER THAN GUESSED
-- ----------------------------------------------------------
-- 1. **The serial DISPLAY format is unconfirmed** (roadmap Slice 4 §8: "serial
--    format gates build of the series module — owner sign-off within slice").
--    No barangay has approved one. So the numeric sequence — the part that
--    must be accountable — is real and enforced, while the human-readable
--    rendering is a column carrying `format_is_placeholder`, exactly as B-08
--    handles unconfirmed fees. A screen may not present a placeholder serial
--    as official.
-- 2. **Certificate WORDING and SIGNATORIES are unconfirmed** (B-05/-06/-07).
--    Templates carry `content_is_placeholder` for the same reason: a template
--    body invented by an engineer must never be mistaken for approved legal
--    text.
-- ============================================================================

-- ── Enumerations ────────────────────────────────────────────────────────────

-- A certificate is issued, or it has been withdrawn. There is deliberately no
-- `draft` or `pending` state: a certificate that has not been issued is not a
-- certificate, it is a request — and Slice 3 already models that lifecycle.
-- Keeping issuance atomic is what makes serial accountability provable.
create type public.certificate_status as enum ('issued', 'voided');

comment on type public.certificate_status is
  'Two states only. Anything before issuance is a document_request (Slice 3); anything after is Slice 5 release. A voided certificate keeps its serial — see certificate_voids.';

-- ── Templates ───────────────────────────────────────────────────────────────

create table public.certificate_templates (
  id           uuid primary key default gen_random_uuid(),
  barangay_id  uuid not null references public.barangays (id),

  -- Which catalog entry this template renders. A barangay may retire a
  -- template and add another for the same type, so this is not unique.
  document_type_id uuid not null,

  code         text not null check (code ~ '^[a-z][a-z0-9-]{1,48}[a-z0-9]$'),
  name         text not null check (btrim(name) <> '' and length(name) <= 120),

  -- The renderable body. Stored as text with `{{placeholders}}` resolved at
  -- render time (4B). Never contains resident data at rest.
  body         text not null check (length(btrim(body)) between 1 and 20000),

  -- ── B-05 / B-06 / B-07: UNCONFIRMED legal content ───────────────────────
  -- TRUE until the barangay captain and the product owner approve the wording
  -- and the signatory block. Like B-08's flag this is a COLUMN, not a comment,
  -- and no caller may set it: confirming legal text is an owner act.
  content_is_placeholder boolean not null default true,

  -- Signatory block, unconfirmed for the same reason (B-06). Held separately
  -- from the body so a barangay can confirm wording and signatories at
  -- different times, which is how these approvals actually arrive.
  signatory_name  text check (signatory_name is null or length(btrim(signatory_name)) between 1 and 120),
  signatory_title text check (signatory_title is null or length(btrim(signatory_title)) between 1 and 120),

  -- B-07: the wet-signature process is not digital. Recorded so a template
  -- states how it is signed rather than implying an e-signature exists.
  requires_wet_signature boolean not null default true,

  is_active    boolean not null default true,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (id, barangay_id),
  unique (barangay_id, code),
  foreign key (document_type_id, barangay_id)
    references public.document_types (id, barangay_id)
);

create index certificate_templates_type_idx
  on public.certificate_templates (barangay_id, document_type_id, is_active);

comment on table public.certificate_templates is
  'Renderable certificate bodies per document type. Wording and signatories are UNCONFIRMED (B-05/-06/-07) — `content_is_placeholder` carries that in data, and no domain function may clear it.';

comment on column public.certificate_templates.content_is_placeholder is
  'TRUE while the wording and signatory block await owner approval. Never set FALSE to make a document look official (Phase 6 §2.7).';

-- ── Serial series ───────────────────────────────────────────────────────────

create table public.certificate_series (
  id           uuid primary key default gen_random_uuid(),
  barangay_id  uuid not null references public.barangays (id),

  -- The accountability period. Barangay serial books are conventionally
  -- annual; the column is explicit so a different period is a data change
  -- rather than a code change.
  year         integer not null check (year between 2000 and 2999),

  -- The structural parts of a serial, kept SEPARATE from its rendering.
  -- `prefix` is the barangay's own token; `next_sequence` is the accountable
  -- counter. The two are combined by `format_certificate_serial()`, never by
  -- string-building at a call site.
  prefix       text not null check (prefix ~ '^[A-Z][A-Z0-9-]{0,15}$'),
  next_sequence integer not null default 1 check (next_sequence >= 1),
  -- Zero-padding width for the sequence. A presentation concern, but one the
  -- barangay owns, so it is data.
  sequence_width integer not null default 5 check (sequence_width between 1 and 12),

  -- ── The serial-format decision, unresolved ──────────────────────────────
  -- Roadmap Slice 4 §8: the format gates the series module and needs owner
  -- sign-off WITHIN this slice. Until then every series is flagged, every
  -- serial it issues is flagged with it, and the UI must say so. This is the
  -- B-08 mechanism applied to a different unconfirmed decision.
  format_is_placeholder boolean not null default true,

  is_active    boolean not null default true,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (id, barangay_id),
  -- One active accountable book per barangay per year. A second series for the
  -- same year would make "which number comes next" unanswerable.
  unique (barangay_id, year)
);

comment on table public.certificate_series is
  'The accountable serial book: one per barangay per year. `next_sequence` is the counter and never moves backwards; the DISPLAY format is unconfirmed (roadmap Slice 4 §8) and flagged as such.';

comment on column public.certificate_series.next_sequence is
  'The next number to allocate. Advanced under a row lock inside allocate_certificate_serial; never decremented, so a voided or failed number is consumed rather than silently reused.';

-- ── Certificates ────────────────────────────────────────────────────────────

create table public.certificates (
  id           uuid primary key default gen_random_uuid(),
  barangay_id  uuid not null,

  -- Provenance: which request produced this, and for whom. Both composite so
  -- a cross-tenant certificate cannot be WRITTEN, not merely refused.
  request_id   uuid not null,
  person_id    uuid not null,
  template_id  uuid not null,
  series_id    uuid not null,

  -- ── The accountable serial ──────────────────────────────────────────────
  -- The numeric sequence is the accountable fact; `serial_display` is the
  -- rendering captured AT ISSUE TIME, so a later format change cannot rewrite
  -- history. `serial_is_placeholder` travels with it (see certificate_series).
  serial_sequence integer not null check (serial_sequence >= 1),
  serial_display  text not null check (btrim(serial_display) <> ''),
  serial_is_placeholder boolean not null default true,

  status       public.certificate_status not null default 'issued',

  -- ── Public verification ─────────────────────────────────────────────────
  -- Opaque and non-sequential from the first row. 32 bytes of pgcrypto
  -- randomness rendered as 64 hex characters: not derived from the serial,
  -- not derived from any id, and carrying no resident data. The QR payload in
  -- 4D is this and nothing else.
  verification_token text not null unique
    check (verification_token ~ '^[a-f0-9]{64}$'),

  issued_at    timestamptz not null default now(),
  -- The issuing staff member. No FK: certificate history outlives staff
  -- accounts, the same rule persons.created_by and document_requests follow.
  issued_by    uuid,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (id, barangay_id),
  -- Serial accountability, enforced by the database rather than by the
  -- function that allocates: one sequence number per series, ever.
  unique (series_id, serial_sequence),

  foreign key (request_id, barangay_id)
    references public.document_requests (id, barangay_id),
  foreign key (person_id, barangay_id)
    references public.persons (id, barangay_id),
  foreign key (template_id, barangay_id)
    references public.certificate_templates (id, barangay_id),
  foreign key (series_id, barangay_id)
    references public.certificate_series (id, barangay_id)
);

-- One ACTIVE certificate per request. A reissue requires the previous one to
-- be voided first, which is what makes "how many valid certificates exist for
-- this request" answerable at any moment. Partial index rather than a plain
-- unique so voided rows stay and accumulate.
create unique index certificates_one_active_per_request_idx
  on public.certificates (request_id)
  where status = 'issued';

create index certificates_person_idx on public.certificates (person_id, issued_at desc);
create index certificates_series_idx on public.certificates (series_id, serial_sequence);

comment on table public.certificates is
  'One issued certificate. Originates ONLY from a document request in ready_for_issue (Slice 3''s terminus). The serial is accountable at the database level: (series_id, serial_sequence) is unique, and a void keeps its row.';

comment on column public.certificates.verification_token is
  'Opaque, non-sequential, 32 bytes of randomness. The entire QR payload. Never derived from the serial or any id, and never rendered into an audit entry or a log line.';

comment on column public.certificates.serial_display is
  'The serial as rendered AT ISSUE TIME. Captured rather than computed so a later format change cannot rewrite issued history.';

-- ── Voids: an immutable record, never a deletion ────────────────────────────

create table public.certificate_voids (
  id             uuid primary key default gen_random_uuid(),
  barangay_id    uuid not null,
  certificate_id uuid not null,

  -- Why it was withdrawn. Free text written by staff, and therefore treated as
  -- personal data: it is shown to authorized staff and NEVER copied into an
  -- audit payload (the audit records only that a reason exists).
  reason         text not null check (length(btrim(reason)) between 1 and 500),

  voided_at      timestamptz not null default now(),
  voided_by      uuid,

  unique (id, barangay_id),
  -- A certificate is voided once. A second void is a defect, not a correction.
  unique (certificate_id),
  foreign key (certificate_id, barangay_id)
    references public.certificates (id, barangay_id)
);

comment on table public.certificate_voids is
  'The void record. Separate from `certificates` so voiding ADDS a fact rather than editing one — the serial stays consumed, the original issuance stays readable, and the trail is non-destructive (roadmap Slice 4 §20).';

-- ── Artifact metadata ───────────────────────────────────────────────────────
-- Metadata before bytes, exactly as Slices 2F and 3D do. 4B writes the PDF
-- into a private bucket; this table is what makes an artifact that never
-- arrived visibly absent instead of silently missing.

create table public.certificate_artifacts (
  id             uuid primary key default gen_random_uuid(),
  barangay_id    uuid not null,
  certificate_id uuid not null,

  mime_type      text not null check (mime_type in ('application/pdf')),
  -- Opaque path: UUIDs only. No filename, no resident name, nothing a person
  -- could be identified from.
  storage_path   text not null unique,
  size_bytes     bigint check (size_bytes is null or size_bytes between 1 and 10485760),
  content_hash   text check (content_hash is null or content_hash ~ '^[a-f0-9]{64}$'),
  generated_at   timestamptz,
  generated_by   uuid,

  created_at     timestamptz not null default now(),

  unique (id, barangay_id),
  -- One artifact per certificate. A regenerated PDF replaces the bytes at the
  -- same path rather than creating a second row that could disagree.
  unique (certificate_id),
  foreign key (certificate_id, barangay_id)
    references public.certificates (id, barangay_id) on delete cascade,
  -- Generation is all-or-nothing, the 2F rule.
  check ((generated_at is null) = (content_hash is null)
     and (generated_at is null) = (size_bytes is null))
);

comment on table public.certificate_artifacts is
  'PDF metadata. The bytes live in a PRIVATE bucket (4B) and are reachable only through short-lived signed URLs; this row exists first so an artifact that never generated is visibly ungenerated.';

-- ── Capabilities ────────────────────────────────────────────────────────────
-- Reference data lives in migrations, never seeds (Slice 0a convention).
--
-- Granularity follows the D2-04 precedent: one capability per meaningful act,
-- so a barangay can let front-desk staff READ certificates without also
-- letting them issue a numbered legal document or withdraw one.

insert into public.permissions (key, scope, description) values
  ('certificates.read',             'barangay', 'Read issued certificates and their serials in this barangay.'),
  ('certificates.issue',            'barangay', 'Issue a certificate against a request that is ready for issue, consuming a serial.'),
  ('certificates.void',             'barangay', 'Withdraw an issued certificate, preserving its serial and recording the reason.'),
  ('certificates.manage_templates', 'barangay', 'Create and amend certificate templates, wording and signatory blocks.'),
  ('certificates.manage_series',    'barangay', 'Create and amend the accountable serial series.'),
  ('certificates.artifact.read',    'barangay', 'Obtain authorized access to the generated certificate file.');

-- ── Default role mapping ────────────────────────────────────────────────────
--
-- ISSUE, VOID and the two management capabilities are ADMINISTRATOR-ONLY, and
-- this is a deliberate reading of a genuine ambiguity worth recording.
--
-- The roadmap says "staff issue per capability" (Slice 4 §6), which grants the
-- capability rather than naming who holds it. The established precedent is
-- unambiguous in the other direction: D2-04 gave staff `verification.review`
-- but withheld `approve`/`reject`; Slice 3 gave staff `requests.review` but
-- withheld `create_walk_in` and `mark_ready`, on the stated ground that those
-- "carry commitment". Issuing a serially-numbered document that a resident
-- will present to a bank or an employer is the most committing act in the
-- system, and voiding one is the correction of a legal record.
--
-- So: staff READ. An administrator issues, voids, and owns templates and the
-- serial book. If the role matrix owner rules otherwise, this is a row update
-- and no code changes (ADR-0005's reason for keeping roles as data).
--
-- resident: NONE — own certificates reach them through self-scoped RLS.
-- platform_administrator: NONE — no tenant data, ever (Phase 4 §16.4).

insert into public.role_permissions (role_key, permission_key, scope) values
  ('barangay_staff', 'certificates.read', 'barangay'),

  ('barangay_administrator', 'certificates.read',             'barangay'),
  ('barangay_administrator', 'certificates.issue',            'barangay'),
  ('barangay_administrator', 'certificates.void',             'barangay'),
  ('barangay_administrator', 'certificates.manage_templates', 'barangay'),
  ('barangay_administrator', 'certificates.manage_series',    'barangay'),
  ('barangay_administrator', 'certificates.artifact.read',    'barangay');
