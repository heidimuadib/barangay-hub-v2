-- ============================================================================
-- pgTAP · Slice 3D · Slice-wide review: evidence, the public grant, the
-- outbox as a whole, and the structural invariants across all five tables
--
-- The Slice 2G precedent: at the end of a slice, stop testing features and
-- start testing PROPERTIES — the things that must hold across everything the
-- slice built, and that no single feature test would notice breaking.
--
-- Four sections:
--   1. supporting evidence (3D) — the Slice 2F guarantees, re-proven here;
--   2. the anon grant — stated as an exhaustive inventory, not a spot check;
--   3. the outbox audited as a whole — approved intents, asserted ABSENCES,
--      and payload hygiene as a property of every row rather than of the ones
--      someone remembered to check;
--   4. structural invariants across every Slice 3 table at once.
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
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('role', 'anon', true);
end;
$$;

create function pg_temp.as_system() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('role', 'postgres', true);
end;
$$;

-- ════ 1 · Supporting evidence ═══════════════════════════════════════════════

select has_table('public', 'document_request_evidence',
  'the evidence metadata table exists');

select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class where oid = 'public.document_request_evidence'::regclass),
  'evidence has RLS enabled AND forced');

select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_name = 'document_request_evidence'
     and grantee in ('anon', 'authenticated')
     and privilege_type <> 'SELECT'),
  0, 'no client role may write evidence through a table grant');

select ok(
  (select not public from storage.buckets where id = 'request-evidence'),
  'the request-evidence bucket is PRIVATE');

select is(
  (select file_size_limit from storage.buckets where id = 'request-evidence'),
  10485760::bigint, 'and carries the 10 MiB ceiling');

select is(
  (select count(*)::int from storage.buckets where public),
  0, 'no bucket in this project is public');

-- The storage path is opaque: UUIDs and slashes only, so no filename and no
-- resident name can ever appear in an object key.
select pg_temp.as_system();

insert into public.document_request_evidence
  (id, barangay_id, request_id, mime_type, storage_path, declared_size_bytes)
values
  ('e1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'f2000000-0000-4000-8000-000000000001', 'application/pdf',
   'a0000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000001/e1000000-0000-4000-8000-000000000001',
   2048);

select matches(
  (select storage_path from public.document_request_evidence
   where id = 'e1000000-0000-4000-8000-000000000001'),
  '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$',
  'the storage path is UUIDs only — no filename, no name, no PII');

select is(
  (select uploaded_at from public.document_request_evidence
   where id = 'e1000000-0000-4000-8000-000000000001'),
  null, 'a reserved slot starts unfinalized and counts for nothing');

-- The audit records the MIME type and nothing about the file itself.
select is(
  (select metadata->>'mime_type' from public.audit_events
   where action = 'request.evidence_added'
     and target_id = 'e1000000-0000-4000-8000-000000000001'),
  'application/pdf', 'adding evidence is audited with its type');

select is(
  (select count(*)::int from public.audit_events
   where action = 'request.evidence_added'
     and target_id = 'e1000000-0000-4000-8000-000000000001'
     and metadata::text like '%' || 'e1000000-0000-4000-8000-000000000001/' || '%'),
  0, 'and never with the storage path');

-- The evidence gate: a type that requires supporting evidence refuses to
-- submit without a FINALIZED item. f0…02 (Indigency) is the seeded
-- requires_supporting_evidence type.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');

select lives_ok(
  $$select public.create_own_request(
      'a0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000002',
      'Evidence gate check (synthetic)')$$,
  'a verified resident opens a request for an evidence-requiring type');

select pg_temp.as_system();

-- Answer its one required requirement so ONLY evidence is missing.
insert into public.document_request_answers (barangay_id, request_id, requirement_id, value)
select 'a0000000-0000-4000-8000-000000000001', dr.id,
       'f1000000-0000-4000-8000-000000000004', '2026-02-02'
from public.document_requests dr
where dr.purpose = 'Evidence gate check (synthetic)';

select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');

select throws_ok(
  $$select public.submit_request(
      (select id from public.document_requests
       where purpose = 'Evidence gate check (synthetic)'))$$,
  'P0001', 'EVIDENCE_REQUIRED',
  'submission is refused when the type needs a document and none is attached');

-- A reserved-but-unfinalized row does NOT satisfy it — the 2F tightening.
select pg_temp.as_system();

insert into public.document_request_evidence
  (id, barangay_id, request_id, mime_type, storage_path, declared_size_bytes)
select 'e1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
       dr.id, 'application/pdf',
       'a0000000-0000-4000-8000-000000000001/' || dr.id || '/e1000000-0000-4000-8000-000000000002',
       2048
from public.document_requests dr
where dr.purpose = 'Evidence gate check (synthetic)';

select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');

select throws_ok(
  $$select public.submit_request(
      (select id from public.document_requests
       where purpose = 'Evidence gate check (synthetic)'))$$,
  'P0001', 'EVIDENCE_REQUIRED',
  'a RESERVED slot whose upload never landed still does not satisfy the rule');

-- Finalized, it does.
select pg_temp.as_system();
update public.document_request_evidence
set uploaded_at = now(), size_bytes = 2048,
    content_hash = repeat('a', 64)
where id = 'e1000000-0000-4000-8000-000000000002';

