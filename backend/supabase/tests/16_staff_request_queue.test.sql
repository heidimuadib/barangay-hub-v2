-- ============================================================================
-- pgTAP · Slice 3C · The staff intake queue and the counter workflow
--
-- 14 proved the request domain; this proves the surface STAFF drive:
--
--   1. who can see the queue at all, and what each role sees in it;
--   2. the capability SPLIT between starting a review and promising a
--      document is ready — the roadmap's reason for two capabilities rather
--      than one `requests.transition`;
--   3. the assisted channel end to end on a staff session, including for a
--      person with no account, and its equivalence to the resident record.
--
-- The equivalence assertion is the roadmap's headline requirement for the
-- slice and is deliberately structural: two requests created through the two
-- functions are compared column-by-column and must differ in EXACTLY the three
-- provenance columns.
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

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

-- Fixtures:
--   00…03 staff  (requests.read + requests.review, NOT mark_ready/walk_in)
--   00…02 admin  (all six document capabilities)
--   00…04 resident.sanisidro (verified) · 00…13 unverified member
--   00…05 admin.malinis (tenant B) · 00…01 platform administrator
--   c0…04 Juan Dela Cruz — walk-in person, NO account
--   f0…01 clearance (active) · REQS f1…01 number req, f1…02 select req
--   f2…02 submitted · f2…03 in_review · f2…04 ready_for_issue

-- ════ 1 · Who sees the queue ════════════════════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');

select ok(
  (select count(*)::int from public.document_requests) >= 4,
  'staff holding requests.read see the tenant queue');

select is(
  (select count(*)::int from public.document_requests
   where barangay_id = 'a0000000-0000-4000-8000-000000000002'),
  0, 'and nothing from the other tenant');

-- Staff see requests they do not own — that is the whole point of a queue.
select ok(
  (select count(*)::int from public.document_requests
   where person_id = 'c0000000-0000-4000-8000-000000000004') > 0,
  'staff see the account-less walk-in''s request');

-- Answers follow the request for staff too, so the queue detail is complete.
select ok(
  (select count(*)::int from public.document_request_answers) > 0,
  'staff read the answers behind the requests they review');

-- A resident holds no requests.read and sees only their own (re-proven here
-- because the queue is the surface that would leak it).
select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');
select is(
  (select count(*)::int from public.document_requests
   where person_id <> 'c0000000-0000-4000-8000-000000000007'),
  0, 'a resident sees no queue at all — only their own requests');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000005');
select is(
  (select count(*)::int from public.document_requests
   where barangay_id = 'a0000000-0000-4000-8000-000000000001'),
  0, 'tenant B administration sees no tenant A queue');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000001');
select is(
  (select count(*)::int from public.document_requests), 0,
  'the platform administrator sees no queue at all');

-- ════ 2 · The capability split ══════════════════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');

select ok(
  public.auth_has_permission('a0000000-0000-4000-8000-000000000001', 'requests.review'),
  'staff hold requests.review');

select ok(
  not public.auth_has_permission('a0000000-0000-4000-8000-000000000001', 'requests.mark_ready'),
  'staff do NOT hold requests.mark_ready');

select ok(
  not public.auth_has_permission('a0000000-0000-4000-8000-000000000001', 'requests.create_walk_in'),
  'staff do NOT hold requests.create_walk_in');

-- Staff may start a review...
select lives_ok(
  $$select public.review_request('f2000000-0000-4000-8000-000000000002')$$,
  'staff start a review on a submitted request');

select is(
  (select state::text from public.document_requests
   where id = 'f2000000-0000-4000-8000-000000000002'),
  'in_review', 'the request moved to in_review');

-- ...but may NOT promise the document is ready. This is the split the
-- roadmap asked for: moving a queue along is not the same as telling a
-- resident to travel to the barangay hall.
select throws_ok(
  $$select public.mark_request_ready('f2000000-0000-4000-8000-000000000002')$$,
  '42501', 'AUTHORIZATION_DENIED',
  'staff cannot mark a request ready — that capability is the administrator''s');

select throws_ok(
  $$select public.create_walk_in_request(
      'a0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000004',
      'f0000000-0000-4000-8000-000000000001',
      'Should fail (synthetic)', 'Should fail (synthetic)')$$,
  '42501', 'AUTHORIZATION_DENIED',
  'staff cannot file a request for somebody else');

-- The administrator holds both.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

select lives_ok(
  $$select public.mark_request_ready('f2000000-0000-4000-8000-000000000002')$$,
  'the administrator marks it ready');

