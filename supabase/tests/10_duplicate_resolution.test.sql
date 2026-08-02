-- ============================================================================
-- pgTAP · Slice 2E · Duplicate review and supersede-link resolution
--
-- 07 proved supersede's happy path and the two-account refusal in the domain
-- suite. This file proves the FULL D2-02 refusal matrix the 2E surface
-- relies on: who may resolve, which pairs are refusable and why, what the
-- one explicit account rule does, what an open application blocks, that
-- cycles are structurally impossible, and that nothing — records, accounts,
-- applications — is ever lost.
--
-- Personas (seeds 01 + 02): u1 platform · u2 admin A · u3 staff A ·
-- u5 admin B · u8/u9 accounts with no person link · c5/c6 the Maria Santos
-- duplicate pair (same birthdate, accented variant) · c15 the tenant-B name
-- twin.
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

-- ════ Candidate detection: tenant-scoped signals ════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

select is(
  (select count(*)::int from public.duplicate_candidates(
     'a0000000-0000-4000-8000-000000000001', 'Maria', 'Santos (Test)',
     date '1988-08-08', 'c0000000-0000-4000-8000-000000000005')),
  1, 'the accented twin is the one candidate for Maria — never the tenant-B name twin');

select is(
  (select count(*)::int from public.duplicate_candidates(
     'a0000000-0000-4000-8000-000000000001', 'Zzzqqx', 'Wvvkjy')),
  0, 'a dissimilar name is below the 0.30 floor and produces no candidate');

select is(
  (select bool_and(same_birthdate) from public.duplicate_candidates(
     'a0000000-0000-4000-8000-000000000001', 'Maria', 'Santos (Test)',
     date '1988-08-08', 'c0000000-0000-4000-8000-000000000005')),
  true, 'the birthdate signal is carried separately from name similarity');

-- ════ Who may resolve ═══════════════════════════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');
select throws_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000006',
      'c0000000-0000-4000-8000-000000000005', 'staff must not resolve')$$,
  '42501', null, 'ordinary staff are refused — the hidden control is not the boundary');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000010');
select throws_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000006',
      'c0000000-0000-4000-8000-000000000005', 'residents may never resolve')$$,
  '42501', null, 'a resident is refused');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000001');
select throws_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000006',
      'c0000000-0000-4000-8000-000000000005', 'platform holds no tenant power')$$,
  '42501', null, 'a platform administrator is refused');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000005');
select throws_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000006',
      'c0000000-0000-4000-8000-000000000005', 'wrong tenant')$$,
  '42501', null,
  'a tenant-B administrator is refused a tenant-A pair — indistinguishable from not-found');

-- ════ Pair eligibility (admin A from here on) ═══════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

select throws_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000005',
      'c0000000-0000-4000-8000-000000000005', 'self pair')$$,
  'P0001', null, 'a record cannot supersede itself');

select throws_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000005',
      'c0000000-0000-4000-8000-000000000015', 'cross tenant survivor')$$,
  'P0001', null, 'a cross-tenant survivor is refused (and unrepresentable by FK)');

select throws_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000006',
      'c0000000-0000-4000-8000-000000000005', '')$$,
  'P0001', null, 'an empty reason is refused');

-- ── The one explicit account rule ──────────────────────────────────────────
-- Loser c6 gets an account; survivor c5 gets one too → refused. Remove the
-- survivor's → the loser's account moves, audited.

select pg_temp.as_system();
insert into public.person_accounts (person_id, barangay_id, user_id) values
  ('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000008'),
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000009');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000006',
      'c0000000-0000-4000-8000-000000000005', 'both linked')$$,
  'P0001', null,
  'two linked accounts refuse resolution — never an automatic choice (BR-REG-4)');

select pg_temp.as_system();
delete from public.person_accounts
  where person_id = 'c0000000-0000-4000-8000-000000000005';

-- Baseline row counts: resolution must lose nothing.
select set_config('app.test_persons_before',
  (select count(*)::text from public.persons), true);
select set_config('app.test_accounts_before',
  (select count(*)::text from public.person_accounts), true);
select set_config('app.test_apps_before',
  (select count(*)::text from public.verification_applications), true);

-- ════ The resolution itself ═════════════════════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

select lives_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000006',
      'c0000000-0000-4000-8000-000000000005',
      'Same person registered twice; accented variant (synthetic)')$$,
  'an administrator resolves the pair with an explicit survivor and reason');

select is(
  (select superseded_by from public.persons
   where id = 'c0000000-0000-4000-8000-000000000006'),
  'c0000000-0000-4000-8000-000000000005'::uuid,
  'the losing record points at the survivor');

select isnt(
  (select superseded_at from public.persons
   where id = 'c0000000-0000-4000-8000-000000000006'),
  null, 'and carries when it was superseded');

select is(
  (select superseded_reason from public.persons
   where id = 'c0000000-0000-4000-8000-000000000006'),
  'Same person registered twice; accented variant (synthetic)',
  'the reason is the accountability record on the superseded row');

