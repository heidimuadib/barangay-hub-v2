-- ============================================================================
-- pgTAP · Slice 2G · Outbox review and slice-wide invariants
--
-- 2A–2F each proved their own behaviour. This file asks the questions that
-- only make sense once the whole slice exists:
--
--   • is the outbox still SILENT to every client role, not just anon?
--   • did any subpart invent an intent the roadmap never approved?
--   • does any payload carry a personal value — a name, an address, a
--     birthdate, an object path, a signed URL, a free-text reason?
--   • is delivery still absent (it belongs to Slice 8)?
--   • do the slice-wide structural rules hold across ALL six tables at once?
--
-- The deliberate ABSENCES are asserted too. `verification.submitted` has no
-- intent: it is the resident's own action, confirmed on screen, and the
-- roadmap assigns intents to decisions and to states that require someone
-- else to act. Recording that as a test stops a future session "fixing" it by
-- inventing a notification nobody approved.
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

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

-- ════ The outbox is silent to EVERY client role ═════════════════════════════
-- 05 proves the grant surface is empty and 06 covers anon and platform. These
-- close the matrix: a tenant administrator is the most privileged client that
-- exists, and even they cannot read a notification intent.

select pg_temp.as_anon();
select throws_ok('select count(*) from public.outbox_events', '42501',
  null, 'anon cannot read the outbox');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000010');
select throws_ok('select count(*) from public.outbox_events', '42501',
  null, 'a resident cannot read the outbox');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');
select throws_ok('select count(*) from public.outbox_events', '42501',
  null, 'staff cannot read the outbox');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select throws_ok('select count(*) from public.outbox_events', '42501',
  null, 'a barangay administrator cannot read the outbox either');

select throws_ok(
  $$select public.enqueue_outbox(
      'a0000000-0000-4000-8000-000000000001', 'verification.approved', '{}'::jsonb)$$,
  '42501', null,
  'no client may enqueue directly — an intent can only be a side effect of a real mutation');

-- ════ Generate the full intent set from real mutations ══════════════════════
-- Drive each of the four approved paths so the payload assertions below run
-- against rows the DOMAIN produced, not fixtures written for the test.

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');
select lives_ok(
  $$select public.review_verification('d0000000-0000-4000-8000-000000000001')$$,
  'staff take the submitted application into review');
select lives_ok(
  $$select public.request_information('d0000000-0000-4000-8000-000000000001',
      'Please add a clearer proof of residency (synthetic).')$$,
  'staff request more information');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000010');
select lives_ok(
  $$select public.resubmit_verification('d0000000-0000-4000-8000-000000000001')$$,
  'the resident resubmits');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select lives_ok(
  $$select public.review_verification('d0000000-0000-4000-8000-000000000001')$$,
  'the administrator re-opens review');
select lives_ok(
  $$select public.approve_verification('d0000000-0000-4000-8000-000000000001')$$,
  'and approves');

-- The seeded info_requested application gives us a rejection too.
select pg_temp.impersonate('00000000-0000-4000-8000-000000000011');
select lives_ok(
  $$select public.resubmit_verification('d0000000-0000-4000-8000-000000000002')$$,
  'the second applicant resubmits');
select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select lives_ok(
  $$select public.review_verification('d0000000-0000-4000-8000-000000000002')$$,
  'it re-enters review');
select lives_ok(
  $$select public.reject_verification('d0000000-0000-4000-8000-000000000002',
      'Evidence does not establish residency (synthetic).')$$,
  'and is rejected');

-- ════ The intent inventory ══════════════════════════════════════════════════

select pg_temp.as_system();

select is(
  (select array_agg(distinct event_type order by event_type)
   from public.outbox_events),
  array['verification.approved', 'verification.info_requested',
        'verification.rejected', 'verification.resubmitted'],
  'exactly the four approved intents exist — no subpart invented a notification');

-- The deliberate absences, asserted so they stay deliberate.
select is(
  (select count(*)::int from public.outbox_events
   where event_type = 'verification.submitted'),
  0,
  'submission enqueues NO intent: the resident''s own action, already confirmed on screen');

select is(
  (select count(*)::int from public.outbox_events
   where event_type like 'person%' or event_type like '%evidence%'
      or event_type like '%duplicate%' or event_type like '%supersede%'),
  0,
  'registry, evidence and duplicate-resolution events enqueue nothing — internal records, not resident news');

-- ════ Payload hygiene, as a property of EVERY row ═══════════════════════════

select is(
  (select count(*)::int from public.outbox_events o
   where exists (
     select 1 from jsonb_object_keys(o.payload) k
     where k not in ('application_id', 'person_id'))),
  0, 'every payload carries ONLY application_id and person_id — nothing else');

select is(
  (select count(*)::int from public.outbox_events o, public.persons p
   where o.payload::text ilike '%' || p.first_name || '%'
      or o.payload::text ilike '%' || p.last_name || '%'),
  0, 'no payload contains any registered person''s name');

select is(
  (select count(*)::int from public.outbox_events o
   where o.payload::text ~* '(19|20)[0-9]{2}-[0-9]{2}-[0-9]{2}'),
  0, 'no payload contains a date — birthdates never travel in an intent');

select is(
  (select count(*)::int from public.outbox_events o, public.verification_evidence e
   where o.payload::text like '%' || e.storage_path || '%'),
  0, 'no payload contains an evidence object path');

select is(
  (select count(*)::int from public.outbox_events
   where payload::text ~* '(token=|/storage/v1/|http)'),
  0, 'no payload contains a signed URL or any URL at all');

select is(
  (select count(*)::int from public.outbox_events
   where payload::text ilike '%residency (synthetic)%'
      or payload::text ilike '%clearer proof%'),
  0, 'no payload contains the staff-authored note or decision reason');

select is(
  (select count(*)::int from public.outbox_events where barangay_id is null),
  0, 'every intent is explicitly tenant-scoped by column, not by payload');

-- ════ Delivery does not exist yet (Slice 8) ═════════════════════════════════

select is(
  (select count(*)::int from public.outbox_events where dispatch_status <> 'pending'),
  0, 'nothing has been dispatched — there is no worker, by design');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (p.proname like '%dispatch%' or p.proname like '%deliver%'
          or p.proname like '%send_%')),
  0, 'no dispatcher or delivery function exists in the database (Slice 8 owns it)');

-- ════ Slice-wide structural invariants ══════════════════════════════════════

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('persons', 'person_accounts', 'verification_applications',
                       'verification_evidence', 'outbox_events', 'residency_bases')
     and not (c.relrowsecurity and c.relforcerowsecurity)),
  0, 'RLS is ENABLED and FORCED on all six Slice 2 tables — owner paths included');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%'),
  0, 'every SECURITY DEFINER function pins its search_path');

select pg_temp.as_system();
select * from finish();

rollback;
