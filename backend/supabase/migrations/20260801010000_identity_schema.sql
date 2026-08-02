-- ============================================================================
-- Slice 1 · US-DB-002/003 · Identity, membership, role and audit schema
--
-- Sources: Phase 4 DB-ADR-01 (composite FK topology), DB-ADR-03 (authorization
-- resolves from live database state), DB-ADR-08 (audit payload hashing),
-- Phase 4 §16.4 (platform roles carry no implicit tenant access),
-- proposed ADR-0005 (role catalog).
--
-- Every table here receives FORCED row-level security and explicit policies in
-- 20260801050000_identity_rls.sql. This file is structure only.
-- ============================================================================

-- ── Enumerations ────────────────────────────────────────────────────────────

-- Membership lifecycle. 'invited' is a created-but-not-yet-active state;
-- 'disabled' is revocation. Transitions are audited (US-DB-004).
create type public.membership_status as enum ('invited', 'active', 'disabled');

-- Clear separation of system-level and barangay-scoped authority
-- (Phase 4 §16.4). The scope travels on composite FKs so a barangay-scoped
-- assignment structurally cannot reference a platform role, and vice versa.
create type public.role_scope as enum ('platform', 'barangay');

-- ── Tenants ─────────────────────────────────────────────────────────────────

create table public.barangays (
  id         uuid primary key default gen_random_uuid(),
  -- Machine identifier. The 'test-' prefix marks synthetic tenants; the seed
  -- guard (Phase 6 §22.2) refuses development fixtures wherever a tenant
  -- without that prefix exists.
  code       text not null unique check (code ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name       text not null check (btrim(name) <> '' and length(name) <= 120),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.barangays is
  'Tenant root. Every tenant-scoped table carries barangay_id and a composite FK back to its parent (Phase 4 DB-ADR-01).';

-- ── Profiles ────────────────────────────────────────────────────────────────

create table public.user_profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  -- The ONLY self-writable field in Slice 1 (column-level grant).
  display_name text not null check (btrim(display_name) <> '' and length(display_name) <= 120),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.user_profiles is
  'Minimal authenticated-user profile. Authorization NEVER reads auth metadata — roles and memberships live in server-controlled tables only.';

-- ── Role and permission catalogs (Tier 1 reference data) ────────────────────

create table public.roles (
  key         text primary key check (key ~ '^[a-z][a-z_]{1,62}$'),
  scope       public.role_scope not null,
  name        text not null check (btrim(name) <> ''),
  description text not null default '',
  -- Composite target so assignments can pin the scope structurally.
  unique (key, scope)
);

comment on table public.roles is
  'Role catalog (proposed ADR-0005). Rows are reference data written by migrations only — no runtime write path exists.';

create table public.permissions (
  key         text primary key check (key ~ '^[a-z]+(\.[a-z_]+)+$'),
  scope       public.role_scope not null,
  description text not null default '',
  unique (key, scope)
);

comment on table public.permissions is
  'Capability catalog. Keys are dotted capability names (e.g. membership.manage), never free text (Phase 6 §25).';

create table public.role_permissions (
  role_key       text not null,
  permission_key text not null,
  -- Shared scope column + two composite FKs: a barangay role structurally
  -- cannot hold a platform permission, and vice versa.
  scope          public.role_scope not null,
  primary key (role_key, permission_key),
  foreign key (role_key, scope) references public.roles (key, scope),
  foreign key (permission_key, scope) references public.permissions (key, scope)
);

comment on table public.role_permissions is
  'Deterministic role → capability mapping, seeded by migration. auth_has_permission() resolves through this table live (Phase 4 DB-ADR-03).';

-- ── Memberships ─────────────────────────────────────────────────────────────

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays (id),
  user_id     uuid not null references public.user_profiles (user_id) on delete cascade,
  status      public.membership_status not null default 'invited',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- One membership per user per barangay.
  unique (barangay_id, user_id),
  -- Composite FK target: children referencing a membership must carry the SAME
  -- barangay_id, making cross-tenant references unrepresentable
  -- (Phase 4 DB-ADR-01).
  unique (id, barangay_id)
);

create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_barangay_status_idx on public.memberships (barangay_id, status);

comment on table public.memberships is
  'A user''s relationship to one barangay. Multi-barangay membership is allowed; the active barangay is a server-validated selection, never a client claim.';

-- ── Barangay-scoped role assignments ────────────────────────────────────────

create table public.membership_roles (
  membership_id uuid not null,
  barangay_id   uuid not null,
  role_key      text not null,
  -- Pinned to 'barangay': a platform role cannot be assigned through the
  -- tenant-scoped path, by construction rather than by trigger.
  role_scope    public.role_scope not null default 'barangay' check (role_scope = 'barangay'),
  granted_at    timestamptz not null default now(),
  -- Set by trigger from auth.uid(); never trusted from the client. Null for
  -- seed/system grants. No FK: the grantor may later be deleted while the
  -- historical fact of the grant must survive.
  granted_by    uuid,
  primary key (membership_id, role_key),
  foreign key (membership_id, barangay_id)
    references public.memberships (id, barangay_id) on delete cascade,
  foreign key (role_key, role_scope) references public.roles (key, scope)
);

create index membership_roles_barangay_role_idx on public.membership_roles (barangay_id, role_key);

comment on table public.membership_roles is
  'Barangay-scoped role assignment. The (membership_id, barangay_id) composite FK keeps the row inside its membership''s tenant (Phase 4 DB-ADR-01).';

-- ── Platform-scoped role assignments ────────────────────────────────────────

create table public.platform_role_assignments (
  user_id    uuid not null references public.user_profiles (user_id) on delete cascade,
  role_key   text not null,
  role_scope public.role_scope not null default 'platform' check (role_scope = 'platform'),
  granted_at timestamptz not null default now(),
  granted_by uuid,
  primary key (user_id, role_key),
  foreign key (role_key, role_scope) references public.roles (key, scope)
);

comment on table public.platform_role_assignments is
  'System-level authority, deliberately separate from tenant membership. A platform role grants NO access to tenant data (Phase 4 §16.4) — support access arrives later as a time-boxed, audited grant.';

-- ── Audit trail ─────────────────────────────────────────────────────────────

create table public.audit_events (
  id             bigint generated always as identity primary key,
  occurred_at    timestamptz not null default now(),
  -- Raw uuid, deliberately without an FK: audit history must survive the
  -- deletion of the actor's account.
  actor_user_id  uuid,
  -- Null for platform-scope events. FK restricts barangay deletion while any
  -- audit history references it.
  barangay_id    uuid references public.barangays (id),
  action         text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  target_type    text not null check (target_type ~ '^[a-z_]{1,63}$'),
  target_id      text,
  outcome        text not null default 'success' check (outcome in ('success', 'denied')),
  source         text not null default 'app' check (source in ('app', 'db', 'seed')),
  correlation_id uuid,
  -- Safe metadata only: field names, status values, role keys. Never secrets,
  -- tokens, or personal values (Phase 6 §37.2).
  metadata       jsonb not null default '{}'::jsonb,
  -- Tamper-evidence hash (Phase 4 DB-ADR-08). Generated columns do not honour
  -- search_path, so the extension function is schema-qualified.
  metadata_hash  text generated always as (
    encode(extensions.digest(metadata::text, 'sha256'), 'hex')
  ) stored
);

create index audit_events_barangay_occurred_idx
  on public.audit_events (barangay_id, occurred_at desc);
create index audit_events_actor_idx on public.audit_events (actor_user_id);

comment on table public.audit_events is
  'Append-only audit trail. Writes go through append_audit_entry() inside the mutating transaction (README non-negotiable); UPDATE and DELETE are refused by trigger, grant and policy alike.';
