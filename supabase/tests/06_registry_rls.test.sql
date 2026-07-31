-- ============================================================================
-- pgTAP · Slice 2A · Registry RLS and capability matrix
--
-- Personas (seeds 01 + 02): u1 platform · u2 admin A · u3 staff A ·
-- u4 resident A (person c7, approved) · u5 admin B · u10 applicant (person
-- c1, submitted) · persons c4 walk-in (no account) · c5/c6 duplicate pair ·
-- c15 cross-tenant name twin in B.
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

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

-- ════ Anonymous: nothing, anywhere ══════════════════════════════════════════

select pg_temp.as_anon();

select throws_ok('select count(*) from public.persons', '42501',
  null, 'anon cannot read the registry');
select throws_ok('select count(*) from public.verification_applications', '42501',
  null, 'anon cannot read applications');
select throws_ok('select count(*) from public.verification_evidence', '42501',
  null, 'anon cannot read evidence metadata');
select throws_ok('select count(*) from public.outbox_events', '42501',
  null, 'anon cannot read the outbox');
select throws_ok(
  $$select * from public.person_search('a0000000-0000-4000-8000-000000000001', 'maria')$$,
  '42501', null, 'anon cannot execute registry functions');

-- ════ Resident applicant (u10, person c1): self-scope only ══════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

select is((select count(*)::int from public.persons), 1,
  'an applicant sees exactly their own person record');
select is((select count(*)::int from public.verification_applications), 1,
  'an applicant sees exactly their own application');
select is((select count(*)::int from public.verification_evidence), 2,
  'an applicant sees exactly their own evidence metadata');
select throws_ok(
  $$select * from public.duplicate_candidates(
      'a0000000-0000-4000-8000-000000000001', 'Maria', 'Santos')$$,
  '42501', null, 'a resident cannot run duplicate detection');
select throws_ok(
  $$select * from public.person_search('a0000000-0000-4000-8000-000000000001', 'juan')$$,
  '42501', null, 'a resident cannot search the registry');
select throws_ok(
  $$select public.create_walk_in_person(
      'a0000000-0000-4000-8000-000000000001', 'X', 'Y', 'renter', 'reason')$$,
  '42501', null, 'a resident cannot create walk-in persons');

-- ════ Verified resident (u4, person c7) ═════════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');

select is((select count(*)::int from public.persons), 1,
  'a verified resident still sees only their own person');
select is(
  (select state from public.verification_applications limit 1),
  'approved'::public.verification_state,
  'a resident can read their own application state');

-- ════ Staff A (u3): read the tenant, no evidence, no decisions ══════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');

select is((select count(*)::int from public.persons), 7,
  'staff see the full San Isidro registry (7 persons) and nothing of tenant B');
select is((select count(*)::int from public.verification_applications), 4,
  'staff see the tenant''s applications via verification.read');
select is((select count(*)::int from public.verification_evidence), 0,
  'staff WITHOUT verification.evidence.read see no evidence metadata (D2-04)');
select is(
  (select count(*)::int from public.person_search(
     'a0000000-0000-4000-8000-000000000001', 'maria santos')),
  2,
  'registry search finds the duplicate pair — and never the tenant-B name twin');
select is(
  (select count(*)::int from public.duplicate_candidates(
     'a0000000-0000-4000-8000-000000000001', 'Maria', 'Santos',
     date '1988-08-08')),
  2,
  'duplicate candidates are tenant-scoped: the identical name in tenant B is invisible');
select throws_ok(
  $$select public.approve_verification('d0000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'staff cannot approve');
select throws_ok(
  $$select public.reject_verification('d0000000-0000-4000-8000-000000000001', 'nope')$$,
  '42501', null, 'staff cannot reject');
select throws_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000006',
      'c0000000-0000-4000-8000-000000000005', 'dup')$$,
  '42501', null, 'staff cannot resolve duplicates');
select throws_ok(
  $$select public.link_person_account(
      'c0000000-0000-4000-8000-000000000004',
      '00000000-0000-4000-8000-000000000006')$$,
  '42501', null, 'staff cannot match accounts');

-- ════ Admin A (u2): evidence read, cross-tenant still invisible ═════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

select is((select count(*)::int from public.verification_evidence), 3,
  'administrators hold verification.evidence.read and see the tenant''s evidence');
select is(
  (select count(*)::int from public.persons
   where barangay_id = 'a0000000-0000-4000-8000-000000000002'),
  0, 'tenant-A administrators see nothing of tenant B''s registry');
select throws_ok(
  $$select * from public.duplicate_candidates(
      'a0000000-0000-4000-8000-000000000002', 'Maria', 'Santos')$$,
  '42501', null, 'capability checks are PER TENANT: admin A cannot scan tenant B');

-- ════ Admin B (u5): their registry is theirs alone ══════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000005');

select is((select count(*)::int from public.persons), 1,
  'tenant-B administrator sees exactly the one tenant-B person');

-- ════ Platform administrator (u1): zero tenant resident data ════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

select is((select count(*)::int from public.persons), 0,
  'platform administrators see NO person records (ADR-0006 point 18)');
select is((select count(*)::int from public.verification_applications), 0,
  'platform administrators see NO applications');
select is((select count(*)::int from public.verification_evidence), 0,
  'platform administrators see NO evidence metadata');
select throws_ok('select count(*) from public.outbox_events', '42501',
  null, 'platform administrators cannot read the outbox either');

select pg_temp.as_system();
select * from finish();

rollback;
