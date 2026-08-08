-- ============================================================================
-- pgTAP · Slice 4A · Certificate structure, RLS, and serial accountability
--
-- The headline requirement of this slice is not a feature, it is a PROPERTY:
-- every serial number a barangay consumes must be accounted for. That reduces
-- to four claims, each asserted here rather than argued:
--
--   1. two issuances never receive the same number;
--   2. a number, once consumed, never comes back — including after a void;
--   3. a failed issuance consumes nothing;
--   4. a void ADDS a record rather than deleting one, so the gap is explained.
--
-- Alongside them: the structural guarantees every tenant table in this project
-- carries, the RLS matrix, the ready_for_issue hand-off gate, token opacity,
-- and audit hygiene.
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(79);

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

create function pg_temp.remember(p_key text, p_value uuid) returns uuid
language plpgsql as $fn$
begin
  perform set_config('app.test_' || p_key, p_value::text, true);
  return p_value;
end;
$fn$;

create function pg_temp.recall(p_key text) returns uuid
language sql stable as $fn$
  select nullif(current_setting('app.test_' || p_key, true), '')::uuid;
$fn$;

-- The serial counter is an integer, so it needs its own pair rather than being
-- squeezed through the uuid ones.
create function pg_temp.remember_counter(p_series uuid) returns void
language plpgsql as $fn$
begin
  perform set_config('app.test_counter',
    (select next_sequence::text from public.certificate_series where id = p_series), true);
end;
$fn$;

create function pg_temp.recalled_counter() returns integer
language sql stable as $fn$
  select nullif(current_setting('app.test_counter', true), '')::integer;
$fn$;

-- Fixtures (Slice 1/2/3/4 seeds):
--   00…02 administrator (all six certificate capabilities)
--   00…03 staff (certificates.read only) · 00…04 resident ↔ person c0…07
--   00…05 admin.malinis (tenant B) · 00…01 platform administrator
--   SERIES    c1…01 San Isidro (next_sequence 3) · c1…11 Malinis
--   TEMPLATE  c2…01 clearance · c2…02 indigency · c2…03 RETIRED · c2…11 tenant B
--   CERT      c3…01 issued (serial 1) · c3…02 VOIDED (serial 2) · c3…11 tenant B
--   REQUEST   f2…04 ready_for_issue (person c0…07) · f2…02 submitted

-- ════ 1 · Structure ═════════════════════════════════════════════════════════

select has_table('public', 'certificate_templates', 'certificate_templates exists');
select has_table('public', 'certificate_series',    'certificate_series exists');
select has_table('public', 'certificates',          'certificates exists');
select has_table('public', 'certificate_voids',     'certificate_voids exists');
select has_table('public', 'certificate_artifacts', 'certificate_artifacts exists');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('certificate_templates', 'certificate_series', 'certificates',
                       'certificate_voids', 'certificate_artifacts')
     and not (c.relrowsecurity and c.relforcerowsecurity)),
  0, 'RLS is ENABLED and FORCED on all five Slice 4 tables — owner paths included');

select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public'
     and table_name in ('certificate_templates', 'certificate_series', 'certificates',
                        'certificate_voids', 'certificate_artifacts')
     and column_name = 'barangay_id'),
  5, 'every Slice 4 table carries barangay_id');

select is(
  (select count(*)::int from pg_constraint
   where conrelid = 'public.certificates'::regclass
     and contype = 'f' and array_length(conkey, 1) = 2),
  4, 'certificates references request, person, template and series by composite key');

select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and table_name like 'certificate%'
     and grantee in ('anon', 'authenticated')
     and privilege_type <> 'SELECT'),
  0, 'no client role may write any certificate table through a grant');

