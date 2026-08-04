-- ============================================================================
-- pgTAP · Slice 3A · Request intake domain behaviour
--
-- The full lifecycle through the definer functions: both creation channels and
-- their EQUIVALENCE, the completeness gate, transition legality at the
-- function and at the table, capability separation, tenant isolation, answer
-- typing, audit content, and outbox atomicity.
--
-- The roadmap's headline requirement for this slice is that the walk-in and
-- resident paths are the same domain service (Slice 3 §3/§17). That is not
-- provable by inspection, so it is asserted here field-by-field: two requests
-- created through different functions must differ in EXACTLY the three
-- provenance columns and nothing else.
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(45);

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
--   BARANGAY A a0…01 San Isidro          BARANGAY B a0…02 Malinis
--   TYPE       f0…01 clearance (active)  f0…04 retired (INACTIVE)
--   REQUIREMENTS f1…01 years (number, required), f1…02 intended_use
--                (select, required), f1…03 remarks (textarea, optional)
--   PERSON     c0…07 resident w/ account 00…04 · c0…04 walk-in, NO account
--   REQUEST    f2…02 submitted · f2…03 in_review · f2…04 ready_for_issue

-- ════ Resident creation and the completeness gate ═══════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');

select lives_ok(
  $$select pg_temp.remember('own', public.create_own_request(
      'a0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000001',
      'Employment requirement (synthetic)'))$$,
  'a resident creates their own request');

select is(
  (select state::text from public.document_requests where id = pg_temp.recall('own')),
  'draft', 'it starts as a draft — nothing reaches the queue on creation');

select is(
  (select source_channel::text from public.document_requests where id = pg_temp.recall('own')),
  'self', 'the self channel is recorded');

select is(
  (select created_by from public.document_requests where id = pg_temp.recall('own')),
  '00000000-0000-4000-8000-000000000004'::uuid,
  'the actor is stamped server-side, not supplied by the caller');

select is(
  (select creation_reason from public.document_requests where id = pg_temp.recall('own')),
  null, 'the self channel carries no creation reason');

-- An inactive type is not requestable, and says so the same way a
-- non-existent one does.
select throws_ok(
  $$select public.create_own_request(
      'a0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000004',
      'Should fail (synthetic)')$$,
  'P0001', 'DOCUMENT_TYPE_NOT_AVAILABLE',
  'a resident cannot request an INACTIVE document type');

