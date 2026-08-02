-- ============================================================================
-- pgTAP · Slice 3A · Document catalog: structure, RLS, placeholder honesty
--
-- The catalog is the first TENANT-OWNED reference data in the system, and the
-- first place the project's placeholder rule becomes a database constraint
-- rather than a UI convention. This file proves:
--
--   • the four new tables are structurally sound: forced RLS, composite
--     tenant anchors, no client write grant;
--   • residents see ACTIVE types in their own barangay and nothing else —
--     not inactive ones, not another tenant's;
--   • inactive types remain visible to a capability holder, because a
--     withdrawn document still has history;
--   • requirements inherit their type's visibility exactly;
--   • B-08: every catalog row carries values_are_placeholder, the flag
--     cannot be set by a caller, and no seeded row pretends to be confirmed.
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(38);

create function pg_temp.impersonate(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

create function pg_temp.as_system() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('role', 'postgres', true);
end;
$$;

-- Personas from the Slice 1/2 seeds.
--   00…02 barangay administrator (San Isidro)
--   00…03 barangay staff         (San Isidro)
--   00…04 resident, approved + ACTIVE member (San Isidro), person c0…07
--   00…10 applicant, person c0…01, membership NOT active
--   00…01 platform administrator
--   00…05 administrator of the OTHER tenant (Malinis)

-- ════ Structure ═════════════════════════════════════════════════════════════

select has_table('public', 'document_types', 'document_types exists');
select has_table('public', 'document_type_requirements', 'document_type_requirements exists');
select has_table('public', 'document_requests', 'document_requests exists');
select has_table('public', 'document_request_answers', 'document_request_answers exists');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('document_types', 'document_type_requirements',
                       'document_requests', 'document_request_answers')
     and not (c.relrowsecurity and c.relforcerowsecurity)),
  0, 'RLS is ENABLED and FORCED on all four Slice 3 tables — owner paths included');

-- Composite tenant anchors: every table must expose (id, barangay_id) so that
-- children can reference it without leaving the tenant.
select is(
  (select count(*)::int from pg_constraint
   where conrelid in ('public.document_types'::regclass,
                      'public.document_type_requirements'::regclass,
                      'public.document_requests'::regclass,
                      'public.document_request_answers'::regclass)
     and contype = 'u'
     and conkey = array[
       (select attnum from pg_attribute
        where attrelid = conrelid and attname = 'id'),
       (select attnum from pg_attribute
        where attrelid = conrelid and attname = 'barangay_id')]::smallint[]),
  4, 'every Slice 3 table carries the (id, barangay_id) composite anchor');

-- The tenant-crossing guarantee: children reference parents by BOTH columns.
select is(
  (select count(*)::int from pg_constraint
   where conrelid = 'public.document_requests'::regclass
     and contype = 'f' and array_length(conkey, 1) = 2),
  2, 'document_requests references person AND document type by composite key');

select is(
  (select count(*)::int from pg_constraint
   where conrelid = 'public.document_request_answers'::regclass
     and contype = 'f' and array_length(conkey, 1) = 2),
  2, 'document_request_answers references request AND requirement by composite key');

-- No client may write to any of these tables directly.
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('document_types', 'document_type_requirements',
                        'document_requests', 'document_request_answers')
     and grantee in ('anon', 'authenticated')
     and privilege_type <> 'SELECT'),
  0, 'authenticated and anon hold no INSERT/UPDATE/DELETE on any Slice 3 table');

select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('document_types', 'document_type_requirements',
                        'document_requests', 'document_request_answers')
     and grantee = 'anon'),
  0, 'anon holds NO privilege at all on the Slice 3 tables');

-- ════ Capabilities and role mapping ═════════════════════════════════════════

select is(
  (select array_agg(key order by key) from public.permissions
   where key like 'documents.%' or key like 'requests.%'),
  array['documents.catalog.manage', 'documents.catalog.read',
        'requests.create_walk_in', 'requests.mark_ready',
        'requests.read', 'requests.review'],
  'exactly the six approved Slice 3 capabilities exist');

select is(
  (select array_agg(permission_key order by permission_key)
   from public.role_permissions
   where role_key = 'barangay_staff'
     and (permission_key like 'documents.%' or permission_key like 'requests.%')),
  array['documents.catalog.read', 'requests.read', 'requests.review'],
  'staff may read the catalog and work the queue, but not create walk-ins or mark ready');

select is(
  (select count(*)::int from public.role_permissions
   where role_key = 'barangay_administrator'
     and (permission_key like 'documents.%' or permission_key like 'requests.%')),
  6, 'the administrator holds all six');

select is(
  (select count(*)::int from public.role_permissions
   where role_key = 'resident'
     and (permission_key like 'documents.%' or permission_key like 'requests.%')),
  0, 'residents hold NO Slice 3 capability — self-scope is through RLS only');

select is(
  (select count(*)::int from public.role_permissions rp
   join public.roles r on r.key = rp.role_key
   where r.scope = 'platform'
     and (rp.permission_key like 'documents.%' or rp.permission_key like 'requests.%')),
  0, 'no platform role receives any Slice 3 capability');