-- The public verification surface is NOT an anon table grant. Opening
-- `certificates` to anonymous SELECT would make it an enumeration oracle
-- however narrow the policy; 4D reads through a service-role path instead.
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and table_name like 'certificate%'
     and grantee = 'anon'),
  0, 'anon holds NO privilege on any certificate table');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like '%certificate%'
     and p.prosecdef
     and (p.proconfig is null
       or not exists (select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%'))),
  0, 'every certificate SECURITY DEFINER function pins its search_path');

-- ════ 2 · Serial accountability ═════════════════════════════════════════════

-- The database refuses a duplicate even if every lock were bypassed.
select pg_temp.as_system();

select throws_ok(
  $$insert into public.certificates
      (barangay_id, request_id, person_id, template_id, series_id,
       serial_sequence, serial_display, verification_token)
    values
      ('a0000000-0000-4000-8000-000000000001',
       'f2000000-0000-4000-8000-000000000004',
       'c0000000-0000-4000-8000-000000000007',
       'c2000000-0000-4000-8000-000000000001',
       'c1000000-0000-4000-8000-000000000001',
       1, 'DUPLICATE', repeat('f', 64))$$,
  '23505', null,
  'a duplicate serial in the same series is refused by the DATABASE, not merely by the allocator');

-- The counter cannot rewind, so a number can never be made available again.
select throws_ok(
  $$update public.certificate_series set next_sequence = 1
    where id = 'c1000000-0000-4000-8000-000000000001'$$,
  'SERIAL_SEQUENCE_CANNOT_REWIND',
  'the serial counter refuses to move backwards — even on the owner path');

-- A void keeps its row, so the gap it leaves is explained rather than absent.
select is(
  (select status::text from public.certificates
   where id = 'c3000000-0000-4000-8000-000000000002'),
  'voided', 'the voided certificate still exists');

select is(
  (select serial_sequence from public.certificates
   where id = 'c3000000-0000-4000-8000-000000000002'),
  2, 'and still holds its serial — the number stays consumed');

select is(
  (select count(*)::int from public.certificate_voids
   where certificate_id = 'c3000000-0000-4000-8000-000000000002'),
  1, 'with a void record explaining the gap');

select throws_ok(
  $$delete from public.certificate_voids
    where certificate_id = 'c3000000-0000-4000-8000-000000000002'$$,
  'certificate_voids is append-only',
  'a void record cannot be deleted — the explanation outlives the correction');

select throws_ok(
  $$update public.certificate_voids set reason = 'rewritten'
    where certificate_id = 'c3000000-0000-4000-8000-000000000002'$$,
  'certificate_voids is append-only',
  'nor rewritten');

-- Allocation advances the counter exactly once per call.
select is(
  (select next_sequence from public.certificate_series
   where id = 'c1000000-0000-4000-8000-000000000001'),
  3, 'the seeded book is positioned after its two issued serials');

select lives_ok(
  $$select public.allocate_certificate_serial('c1000000-0000-4000-8000-000000000001')$$,
  'a serial allocates');

select is(
  (select next_sequence from public.certificate_series
   where id = 'c1000000-0000-4000-8000-000000000001'),
  4, 'and the counter advanced by exactly one');

-- Two allocations in the same transaction never collide.
select is(
  (select count(distinct sequence_number)::int from (
     select (public.allocate_certificate_serial('c1000000-0000-4000-8000-000000000001')).sequence_number
     union all
     select (public.allocate_certificate_serial('c1000000-0000-4000-8000-000000000001')).sequence_number
   ) allocations),
  2, 'consecutive allocations return DIFFERENT numbers');

-- The rendering is deterministic and separated from the counter.
select is(
  public.format_certificate_serial('SI', 2026, 7, 5),
  'SI-2026-00007', 'the serial format renders the accountable parts deterministically');

-- ════ 3 · The ready_for_issue hand-off gate ═════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

-- f2…02 is `submitted` — not through review, so not issuable.
select throws_ok(
  $$select public.issue_certificate(
      'f2000000-0000-4000-8000-000000000002',
      'c2000000-0000-4000-8000-000000000001')$$,
  'P0001', 'REQUEST_NOT_READY_FOR_ISSUE',
  'a submitted request cannot be issued — Slice 3 stopped at ready_for_issue for this reason');

-- f2…01 is a draft.
select throws_ok(
  $$select public.issue_certificate(
      'f2000000-0000-4000-8000-000000000001',
      'c2000000-0000-4000-8000-000000000001')$$,
  'P0001', 'REQUEST_NOT_READY_FOR_ISSUE',
  'nor can a draft');

-- Drive the request to ready_for_issue through the REAL Slice 3 functions
-- rather than writing the state directly. `document_requests_guard` refuses
-- the skip even on the owner path, which is correct — and it means the
-- Slice 3 → Slice 4 hand-off gets exercised here rather than assumed.
select lives_ok(
  $$select public.review_request('f2000000-0000-4000-8000-000000000002')$$,
  'the request enters review through the Slice 3 function');

select lives_ok(
  $$select public.mark_request_ready('f2000000-0000-4000-8000-000000000002')$$,
  'and reaches ready_for_issue — the hand-off Slice 3 stopped at');

select throws_ok(
  $$select public.issue_certificate(
      'f2000000-0000-4000-8000-000000000002',
      'c2000000-0000-4000-8000-000000000001')$$,
  'P0001', 'TEMPLATE_TYPE_MISMATCH',
  'a clearance template cannot be used to issue an indigency request');

-- A retired template is not issuable.
select throws_ok(
  $$select public.issue_certificate(
      'f2000000-0000-4000-8000-000000000002',
      'c2000000-0000-4000-8000-000000000003')$$,
  'P0001', 'TEMPLATE_NOT_AVAILABLE',
  'a retired template cannot issue');

-- The correct template on a ready request succeeds.
select lives_ok(
  $$select pg_temp.remember('issued', public.issue_certificate(
      'f2000000-0000-4000-8000-000000000002',
      'c2000000-0000-4000-8000-000000000002'))$$,
  'a ready request with the right template issues');

select is(
  (select status::text from public.certificates where id = pg_temp.recall('issued')),
  'issued', 'the certificate is live');

-- One ACTIVE certificate per request: a second issuance is refused while the
-- first stands, so "how many valid certificates exist" is always answerable.
select throws_ok(
  $$select public.issue_certificate(
      'f2000000-0000-4000-8000-000000000002',
      'c2000000-0000-4000-8000-000000000002')$$,
  '23505', null,
  'a request cannot hold two active certificates at once');

-- ════ 4 · Reissue takes a NEW serial ════════════════════════════════════════

-- Asserted as a PROPERTY, not a literal: this suite allocates serials earlier
-- to prove the counter advances, so the exact number here depends on test
-- order. What must hold regardless is that issuance never reaches back into
-- numbers the book has already passed.
select ok(
  (select serial_sequence from public.certificates where id = pg_temp.recall('issued'))
    > (select max(c.serial_sequence) from public.certificates c
       where c.series_id = 'c1000000-0000-4000-8000-000000000001'
         and c.id <> pg_temp.recall('issued')),
  'the new certificate took a number beyond everything the book had issued');

select lives_ok(
  $$select public.void_certificate(pg_temp.recall('issued'),
      'Superseded during testing (synthetic).')$$,
  'it can be voided with a reason');

select throws_ok(
  $$select public.void_certificate(pg_temp.recall('issued'), 'Again')$$,
  'P0001', 'CERTIFICATE_NOT_ISSUED',
  'and cannot be voided twice');

select lives_ok(
  $$select pg_temp.remember('reissued', public.issue_certificate(
      'f2000000-0000-4000-8000-000000000002',
      'c2000000-0000-4000-8000-000000000002'))$$,
  'once voided, the request may be reissued');

select isnt(
  (select serial_sequence from public.certificates where id = pg_temp.recall('reissued')),
  (select serial_sequence from public.certificates where id = pg_temp.recall('issued')),
  'and the reissue receives a DIFFERENT serial — the voided one stays consumed');

select is(
  (select count(*)::int from public.certificates
   where request_id = 'f2000000-0000-4000-8000-000000000002'),
  2, 'both the voided and the reissued certificate survive for the record');

-- ════ 5 · A failed issuance consumes nothing ════════════════════════════════

-- The STRONG form of the claim, and the only one worth asserting. A failure
-- during the eligibility checks obviously consumes nothing — the allocator has
-- not run. What matters is a failure AFTER the counter has already moved.
--
-- Issuing a second time for a request that already holds a live certificate is
-- exactly that path: the allocator runs and advances the counter, and then the
-- partial unique index refuses the insert. PostgreSQL rolls the statement back
-- as a unit, so the advance goes with it.
--
-- What this actually guards is that `issue_certificate` does not DEFEAT that
-- atomicity — an `exception when others` wrapped around the insert would leave
-- the counter advanced with no certificate behind it, which is precisely the
-- unexplained gap the whole design exists to prevent.

select pg_temp.as_system();
select pg_temp.remember_counter('c1000000-0000-4000-8000-000000000001');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

select throws_ok(
  $$select public.issue_certificate(
      'f2000000-0000-4000-8000-000000000002',
      'c2000000-0000-4000-8000-000000000002')$$,
  '23505', null,
  'an issuance that fails at the INSERT — after the allocator has already run — raises');

select pg_temp.as_system();
select is(
  (select next_sequence from public.certificate_series
   where id = 'c1000000-0000-4000-8000-000000000001'),
  pg_temp.recalled_counter(),
  'and consumed NO serial — the allocation rolled back with the insert');

-- ════ 6 · Capability separation ═════════════════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');

select ok(
  public.auth_has_permission('a0000000-0000-4000-8000-000000000001', 'certificates.read'),
  'staff hold certificates.read');

select ok(
  not public.auth_has_permission('a0000000-0000-4000-8000-000000000001', 'certificates.issue'),
  'staff do NOT hold certificates.issue — issuing a numbered legal document carries commitment');

select ok(
  not public.auth_has_permission('a0000000-0000-4000-8000-000000000001', 'certificates.void'),
  'nor certificates.void');

select throws_ok(
  $$select public.issue_certificate(
      'f2000000-0000-4000-8000-000000000004',
      'c2000000-0000-4000-8000-000000000001')$$,
  '42501', 'AUTHORIZATION_DENIED',
  'and staff are refused issuance at the database');

select throws_ok(
  $$select public.void_certificate('c3000000-0000-4000-8000-000000000001', 'Nope')$$,
  '42501', 'AUTHORIZATION_DENIED',
  'and refused voiding');

select throws_ok(
  $$select public.create_certificate_series(
      'a0000000-0000-4000-8000-000000000001', 2027, 'SI')$$,
  '42501', 'AUTHORIZATION_DENIED',
  'and refused the serial book');

-- A resident holds nothing at all.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');

select throws_ok(
  $$select public.issue_certificate(
      'f2000000-0000-4000-8000-000000000004',
      'c2000000-0000-4000-8000-000000000001')$$,
  '42501', 'AUTHORIZATION_DENIED',
  'a resident cannot issue themselves a certificate');

select throws_ok(
  $$select public.void_certificate('c3000000-0000-4000-8000-000000000001', 'Nope')$$,
  '42501', 'AUTHORIZATION_DENIED',
  'nor void one');

-- ════ 7 · The RLS matrix ════════════════════════════════════════════════════

-- The resident reads their OWN certificate (person c0…07 holds c3…01).
select is(
  (select count(*)::int from public.certificates
   where id = 'c3000000-0000-4000-8000-000000000001'),
  1, 'a resident reads their own certificate');

select is(
  (select count(*)::int from public.certificates
   where person_id <> 'c0000000-0000-4000-8000-000000000007'),
  0, 'and no certificate belonging to anyone else');

-- Templates and the serial book are staff-facing: a resident has no reason to
-- read a template body or a counter.
select is(
  (select count(*)::int from public.certificate_templates), 0,
  'a resident reads no template');

select is(
  (select count(*)::int from public.certificate_series), 0,
  'and no serial book');

-- Staff read their tenant under capability.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');

select ok(
  (select count(*)::int from public.certificates) >= 2,
  'staff holding certificates.read see their tenant''s certificates');

select is(
  (select count(*)::int from public.certificates
   where barangay_id = 'a0000000-0000-4000-8000-000000000002'),
  0, 'and nothing from the other tenant');

-- Artifact metadata carries its OWN capability; staff hold read but not
-- artifact.read, mirroring D2-04's ruling for verification evidence.
select ok(
  not public.auth_has_permission('a0000000-0000-4000-8000-000000000001', 'certificates.artifact.read'),
  'staff do NOT hold certificates.artifact.read — the file is its own surface');

-- Tenant B and the platform role.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000005');

select is(
  (select count(*)::int from public.certificates
   where barangay_id = 'a0000000-0000-4000-8000-000000000001'),
  0, 'tenant B administration sees no tenant A certificate');

select throws_ok(
  $$select public.void_certificate('c3000000-0000-4000-8000-000000000001',
      'Cross-tenant attempt (synthetic)')$$,
  '42501', 'AUTHORIZATION_DENIED',
  'and cannot void one');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

select is(
  (select count(*)::int from public.certificates), 0,
  'the platform administrator sees no certificate at all');

select is(
  (select count(*)::int from public.role_permissions rp
   join public.roles r on r.key = rp.role_key
   where r.scope = 'platform' and rp.permission_key like 'certificates.%'),
  0, 'and holds no certificate capability');

select pg_temp.as_anon();

select throws_ok('select count(*) from public.certificates', '42501',
  null, 'anon cannot reach the certificate table — the public path is service-role, not a grant');

-- ════ 8 · Verification tokens ═══════════════════════════════════════════════

select pg_temp.as_system();

select is(
  (select count(*)::int from public.certificates
   where verification_token !~ '^[a-f0-9]{64}$'),
  0, 'every token is 64 hex characters');

select is(
  (select count(*)::int from (
     select verification_token from public.certificates
     group by verification_token having count(*) > 1) duplicates),
  0, 'and unique across every certificate');

-- Not derived from the serial, the id, or anything else addressable.
select is(
  (select count(*)::int from public.certificates c
   where c.verification_token like '%' || c.serial_sequence::text || '%'
     and length(c.serial_sequence::text) > 3),
  0, 'no token contains its own serial');

select throws_ok(
  $$update public.certificates
    set verification_token = repeat('e', 64)
    where id = 'c3000000-0000-4000-8000-000000000001'$$,
  'verification token is immutable',
  'a token cannot be rotated — a printed QR code is already in someone''s hand');

-- ════ 9 · Immutability of issued identity ═══════════════════════════════════

select throws_ok(
  $$update public.certificates set serial_display = 'REWRITTEN'
    where id = 'c3000000-0000-4000-8000-000000000001'$$,
  'certificate serial is immutable',
  'an issued serial cannot be rewritten');

select throws_ok(
  $$update public.certificates set person_id = 'c0000000-0000-4000-8000-000000000001'
    where id = 'c3000000-0000-4000-8000-000000000001'$$,
  'certificate identity is immutable',
  'nor reassigned to a different person');

select throws_ok(
  $$update public.certificates set status = 'issued'
    where id = 'c3000000-0000-4000-8000-000000000002'$$,
  'ILLEGAL_TRANSITION',
  'a voided certificate cannot be reinstated — the book must stay unambiguous');

-- ════ 10 · Audit hygiene ════════════════════════════════════════════════════

select is(
  (select metadata->>'serial_sequence' from public.audit_events
   where action = 'certificate.issued'
     and target_id = pg_temp.recall('reissued')::text),
  (select serial_sequence::text from public.certificates
   where id = pg_temp.recall('reissued')),
  'issuance is audited with the serial — the book must stay answerable');

select is(
  (select metadata->>'reason_present' from public.audit_events
   where action = 'certificate.void_recorded'
     and metadata->>'certificate_id' = pg_temp.recall('issued')::text),
  'true', 'a void records that a reason EXISTS');

select is(
  (select count(*)::int from public.audit_events
   where action = 'certificate.void_recorded'
     and metadata::text like '%Superseded during testing%'),
  0, 'and never the reason itself');

-- The token is a bearer credential and must appear in no audit row, ever.
select is(
  (select count(*)::int from public.audit_events a, public.certificates c
   where a.metadata::text like '%' || c.verification_token || '%'),
  0, 'no verification token appears in any audit entry');

select is(
  (select count(*)::int from public.audit_events a, public.certificate_artifacts ca
   where a.metadata::text like '%' || ca.storage_path || '%'),
  0, 'and no artifact path either');

-- Resident identity never reaches a certificate audit row.
select is(
  (select count(*)::int from public.audit_events
   where action like 'certificate.%'
     and (metadata::text ilike '%dela cruz%' or metadata::text ilike '%sanisidro%')),
  0, 'no resident name appears in any certificate audit entry');

-- ════ 11 · The outbox hand-off to Slice 5 ═══════════════════════════════════

select is(
  (select count(*)::int from public.outbox_events
   where event_type = 'certificate.ready_for_release'
     and payload->>'certificate_id' = pg_temp.recall('reissued')::text),
  1, 'issuance enqueues exactly one release intent, in the same transaction');

select is(
  (select count(*)::int
   from public.outbox_events o, jsonb_each_text(o.payload) kv
   where o.event_type = 'certificate.ready_for_release'
     and kv.value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  0, 'every value in the release payload is an opaque uuid — no serial, no token, no name');

select is(
  (select count(*)::int from public.outbox_events
   where event_type like 'certificate.%' and event_type <> 'certificate.ready_for_release'),
  0, 'and issuance enqueues no other intent — voiding notifies nobody in Slice 4');

-- ════ 12 · B-05/-06/-07 and the serial format stay unconfirmed ══════════════

select is(
  (select count(*)::int from public.certificate_templates where not content_is_placeholder),
  0, 'no seeded template claims approved wording (B-05/-06)');

select is(
  (select count(*)::int from public.certificate_series where not format_is_placeholder),
  0, 'and no series claims a confirmed serial format');

select is(
  (select count(*)::int from public.certificates where not serial_is_placeholder),
  0, 'so every issued serial carries the marking forward');

select * from finish();
rollback;