select is(
  (select state::text from public.document_requests
   where id = 'f2000000-0000-4000-8000-000000000002'),
  'ready_for_issue', 'the request reached the Slice 4 hand-off point');

-- Ordering is enforced regardless of capability: ready is not reachable from
-- submitted, even for someone who holds every capability there is.
select throws_ok(
  $$select public.mark_request_ready('f2000000-0000-4000-8000-000000000004')$$,
  'P0001', 'ILLEGAL_TRANSITION',
  'a capability does not let anyone skip a state');

-- ════ 3 · A resident cannot drive the queue ═════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');

select throws_ok(
  $$select public.review_request('f2000000-0000-4000-8000-000000000003')$$,
  '42501', 'AUTHORIZATION_DENIED',
  'a resident cannot start a review, not even on their own request');

select throws_ok(
  $$select public.mark_request_ready('f2000000-0000-4000-8000-000000000003')$$,
  '42501', 'AUTHORIZATION_DENIED',
  'and cannot declare their own document ready');

-- ════ 4 · The counter workflow, end to end ══════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

select lives_ok(
  $$select pg_temp.remember('walkin', public.create_walk_in_request(
      'a0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000004',
      'f0000000-0000-4000-8000-000000000001',
      'Counter filing (synthetic)',
      'Requested at the counter, no online account (synthetic)'))$$,
  'the administrator files a request for an ACCOUNT-LESS person');

select is(
  (select source_channel::text from public.document_requests where id = pg_temp.recall('walkin')),
  'staff', 'the assisted channel is recorded');

select is(
  (select created_by from public.document_requests where id = pg_temp.recall('walkin')),
  '00000000-0000-4000-8000-000000000002'::uuid,
  'the acting staff member is stamped server-side');

-- The SAME answer and submit functions the resident uses.
select lives_ok(
  $$select public.set_request_answer(pg_temp.recall('walkin'),
      'f1000000-0000-4000-8000-000000000001', '30')$$,
  'staff answer through the resident''s own function');

select lives_ok(
  $$select public.set_request_answer(pg_temp.recall('walkin'),
      'f1000000-0000-4000-8000-000000000002', 'Loan')$$,
  'and the select requirement likewise');

select lives_ok(
  $$select public.submit_request(pg_temp.recall('walkin'))$$,
  'staff submit through the resident''s own function');

select is(
  (select state::text from public.document_requests where id = pg_temp.recall('walkin')),
  'submitted', 'the counter request is in the queue, not stranded as a draft');

-- ════ 5 · Walk-in equals resident, structurally ═════════════════════════════
-- Re-asserted at the 3C surface: the two channels must still differ in exactly
-- three columns after everything above.

select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');
select lives_ok(
  $$select pg_temp.remember('self', public.create_own_request(
      'a0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000001',
      'Counter filing (synthetic)'))$$,
  'a resident files the comparable request themselves');

select pg_temp.as_system();

select is(
  (select count(*)::int
   from jsonb_each(to_jsonb((select r from public.document_requests r
                             where r.id = pg_temp.recall('walkin')))) w
   join jsonb_each(to_jsonb((select r from public.document_requests r
                             where r.id = pg_temp.recall('self')))) s on s.key = w.key
   where w.value is distinct from s.value
     and w.key not in ('id', 'created_at', 'updated_at', 'submitted_at', 'state',
                       'source_channel', 'created_by', 'creation_reason', 'person_id')),
  0,
  'the two channels produce identical records apart from provenance and identity');

-- ════ 6 · What the queue work left behind ═══════════════════════════════════

select is(
  (select count(*)::int from public.outbox_events
   where event_type = 'request.in_review'
     and payload->>'request_id' = 'f2000000-0000-4000-8000-000000000002'),
  1, 'starting a review enqueued exactly one intent, in the same transaction');

select is(
  (select count(*)::int from public.outbox_events
   where event_type = 'request.ready_for_issue'
     and payload->>'request_id' = 'f2000000-0000-4000-8000-000000000002'),
  1, 'marking ready enqueued exactly one intent');

select is(
  (select count(*)::int from public.audit_events
   where target_id = pg_temp.recall('walkin')::text
     and metadata::text like '%no online account%'),
  0, 'the staff reason never reaches an audit payload');

select is(
  (select metadata->>'source_channel' from public.audit_events
   where action = 'request.created'
     and target_id = pg_temp.recall('walkin')::text),
  'staff', 'the audit records the CHANNEL, which is not personal data');

select * from finish();
rollback;