select throws_ok(
  $$select public.create_own_request(
      'a0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      'Should fail (synthetic)')$$,
  'P0001', 'DOCUMENT_TYPE_NOT_AVAILABLE',
  'a resident cannot request another tenant''s document type');

-- Submission refuses until every REQUIRED requirement is answered.
select throws_ok(
  $$select public.submit_request(pg_temp.recall('own'))$$,
  'P0001', 'REQUIREMENTS_INCOMPLETE',
  'submission is refused while a required answer is missing');

select lives_ok(
  $$select public.set_request_answer(pg_temp.recall('own'),
      'f1000000-0000-4000-8000-000000000001', '7')$$,
  'the resident answers the numeric requirement');

select throws_ok(
  $$select public.submit_request(pg_temp.recall('own'))$$,
  'P0001', 'REQUIREMENTS_INCOMPLETE',
  'one of two required answers is still not enough');

select lives_ok(
  $$select public.set_request_answer(pg_temp.recall('own'),
      'f1000000-0000-4000-8000-000000000002', 'Employment')$$,
  'the resident answers the select requirement');

-- The optional one is genuinely optional.
select lives_ok(
  $$select public.submit_request(pg_temp.recall('own'))$$,
  'submission succeeds once every REQUIRED answer exists — the optional one is not demanded');

select is(
  (select state::text from public.document_requests where id = pg_temp.recall('own')),
  'submitted', 'the request is submitted');

select isnt(
  (select submitted_at from public.document_requests where id = pg_temp.recall('own')),
  null, 'the submission timestamp is set, so the queue can order itself');

-- ════ Answer typing ═════════════════════════════════════════════════════════

select lives_ok(
  $$select pg_temp.remember('typed', public.create_own_request(
      'a0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000001',
      'Answer typing fixture (synthetic)'))$$,
  'a second draft, for answer-typing checks');

select throws_ok(
  $$select public.set_request_answer(pg_temp.recall('typed'),
      'f1000000-0000-4000-8000-000000000001', 'seven')$$,
  'ANSWER_NOT_A_NUMBER',
  'a numeric requirement refuses prose');

select throws_ok(
  $$select public.set_request_answer(pg_temp.recall('typed'),
      'f1000000-0000-4000-8000-000000000002', 'Astrology')$$,
  'ANSWER_NOT_AN_OPTION',
  'a select requirement refuses a value outside its choices');

select throws_ok(
  $$select public.set_request_answer(pg_temp.recall('typed'),
      'f1000000-0000-4000-8000-000000000004', 'x')$$,
  'P0001', 'REQUIREMENT_NOT_APPLICABLE',
  'a requirement belonging to a DIFFERENT document type is refused');

-- Answers are replaceable while drafting, not duplicated.
select lives_ok(
  $$select public.set_request_answer(pg_temp.recall('typed'),
      'f1000000-0000-4000-8000-000000000001', '3')$$,
  'an answer may be given');
select lives_ok(
  $$select public.set_request_answer(pg_temp.recall('typed'),
      'f1000000-0000-4000-8000-000000000001', '4')$$,
  'and replaced');
select is(
  (select count(*)::int from public.document_request_answers
   where request_id = pg_temp.recall('typed')),
  1, 'replacing an answer updates it rather than accumulating duplicates');

-- ════ Editing stops at submission ═══════════════════════════════════════════

select throws_ok(
  $$select public.set_request_answer(pg_temp.recall('own'),
      'f1000000-0000-4000-8000-000000000003', 'Late remark')$$,
  'P0001', 'REQUEST_NOT_EDITABLE',
  'answers cannot be changed after submission — staff review a fixed record');

select throws_ok(
  $$select public.submit_request(pg_temp.recall('own'))$$,
  'P0001', 'ILLEGAL_TRANSITION',
  'a submitted request cannot be submitted again');

-- ════ Residents hold no staff power ═════════════════════════════════════════

select throws_ok(
  $$select public.review_request(pg_temp.recall('own'))$$,
  '42501', null,
  'a resident cannot take their own request into review');

select throws_ok(
  $$select public.create_walk_in_request(
      'a0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000004',
      'f0000000-0000-4000-8000-000000000001',
      'Nope (synthetic)', 'Nope (synthetic)')$$,
  '42501', null,
  'a resident cannot file a request on someone else''s behalf');

-- ════ Staff-assisted creation, and its EQUIVALENCE to the resident path ═════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

select lives_ok(
  $$select pg_temp.remember('walkin', public.create_walk_in_request(
      'a0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000004',
      'f0000000-0000-4000-8000-000000000001',
      'Employment requirement (synthetic)',
      'Walk-in taken at the counter (synthetic)'))$$,
  'an administrator files a request for an ACCOUNT-LESS walk-in person');

select is(
  (select source_channel::text from public.document_requests where id = pg_temp.recall('walkin')),
  'staff', 'the assisted channel is recorded');

select is(
  (select creation_reason is not null from public.document_requests
   where id = pg_temp.recall('walkin')),
  true, 'the assisted channel must say why');

-- THE roadmap requirement, asserted rather than asserted-in-prose: the two
-- records differ in exactly the provenance columns and nowhere else.
select is(
  (select array_agg(key order by key)
   from jsonb_each(
     (select to_jsonb(r) - 'id' - 'person_id' - 'created_at' - 'updated_at'
             - 'submitted_at' - 'review_started_at' - 'ready_at' - 'state'
      from public.document_requests r where r.id = pg_temp.recall('own'))) a(key, value)
   where value is distinct from (
     select (to_jsonb(r2) - 'id' - 'person_id' - 'created_at' - 'updated_at'
             - 'submitted_at' - 'review_started_at' - 'ready_at' - 'state') -> a.key
     from public.document_requests r2 where r2.id = pg_temp.recall('walkin'))),
  array['created_by', 'creation_reason', 'source_channel'],
  'resident and walk-in requests differ in EXACTLY the three provenance columns — same domain record otherwise');

select throws_ok(
  $$select public.create_walk_in_request(
      'a0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000015',
      'f0000000-0000-4000-8000-000000000001',
      'Cross-tenant (synthetic)', 'Cross-tenant (synthetic)')$$,
  'P0001', 'PERSON_NOT_AVAILABLE',
  'staff cannot file a request for a person in ANOTHER tenant');

-- ════ Transitions and capability separation ═════════════════════════════════

-- Staff hold requests.review but NOT requests.mark_ready.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');

select throws_ok(
  $$select public.mark_request_ready('f2000000-0000-4000-8000-000000000003')$$,
  '42501', null,
  'staff cannot declare a request ready — that needs requests.mark_ready');

select lives_ok(
  $$select public.review_request(pg_temp.recall('own'))$$,
  'staff take the submitted request into review');

select throws_ok(
  $$select public.review_request(pg_temp.recall('own'))$$,
  'P0001', 'ILLEGAL_TRANSITION',
  'a second review of the same request is refused — no duplicate intent is reachable');

-- draft → in_review is not a legal shortcut.
select throws_ok(
  $$select public.review_request(pg_temp.recall('typed'))$$,
  'P0001', 'ILLEGAL_TRANSITION',
  'a DRAFT cannot jump straight into review');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select lives_ok(
  $$select public.mark_request_ready(pg_temp.recall('own'))$$,
  'the administrator declares it ready for issue');

select is(
  (select state::text from public.document_requests where id = pg_temp.recall('own')),
  'ready_for_issue', 'the Slice 3 terminus is reached');

-- The table itself refuses an illegal jump, even on the owner path.
select pg_temp.as_system();
select throws_ok(
  format($$update public.document_requests set state = 'submitted' where id = %L$$,
         pg_temp.recall('own')),
  'ILLEGAL_TRANSITION',
  'the TABLE refuses a backwards transition even for the owner — the trigger is the authority');

select throws_ok(
  format($$update public.document_requests set state = 'ready_for_issue',
                 ready_at = now() where id = %L$$, pg_temp.recall('typed')),
  'ILLEGAL_TRANSITION',
  'draft → ready_for_issue is refused at the table');

-- ════ Audit content ═════════════════════════════════════════════════════════

select is(
  (select count(*)::int from public.audit_events
   where target_id = pg_temp.recall('own')::text
     and action in ('request.created', 'request.submitted', 'request.state_changed')),
  4, 'created + submitted + two state changes are all audited');

select is(
  (select metadata ->> 'source_channel' from public.audit_events
   where target_id = pg_temp.recall('own')::text and action = 'request.created'),
  'self', 'the creation audit records the channel');

-- The purpose is personal free text and must never reach the audit trail.
select is(
  (select count(*)::int from public.audit_events
   where target_type = 'document_request'
     and metadata::text ilike '%requirement (synthetic)%'),
  0, 'no audit row contains the request purpose');

select is(
  (select count(*)::int from public.audit_events a
   join public.document_request_answers ans
     on a.metadata::text like '%' || ans.value || '%'
   where a.target_type = 'document_request' and length(ans.value) > 3),
  0, 'no audit row contains an answer value');

-- ════ Outbox atomicity ═════════════════════════════════════════════════════

select is(
  (select count(*)::int from public.outbox_events
   where payload ->> 'request_id' = pg_temp.recall('own')::text),
  2, 'exactly two intents were enqueued for this request: in_review and ready_for_issue');

select is(
  (select count(*)::int from public.outbox_events
   where payload ->> 'request_id' = pg_temp.recall('own')::text
     and event_type = 'request.submitted'),
  0, 'submission enqueued NO intent — the requester''s own action');

-- A refused transition leaves nothing behind.
select is(
  (select count(*)::int from public.outbox_events
   where payload ->> 'request_id' = pg_temp.recall('typed')::text),
  0, 'the request whose transitions were all REFUSED produced no intent at all');

select * from finish();

rollback;