select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');

select lives_ok(
  $$select public.submit_request(
      (select id from public.document_requests
       where purpose = 'Evidence gate check (synthetic)'))$$,
  'a FINALIZED document satisfies the gate');

-- A type that asks for nothing is unaffected by any of this.
select pg_temp.as_system();

select is(
  (select requires_supporting_evidence from public.document_types
   where id = 'f0000000-0000-4000-8000-000000000001'),
  false, 'the clearance type asks for no supporting document');

-- ════ 2 · The anon grant, stated exhaustively ═══════════════════════════════

select is(
  (select coalesce(string_agg(distinct table_name, ',' order by table_name), '')
   from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public'),
  'document_type_requirements,document_types',
  'anon may read the catalog tables and NOTHING else in public');

select is(
  (select count(*)::int from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public'
     and privilege_type <> 'SELECT'),
  0, 'and holds no write privilege anywhere');

select pg_temp.as_anon();

select ok(
  (select count(*)::int from public.document_types) > 0,
  'an anonymous visitor sees the public catalog');

select is(
  (select count(*)::int from public.document_types where not is_active),
  0, 'but never a withdrawn type');

-- Everything else is refused at the GRANT level, not merely filtered to zero
-- rows by a policy. That is the stronger guarantee and worth stating as such:
-- a policy can be edited into permitting something, whereas a table with no
-- grant is unreachable before any policy is consulted.
select throws_ok('select count(*) from public.document_requests', '42501',
  null, 'and cannot reach requests at all — denied before RLS is consulted');

select throws_ok('select count(*) from public.document_request_answers', '42501',
  null, 'nor answers');

select throws_ok('select count(*) from public.document_request_evidence', '42501',
  null, 'nor supporting documents');

select throws_ok('select count(*) from public.persons', '42501',
  null, 'nor any person');

select throws_ok('select count(*) from public.audit_events', '42501',
  null, 'nor the audit trail');

select throws_ok('select count(*) from public.outbox_events', '42501',
  null, 'nor the outbox');

-- ════ 3 · The outbox as a whole ═════════════════════════════════════════════

select pg_temp.as_system();

select is(
  (select coalesce(string_agg(distinct event_type, ',' order by event_type), '')
   from public.outbox_events
   where event_type like 'request.%'),
  'request.in_review,request.ready_for_issue',
  'Slice 3 enqueues exactly the two approved request intents');

select is(
  (select count(*)::int from public.outbox_events
   where event_type = 'request.submitted'),
  0, 'submission enqueues NOTHING — the requester''s own action needs no notice');

select is(
  (select count(*)::int from public.outbox_events
   where event_type like 'request.evidence%'),
  0, 'attaching a document enqueues nothing either');

select is(
  (select count(*)::int from public.outbox_events
   where event_type like 'catalog.%' or event_type like 'documents.%'),
  0, 'and catalog administration notifies nobody');

-- Payload hygiene as a PROPERTY of every row, not of remembered examples:
-- every value in every Slice 3 payload must be an opaque uuid.
select is(
  (select count(*)::int
   from public.outbox_events o, jsonb_each_text(o.payload) kv
   where o.event_type like 'request.%'
     and kv.value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  0, 'every value in every request payload is an opaque uuid — no free text');

select is(
  (select coalesce(string_agg(distinct kv.key, ',' order by kv.key), '')
   from public.outbox_events o, jsonb_each_text(o.payload) kv
   where o.event_type like 'request.%'),
  'person_id,request_id',
  'and the only keys are the two ids');

select is(
  (select count(*)::int from public.outbox_events where dispatched_at is not null),
  0, 'nothing has been dispatched — delivery is still Slice 8');

-- ════ 4 · Structural invariants across every Slice 3 table ══════════════════

select is(
  (select count(*)::int
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('document_types', 'document_type_requirements',
                       'document_requests', 'document_request_answers',
                       'document_request_evidence')
     and c.relrowsecurity and c.relforcerowsecurity),
  5, 'all five Slice 3 tables have RLS enabled AND forced');

select is(
  (select count(*)::int
   from information_schema.columns
   where table_schema = 'public'
     and table_name in ('document_types', 'document_type_requirements',
                        'document_requests', 'document_request_answers',
                        'document_request_evidence')
     and column_name = 'barangay_id'),
  5, 'every Slice 3 table carries barangay_id');

select is(
  (select count(*)::int
   from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name like 'document_%'
     and grantee = 'authenticated'
     and privilege_type <> 'SELECT'),
  0, 'authenticated holds SELECT only on every Slice 3 table — writes go through functions');

select is(
  (select count(*)::int from public.permissions where key like 'requests.%' or key like 'documents.%'),
  7, 'Slice 3 defines exactly seven capabilities');

select is(
  (select count(*)::int from public.role_permissions rp
   where rp.role_key = 'resident'
     and (rp.permission_key like 'requests.%' or rp.permission_key like 'documents.%')),
  0, 'residents hold NONE of them — their access is self-scoped RLS');

select is(
  (select count(*)::int from public.role_permissions rp
   where rp.role_key = 'platform_administrator'
     and (rp.permission_key like 'requests.%' or rp.permission_key like 'documents.%')),
  0, 'and platform administrators hold none either — no tenant data, ever');

select * from finish();
rollback;