-- ════ B-08: the placeholder rule is data, not prose ═════════════════════════

select has_column('public', 'document_types', 'values_are_placeholder',
  'the catalog carries the README''s named placeholder mechanism');

select col_not_null('public', 'document_types', 'values_are_placeholder',
  'values_are_placeholder is never unknown');

select is(
  (select count(*)::int from public.document_types where not values_are_placeholder),
  0, 'no seeded catalog row claims its fee/SLA/validity is confirmed (B-08 is open)');

-- A NULL fee is a real state: "no amount decided", distinct from a free
-- document priced at 0.00. Both must be representable.
select is(
  (select count(*)::int from public.document_types where fee_amount is null),
  1, 'a type with NO confirmed amount exists and is distinct from a zero fee');

select is(
  (select count(*)::int from public.document_types where fee_amount = 0),
  1, 'a genuinely free type exists and is NOT conflated with an unset fee');

-- The flag is not a caller-supplied parameter: creating a type through the
-- domain function always produces a placeholder row.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select lives_ok(
  $$select public.create_document_type(
      'a0000000-0000-4000-8000-000000000001', 'test-new-type', 'New Type (Test)',
      null, 123.45, 7, 90, false)$$,
  'an administrator may add a document type');

select is(
  (select values_are_placeholder from public.document_types
   where code = 'test-new-type'),
  true,
  'a newly created type is placeholder BY CONSTRUCTION — confirmation is an owner act, not a parameter');

select is(
  (select count(*)::int from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_document_type'
     and pg_get_function_arguments(p.oid) like '%values_are_placeholder%'),
  0, 'create_document_type exposes NO parameter that could set the flag');

-- ════ Catalog visibility ════════════════════════════════════════════════════

-- Resident of San Isidro: active types in their own barangay only.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');

select is(
  (select count(*)::int from public.document_types),
  4, 'the resident sees the four ACTIVE San Isidro types (incl. the one just added)');

select is(
  (select count(*)::int from public.document_types where not is_active),
  0, 'the resident sees NO inactive type');

select is(
  (select count(*)::int from public.document_types
   where barangay_id = 'a0000000-0000-4000-8000-000000000002'),
  0, 'the resident sees nothing from the other tenant');

select is(
  (select count(*)::int from public.document_type_requirements),
  5, 'the resident sees requirements of visible types only');

-- Staff hold documents.catalog.read: the withdrawn type is still theirs.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');

select is(
  (select count(*)::int from public.document_types where not is_active),
  1, 'staff DO see the inactive type — a withdrawn document still has history');

select is(
  (select count(*)::int from public.document_types
   where barangay_id = 'a0000000-0000-4000-8000-000000000002'),
  0, 'staff still see nothing from the other tenant');

-- A user with no ACTIVE membership is not a catalog audience.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000010');
select is(
  (select count(*)::int from public.document_types),
  0, 'an applicant without an active membership sees no catalog at all');

-- Platform administrators: no tenant data, ever.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000001');
select is(
  (select count(*)::int from public.document_types),
  0, 'the platform administrator sees NO tenant catalog (Phase 4 §16.4)');

select is(
  (select count(*)::int from public.document_requests),
  0, 'the platform administrator sees NO tenant requests');

-- The other tenant's administrator sees only their own.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000005');
select is(
  (select count(*)::int from public.document_types
   where barangay_id = 'a0000000-0000-4000-8000-000000000001'),
  0, 'tenant B''s administrator cannot read tenant A''s catalog');

-- anon holds nothing.
select pg_temp.as_anon();
select throws_ok('select count(*) from public.document_types', '42501',
  null, 'anon cannot read the catalog (the public portal is a later, reviewed change)');

-- ════ Catalog management is capability-gated ════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');
select throws_ok(
  $$select public.create_document_type(
      'a0000000-0000-4000-8000-000000000001', 'staff-attempt', 'Nope (Test)')$$,
  '42501', null,
  'staff cannot create a document type — that needs documents.catalog.manage');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000005');
select throws_ok(
  $$select public.create_document_type(
      'a0000000-0000-4000-8000-000000000001', 'cross-tenant', 'Nope (Test)')$$,
  '42501', null,
  'tenant B''s administrator cannot add a type to tenant A');

-- ════ Requirement coherence ═════════════════════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.add_document_type_requirement(
      'f0000000-0000-4000-8000-000000000001', 'bad_select', 'Bad select',
      'select', true, null, '[]'::jsonb, 99)$$,
  'SELECT_REQUIRES_OPTIONS',
  'a select requirement without choices is an unanswerable question');

select throws_ok(
  $$select public.add_document_type_requirement(
      'f0000000-0000-4000-8000-000000000001', 'bad_text', 'Bad text',
      'text', true, null, '["a","b"]'::jsonb, 99)$$,
  'OPTIONS_NOT_APPLICABLE',
  'choices on a free-text requirement are dead data and are refused');

select pg_temp.as_system();
select * from finish();

rollback;
