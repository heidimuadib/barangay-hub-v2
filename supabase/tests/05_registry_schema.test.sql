-- ============================================================================
-- pgTAP · Slice 2A · Registry schema structure
--
-- Structural guarantees for the six new tables: enums, composite tenant
-- keys, the one-open-application rule, the trigram search index, capability
-- rows and mappings (D2-01/D2-04), grant surface, and trigger wiring.
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

-- ── Enumerations ────────────────────────────────────────────────────────────

select enum_has_labels('public', 'residency_basis',
  array['property_owner','renter','household_member','caretaker','informal_resident','other'],
  'D2-01: the residency vocabulary is pinned at the type level');
select enum_has_labels('public', 'person_source', array['self','staff'],
  'person provenance channels');
select enum_has_labels('public', 'verification_state',
  array['draft','submitted','in_review','info_requested','resubmitted','approved','rejected'],
  'the verification lifecycle states');
select enum_has_labels('public', 'evidence_kind', array['identity','residency','supporting'],
  'evidence kinds');

-- ── Composite tenant keys (Phase 4 DB-ADR-01) ───────────────────────────────

select is(
  (select count(*)::int from information_schema.table_constraints tc
   join information_schema.key_column_usage k
     on k.constraint_name = tc.constraint_name and k.constraint_schema = tc.constraint_schema
   where tc.table_schema = 'public' and tc.constraint_type = 'FOREIGN KEY'
     and tc.table_name in ('person_accounts','verification_applications',
                           'verification_evidence')
     and k.column_name = 'barangay_id'),
  3,
  'every child registry table carries its barangay_id inside a composite FK');

select is(
  (select count(*)::int from information_schema.table_constraints tc
   join information_schema.key_column_usage k
     on k.constraint_name = tc.constraint_name and k.constraint_schema = tc.constraint_schema
   where tc.table_schema = 'public' and tc.table_name = 'persons'
     and tc.constraint_type = 'FOREIGN KEY' and k.column_name = 'superseded_by'),
  1,
  'the supersede pointer is a real (composite) FK — it cannot dangle or cross tenants');

-- ── One open application per person ─────────────────────────────────────────

select is(
  (select count(*)::int from pg_catalog.pg_indexes
   where schemaname = 'public'
     and indexname = 'verification_applications_one_open_idx'
     and indexdef like '%WHERE%'),
  1,
  'the partial unique index enforcing one OPEN application per person exists');

-- ── Tenant-scoped trigram search (Phase 4 §19) ──────────────────────────────

select is(
  (select count(*)::int from pg_catalog.pg_indexes
   where schemaname = 'public' and indexname = 'persons_search_trgm_idx'
     and indexdef like '%gin%' and indexdef like '%gin_trgm_ops%'),
  1,
  'the composite (barangay_id, search_text) trigram index exists — btree_gin earns its install');

-- ── D2-01 catalog ───────────────────────────────────────────────────────────

select is((select count(*)::int from public.residency_bases), 6,
  'exactly the six approved residency bases are seeded');
select is(
  (select array_agg(key order by key) from public.residency_bases
   where requires_explanation),
  array['other']::public.residency_basis[],
  'only "other" requires an explanation');

-- ── D2-04 capabilities and mapping ──────────────────────────────────────────

select is(
  (select count(*)::int from public.permissions
   where key like 'registry.%' or key like 'verification.%'),
  10,
  'exactly the ten approved Slice 2 capability keys exist');

select is(
  (select array_agg(rp.permission_key order by rp.permission_key)
   from public.role_permissions rp
   where rp.role_key = 'barangay_staff'
     and (rp.permission_key like 'registry.%' or rp.permission_key like 'verification.%')),
  array['registry.read','verification.read','verification.request_information',
        'verification.review'],
  'barangay_staff holds exactly the four approved Slice 2 capabilities');

select is(
  (select count(*)::int from public.role_permissions rp
   where rp.role_key = 'barangay_administrator'
     and (rp.permission_key like 'registry.%' or rp.permission_key like 'verification.%')),
  10,
  'barangay_administrator holds all ten Slice 2 capabilities');

select is(
  (select count(*)::int from public.role_permissions rp
   where rp.role_key in ('resident', 'platform_administrator')
     and (rp.permission_key like 'registry.%' or rp.permission_key like 'verification.%')),
  0,
  'residents and platform administrators hold NO Slice 2 staff capability (ADR-0006)');

-- ── Grant surface: read-only clients, silent outbox ─────────────────────────

select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and table_name in ('residency_bases','persons','person_accounts',
                        'verification_applications','verification_evidence')
     and privilege_type <> 'SELECT'),
  0,
  'authenticated holds SELECT only on registry tables — every write is a definer function');

select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'outbox_events'
     and grantee in ('anon', 'authenticated')),
  0,
  'no client role holds ANY privilege on outbox_events');

select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'
     and table_name in ('residency_bases','persons','person_accounts',
                        'verification_applications','verification_evidence',
                        'outbox_events')),
  0,
  'anon holds nothing on any registry table');

-- ── Trigger wiring ──────────────────────────────────────────────────────────

select has_trigger('public', 'persons', 'persons_before_write',
  'derivation/validation/freeze trigger exists on persons');
select has_trigger('public', 'persons', 'persons_audit',
  'persons changes are audited by trigger');
select has_trigger('public', 'person_accounts', 'person_accounts_audit',
  'link and unlink are audited by trigger');
select has_trigger('public', 'verification_applications', 'verification_applications_guard',
  'the transition guard exists on verification_applications');
select has_trigger('public', 'verification_applications', 'verification_applications_audit',
  'state changes are audited by trigger');
select has_trigger('public', 'verification_evidence', 'verification_evidence_audit',
  'evidence add/remove is audited by trigger');
select has_trigger('public', 'outbox_events', 'outbox_events_guard',
  'outbox rows accept dispatch bookkeeping only');
select has_trigger('public', 'outbox_events', 'outbox_events_audit',
  'every enqueue is audited');

select * from finish();

rollback;
