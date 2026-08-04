-- ============================================================================
-- pgTAP · Slice 3B · Resident request intake
--
-- What 3B adds to the 3A domain, proven at the database:
--
--   1. the VERIFICATION gate on `create_own_request` — a person record is no
--      longer enough, and the refusal is distinguishable from "who are you";
--   2. own-request catalog visibility — a requester keeps reading the type
--      behind their own request even after the barangay withdraws it, WITHOUT
--      that becoming a way for a non-member to read the catalog;
--   3. the resident read surface — own requests and own answers only, across
--      residents, tenants and the platform role.
--
-- The submission path itself (completeness, transitions, audit, outbox) is
-- proven in 14; what is re-proven here is the part a RESIDENT drives end to
-- end on their own session, because that is the journey 3B ships.
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

create function pg_temp.impersonate(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
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

-- Fixtures (Slice 1/2/3 seeds):
--   ACCOUNT 00…04 resident.sanisidro  ↔ person c0…07, APPROVED, active member
--   ACCOUNT 00…13 unverified.sanisidro ↔ person c0…08, submitted, ACTIVE member
--   ACCOUNT 00…10 applicant.sanisidro  ↔ person c0…01, submitted, NO membership
--   ACCOUNT 00…03 staff  (requests.read, no person)   00…02 admin (walk-in)
--   ACCOUNT 00…05 admin.malinis (tenant B)   00…01 platform administrator
--   TYPE f0…01 clearance (active) · f0…04 retired (INACTIVE)
--   REQS f1…01 years (number, req) · f1…02 intended_use (select, req)
--        f1…03 remarks (textarea, optional)
--   REQUESTS f2…01 draft (c0…07) · f2…02 submitted (c0…01) · f2…04 ready (c0…07)

-- ════ 1 · Verification standing ═════════════════════════════════════════════

select ok(
  public.person_is_verified('c0000000-0000-4000-8000-000000000007'),
  'an approved person is verified');

select ok(
  not public.person_is_verified('c0000000-0000-4000-8000-000000000008'),
  'a person whose application is only submitted is NOT verified');

select ok(
  not public.person_is_verified('c0000000-0000-4000-8000-000000000003'),
  'a rejected person is not verified');

select ok(
  not public.person_is_verified('c0000000-0000-4000-8000-000000000004'),
  'a walk-in person with no application at all is not verified');

-- ════ 2 · The gate on create_own_request ════════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');

select lives_ok(
  $$select pg_temp.remember('fresh', public.create_own_request(
      'a0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000001',
      'Verified resident request (synthetic)'))$$,
  'a VERIFIED resident creates a request');

-- An ACTIVE MEMBER of the barangay, holding the resident role, with a person
-- record — refused for exactly one reason.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000013');

select throws_ok(
  $$select public.create_own_request(
      'a0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000001',
      'Should fail (synthetic)')$$,
  'P0001', 'RESIDENT_NOT_VERIFIED',
  'an active member who is not verified cannot file a request');

-- The gate is about STANDING, not membership: an applicant with no membership
-- is refused for the same reason rather than a different one.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

select throws_ok(
  $$select public.create_own_request(
      'a0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000001',
      'Should fail (synthetic)')$$,
  'P0001', 'RESIDENT_NOT_VERIFIED',
  'an unverified applicant is refused on standing, not on membership');

-- Ordering matters: an unverified caller naming a WITHDRAWN type learns
-- nothing about the type. Standing is checked first.
select throws_ok(
  $$select public.create_own_request(
      'a0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000004',
      'Should fail (synthetic)')$$,
  'P0001', 'RESIDENT_NOT_VERIFIED',
  'the standing check runs BEFORE the catalog check — no type is disclosed');

-- Someone with no person record at all is a different refusal: the caller is
-- not a resident here, which is not the same as not being verified yet.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');

select throws_ok(
  $$select public.create_own_request(
      'a0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000001',
      'Should fail (synthetic)')$$,
  '42501', 'AUTHORIZATION_DENIED',
  'a caller who is nobody here is denied, not told they are unverified');

-- The assisted channel is deliberately NOT gated (DEC-REQ-02): staff see the
-- person in front of them. Asserted so the asymmetry stays a decision.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

select lives_ok(
  $$select public.create_walk_in_request(
      'a0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000008',
      'f0000000-0000-4000-8000-000000000001',
      'Counter request for an unverified person (synthetic)',
      'Filed at the counter (synthetic)')$$,
  'the staff walk-in path is NOT gated on verification — 3C decides that');

-- ════ 3 · The resident read surface ═════════════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');

select is(
  (select count(*)::int from public.document_requests
   where person_id <> 'c0000000-0000-4000-8000-000000000007'),
  0, 'a resident sees no request that is not their own');

select is(
  (select count(*)::int from public.document_requests
   where id = 'f2000000-0000-4000-8000-000000000002'),
  0, 'another resident''s request is simply not there');

select is(
  (select count(*)::int from public.document_request_answers a
   join public.document_requests r on r.id = a.request_id
   where r.person_id <> 'c0000000-0000-4000-8000-000000000007'),
  0, 'answers follow their request — no foreign answer is readable');

select is(
  (select count(*)::int from public.document_requests
   where barangay_id = 'a0000000-0000-4000-8000-000000000002'),
  0, 'a resident sees nothing from the other tenant');

-- An active member with no requests sees an empty list, not an error.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000013');

select is(
  (select count(*)::int from public.document_requests
   where person_id = 'c0000000-0000-4000-8000-000000000008'
     and source_channel = 'self'),
  0, 'the unverified member filed nothing themselves');

-- Tenant B and the platform role.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000005');

select is(
  (select count(*)::int from public.document_requests
   where barangay_id = 'a0000000-0000-4000-8000-000000000001'),
  0, 'tenant B administration sees no tenant A request');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

select is(
  (select count(*)::int from public.document_requests), 0,
  'the platform administrator sees no tenant request data at all');

select is(
  (select count(*)::int from public.document_types), 0,
  'the platform administrator sees no tenant catalog either');

-- ════ 4 · Own-request catalog visibility ════════════════════════════════════
-- A request for a type the barangay later WITHDRAWS. Written on the owner
-- path, because the resident path (rightly) refuses an inactive type.

select pg_temp.as_system();

insert into public.document_requests
  (id, barangay_id, document_type_id, person_id, state, source_channel, purpose)
values
  ('f2000000-0000-4000-8000-0000000000aa', 'a0000000-0000-4000-8000-000000000001',
   'f0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000007',
   'draft', 'self', 'History against a withdrawn type (synthetic)');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');

select is(
  (select count(*)::int from public.document_types
   where id = 'f0000000-0000-4000-8000-000000000004'),
  1, 'the requester still reads the WITHDRAWN type behind their own request');

select ok(
  public.caller_has_request_for_type('f0000000-0000-4000-8000-000000000004'),
  'caller_has_request_for_type recognises their own history');

select ok(
  not public.caller_has_request_for_type('f0000000-0000-4000-8000-000000000002'),
  'and grants nothing for a type they never requested');

-- The widening is scoped: another member, with no such request, still cannot.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000013');

select is(
  (select count(*)::int from public.document_types
   where id = 'f0000000-0000-4000-8000-000000000004'),
  0, 'a member without that history still cannot see the withdrawn type');

-- ...and it never turns a NON-member into a catalog audience, which is the
-- property 13_document_catalog pins down. 00…10 owns request f2…02.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

select is(
  (select count(*)::int from public.document_types), 0,
  'owning a request does not make a non-member a catalog audience');

-- ════ 5 · The resident submission journey ═══════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');

select throws_ok(
  $$select public.submit_request(pg_temp.recall('fresh'))$$,
  'P0001', 'REQUIREMENTS_INCOMPLETE',
  'the resident cannot submit before answering the required questions');

select lives_ok(
  $$select public.set_request_answer(pg_temp.recall('fresh'),
      'f1000000-0000-4000-8000-000000000001', '12')$$,
  'the resident answers the numeric requirement');

select lives_ok(
  $$select public.set_request_answer(pg_temp.recall('fresh'),
      'f1000000-0000-4000-8000-000000000002', 'Employment')$$,
  'the resident answers the select requirement');

select lives_ok(
  $$select public.submit_request(pg_temp.recall('fresh'))$$,
  'a complete request submits');

select is(
  (select state::text from public.document_requests where id = pg_temp.recall('fresh')),
  'submitted', 'the request is now with the barangay');

select throws_ok(
  $$select public.submit_request(pg_temp.recall('fresh'))$$,
  'P0001', 'ILLEGAL_TRANSITION',
  'submitting the same request twice is refused');

select throws_ok(
  $$select public.set_request_answer(pg_temp.recall('fresh'),
      'f1000000-0000-4000-8000-000000000003', 'Late remark')$$,
  'P0001', 'REQUEST_NOT_EDITABLE',
  'answers freeze once the barangay has the request');

-- Another resident cannot drive someone else's request.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000013');

select throws_ok(
  $$select public.set_request_answer('f2000000-0000-4000-8000-000000000001',
      'f1000000-0000-4000-8000-000000000001', '5')$$,
  '42501', 'AUTHORIZATION_DENIED',
  'a resident cannot answer another resident''s draft');

select throws_ok(
  $$select public.submit_request('f2000000-0000-4000-8000-000000000001')$$,
  '42501', 'AUTHORIZATION_DENIED',
  'a resident cannot submit another resident''s draft');

-- ════ 6 · What the submission left behind ═══════════════════════════════════

select pg_temp.as_system();

select is(
  (select metadata->>'answer_count' from public.audit_events
   where action = 'request.submitted'
     and target_id = pg_temp.recall('fresh')::text),
  '2', 'the submission is audited with an answer COUNT, in the same transaction');

select is(
  (select count(*)::int from public.audit_events
   where target_id = pg_temp.recall('fresh')::text
     and metadata::text like '%Verified resident request%'),
  0, 'the purpose never reaches an audit payload');

select is(
  (select count(*)::int from public.outbox_events
   where payload->>'request_id' = pg_temp.recall('fresh')::text),
  0, 'submission enqueues NO intent — the requester''s own action needs none');

select * from finish();
rollback;