select is(
  (select count(*)::int from public.persons
   where id in ('c0000000-0000-4000-8000-000000000005',
                'c0000000-0000-4000-8000-000000000006')),
  2, 'BOTH records still exist — nothing was deleted');

select is(
  (select user_id from public.person_accounts
   where person_id = 'c0000000-0000-4000-8000-000000000005'),
  '00000000-0000-4000-8000-000000000008'::uuid,
  'the loser''s account moved to the account-less survivor (the one explicit rule)');

select is(
  (select count(*)::int from public.person_accounts
   where person_id = 'c0000000-0000-4000-8000-000000000006'),
  0, 'and no link remains on the superseded record');

select throws_ok(
  $$update public.persons set first_name = 'Edited'
      where id = 'c0000000-0000-4000-8000-000000000006'$$,
  '42501', null,
  'clients cannot edit the frozen record — there is no UPDATE grant at all');

select is(
  (select count(*)::int from public.duplicate_candidates(
     'a0000000-0000-4000-8000-000000000001', 'Maria', 'Santos (Test)',
     date '1988-08-08', 'c0000000-0000-4000-8000-000000000005')),
  0, 'a superseded record is no longer offered as a candidate');

-- ── Chains, cycles, double-resolution ──────────────────────────────────────

select throws_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000005',
      'c0000000-0000-4000-8000-000000000006', 'reverse the pair')$$,
  'P0001', null,
  'a cycle is impossible: the would-be survivor is already superseded');

select throws_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000006',
      'c0000000-0000-4000-8000-000000000004', 'already superseded loser')$$,
  'P0001', null, 'an already-superseded record cannot lose again');

-- ════ Open applications fail closed on the LOSER ════════════════════════════
-- c1 (Applicant One) holds the seeded SUBMITTED application.

select throws_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000004', 'loser has live review')$$,
  'P0001', null,
  'an open application on the LOSER blocks resolution (BR-REG-3) — a live review never points at a frozen person');

select is(
  (select state::text from public.verification_applications
   where id = 'd0000000-0000-4000-8000-000000000001'),
  'submitted', 'and the application is untouched afterwards');

-- The committed rule deliberately permits an open application on the
-- SURVIVOR — their own review simply continues. Pin it so a future change is
-- a conversation, not an accident.
select lives_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000004',
      'c0000000-0000-4000-8000-000000000001',
      'Walk-in was the same person as the applicant (synthetic)')$$,
  'an open application on the SURVIVOR is permitted by the committed 2A rule');

select is(
  (select superseded_by from public.persons
   where id = 'c0000000-0000-4000-8000-000000000004'),
  'c0000000-0000-4000-8000-000000000001'::uuid,
  'the account-less walk-in superseded cleanly into the applicant');

-- ════ Nothing was lost, anywhere ════════════════════════════════════════════

select pg_temp.as_system();

select is(
  (select count(*)::text from public.persons),
  current_setting('app.test_persons_before', true),
  'person count is unchanged — supersede never deletes');

select is(
  (select count(*)::text from public.person_accounts),
  current_setting('app.test_accounts_before', true),
  'account-link count is unchanged — moved, never dropped');

select is(
  (select count(*)::text from public.verification_applications),
  current_setting('app.test_apps_before', true),
  'application count is unchanged — history stays attached');

select is(
  (select person_id from public.verification_applications
   where id = 'd0000000-0000-4000-8000-000000000003'),
  'c0000000-0000-4000-8000-000000000003'::uuid,
  'terminal application history remains attached to its original person');

-- ════ Audit: presence flags, never the narrative ════════════════════════════

select is(
  (select count(*)::int from public.audit_events
   where action = 'person.superseded'
     and target_id = 'c0000000-0000-4000-8000-000000000006'
     and metadata ->> 'survivor_id' = 'c0000000-0000-4000-8000-000000000005'
     and metadata ->> 'reason_present' = 'true'),
  1, 'person.superseded records the survivor id and that a reason was given');

select is(
  (select count(*)::int from public.audit_events
   where action = 'person.superseded'
     and metadata::text like '%accented variant%'),
  0, 'the reason TEXT never enters audit metadata');

select is(
  (select count(*)::int from public.audit_events
   where action = 'person.superseded'
     and (metadata::text ilike '%santos%' or metadata::text ilike '%maria%')),
  0, 'nor does any name (Phase 6 §37.2)');

select is(
  (select count(*)::int from public.audit_events
   where action = 'person_account.unlinked'
     and target_id = 'c0000000-0000-4000-8000-000000000006'
     and metadata ->> 'reason' = 'moved to surviving person on supersede'),
  1, 'the account move is audited on the unlink side');

-- Filtered to the MOVED account: the both-accounts fixture above also linked
-- (and audited) u9 onto c5 before being removed, which is itself proof the
-- fixture path was audited.
select is(
  (select count(*)::int from public.audit_events
   where action = 'person_account.linked'
     and target_id = 'c0000000-0000-4000-8000-000000000005'
     and metadata ->> 'user_id' = '00000000-0000-4000-8000-000000000008'),
  1, 'and on the relink side');

select pg_temp.as_system();
select * from finish();

rollback;
