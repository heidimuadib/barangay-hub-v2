-- ============================================================================
-- pgTAP · Slice 2A · Registry domain behaviour
--
-- The full lifecycle through the definer functions: creation rules,
-- transition legality, decision requirements, membership activation on
-- approval, outbox atomicity, evidence lifecycle, supersede-and-link with
-- every refusal case, and the audit trail of all of it.
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(52);

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

-- Temp TABLES are owned by postgres and invisible to the impersonated roles
-- below; temp FUNCTIONS are callable, so scratch values live in
-- transaction-local settings instead.
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

-- ════ Person creation rules ═════════════════════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

select pg_temp.remember('p2', public.create_walk_in_person(
  'a0000000-0000-4000-8000-000000000001', 'Pedro', 'Penduko (Test)', 'caretaker',
  'Walk-in fixture for domain tests (synthetic)'));

select isnt(pg_temp.recall('p2'), null,
  'an administrator creates a walk-in person through the domain function');

select pg_temp.as_system();
select is(
  (select count(*)::int from public.audit_events
   where action = 'person.created'
     and target_id = pg_temp.recall('p2')::text
     and metadata ->> 'source_channel' = 'staff'),
  1, 'walk-in creation is audited with its source channel');

select throws_ok(
  $$insert into public.persons
      (barangay_id, first_name, last_name, residency_basis_key, source_channel)
    values ('a0000000-0000-4000-8000-000000000001', 'No', 'Reason', 'renter', 'staff')$$,
  'P0001', 'CREATION_REASON_REQUIRED',
  'the staff channel demands a reason even on the owner path');

select throws_ok(
  $$insert into public.persons
      (barangay_id, first_name, last_name, residency_basis_key, source_channel)
    values ('a0000000-0000-4000-8000-000000000001', 'No', 'Explain', 'other', 'self')$$,
  'P0001', 'RESIDENCY_EXPLANATION_REQUIRED',
  'D2-01: "other" without an explanation is refused at the table');

insert into public.persons
  (id, barangay_id, first_name, last_name, residency_basis_key,
   residency_basis_explanation, source_channel)
values
  ('c0000000-0000-4000-8000-000000000099', 'a0000000-0000-4000-8000-000000000001',
   'Stray', 'Narrative (Test)', 'renter', 'this text must vanish', 'self');
select is(
  (select residency_basis_explanation from public.persons
   where id = 'c0000000-0000-4000-8000-000000000099'),
  null, 'D2-01: an explanation on a non-"other" basis is normalised away');

-- ════ Resubmission → review → approval (membership activation) ══════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000011');
select lives_ok(
  $$select public.resubmit_verification('d0000000-0000-4000-8000-000000000002')$$,
  'the applicant resubmits after an information request');

select pg_temp.as_system();
select is(
  (select state from public.verification_applications
   where id = 'd0000000-0000-4000-8000-000000000002'),
  'resubmitted'::public.verification_state, 'info_requested → resubmitted took effect');
select is(
  (select count(*)::int from public.audit_events
   where action = 'verification.state_changed'
     and target_id = 'd0000000-0000-4000-8000-000000000002'
     and metadata ->> 'to_state' = 'resubmitted'),
  1, 'the resubmission is audited with from/to states');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');
select lives_ok(
  $$select public.review_verification('d0000000-0000-4000-8000-000000000002')$$,
  'staff move a resubmitted application into review');
select pg_temp.as_system();
select is(
  (select state from public.verification_applications
   where id = 'd0000000-0000-4000-8000-000000000002'),
  'in_review'::public.verification_state, 'resubmitted → in_review took effect');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');
select throws_ok(
  $$select public.request_information('d0000000-0000-4000-8000-000000000002', '  ')$$,
  'P0001', 'NOTE_REQUIRED', 'an information request requires a note');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select lives_ok(
  $$select public.approve_verification('d0000000-0000-4000-8000-000000000002')$$,
  'the administrator approves the in-review application');

select pg_temp.as_system();
select is(
  (select m.status from public.memberships m
   where m.barangay_id = 'a0000000-0000-4000-8000-000000000001'
     and m.user_id = '00000000-0000-4000-8000-000000000011'),
  'active'::public.membership_status,
  'approval created an ACTIVE membership for the linked account in the same transaction');
select is(
  (select count(*)::int from public.membership_roles mr
   join public.memberships m on m.id = mr.membership_id
   where m.user_id = '00000000-0000-4000-8000-000000000011'
     and mr.role_key = 'resident'),
  1, 'approval attached the resident role');
select is(
  (select count(*)::int from public.outbox_events
   where event_type = 'verification.approved'
     and payload ->> 'application_id' = 'd0000000-0000-4000-8000-000000000002'),
  1, 'approval enqueued its notification intent atomically');
select is(
  (select count(*)::int from public.audit_events
   where action = 'outbox.enqueued'
     and metadata ->> 'event_type' = 'verification.approved'),
  2, 'every enqueue is audited (the seeded intent plus this approval)');

select throws_ok(
  $$update public.verification_applications set state = 'in_review'
    where id = 'd0000000-0000-4000-8000-000000000002'$$,
  'P0001', 'APPLICATION_FINAL',
  'terminal states are locked even on the owner path — a new application is the only way forward');

-- ════ Atomicity on failure: a refused decision enqueues nothing ═════════════

select pg_temp.as_system();
select set_config('app.test_outbox_n',
  (select count(*) from public.outbox_events)::text, true);

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.reject_verification(
      'd0000000-0000-4000-8000-000000000001', 'not in review yet')$$,
  'P0001', 'ILLEGAL_TRANSITION',
  'rejecting a merely-submitted application is refused');

select pg_temp.as_system();
select is(
  (select count(*)::int from public.outbox_events),
  current_setting('app.test_outbox_n')::int,
  'the refused decision enqueued NOTHING — outbox and state change share one transaction');

select throws_ok(
  $$update public.verification_applications set state = 'approved'
    where id = 'd0000000-0000-4000-8000-000000000001'$$,
  'P0001', 'ILLEGAL_TRANSITION',
  'submitted → approved (skipping review) is illegal even for the owner');

-- ════ Evidence lifecycle ════════════════════════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select * from public.add_evidence_metadata(
      'd0000000-0000-4000-8000-000000000001', 'supporting', 'image/png', 1024)$$,
  'P0001', 'APPLICATION_NOT_EDITABLE',
  'evidence cannot be added to a submitted application');

select pg_temp.remember('app2',
  public.create_verification_application(pg_temp.recall('p2')));
select isnt(pg_temp.recall('app2'), null,
  'staff open an application for the walk-in person');

select throws_ok(
  format($f$select public.submit_verification('%s')$f$,
         pg_temp.recall('app2')),
  'P0001', 'EVIDENCE_INCOMPLETE',
  'submission requires at least one identity AND one residency item');

select pg_temp.remember('ev_identity', (public.add_evidence_metadata(
  pg_temp.recall('app2'), 'identity', 'image/png', 2048)).evidence_id);
select matches(
  (select e.storage_path from public.verification_evidence e
   where e.id = pg_temp.recall('ev_identity')),
  '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$',
  'the storage path is opaque UUIDs only — tenant/application/evidence scoped, no PII (D2-03)');

select lives_ok(
  format($f$select public.add_evidence_metadata('%s', 'residency', 'application/pdf', 4096)$f$,
         pg_temp.recall('app2')),
  'a residency item is added');

select lives_ok(
  format($f$select public.remove_evidence('%s')$f$,
         pg_temp.recall('ev_identity')),
  'evidence can be removed while the application is editable');
select pg_temp.as_system();
select is(
  (select count(*)::int from public.audit_events
   where action = 'verification.evidence_removed'
     and target_id = pg_temp.recall('ev_identity')::text),
  1, 'the removal is audited');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select pg_temp.remember('ev_identity2', (public.add_evidence_metadata(
  pg_temp.recall('app2'), 'identity', 'image/jpeg', 2048)).evidence_id);
select lives_ok(
  format($f$select public.confirm_evidence_upload('%s',
    '4444444444444444444444444444444444444444444444444444444444444444', 2048)$f$,
    pg_temp.recall('ev_identity2')),
  'upload confirmation records the hash and size');
select throws_ok(
  format($f$select public.confirm_evidence_upload('%s',
    '5555555555555555555555555555555555555555555555555555555555555555', 2048)$f$,
    pg_temp.recall('ev_identity2')),
  'P0001', 'EVIDENCE_ALREADY_CONFIRMED', 'confirmation is one-shot');

select lives_ok(
  format($f$select public.submit_verification('%s')$f$,
         pg_temp.recall('app2')),
  'with both kinds present the application submits');
select pg_temp.as_system();
select is(
  (select count(*)::int from public.audit_events
   where action = 'verification.submitted'
     and target_id = pg_temp.recall('app2')::text),
  1, 'submission carries its own audit event');

-- ════ Rejection requires a reason; intent enqueued ══════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');
select lives_ok(
  format($f$select public.review_verification('%s')$f$,
         pg_temp.recall('app2')),
  'staff take the fresh application into review');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select throws_ok(
  format($f$select public.reject_verification('%s', '   ')$f$,
         pg_temp.recall('app2')),
  'P0001', 'REASON_REQUIRED', 'rejection without a reason is refused');
select lives_ok(
  format($f$select public.reject_verification('%s',
    'Insufficient synthetic evidence (test)')$f$,
    pg_temp.recall('app2')),
  'rejection with a reason succeeds');
select pg_temp.as_system();
select is(
  (select decision_reason from public.verification_applications
   where id = pg_temp.recall('app2')),
  'Insufficient synthetic evidence (test)', 'the reason is recorded');
select is(
  (select count(*)::int from public.outbox_events
   where event_type = 'verification.rejected'
     and payload ->> 'application_id' =
         pg_temp.recall('app2')::text),
  1, 'rejection enqueued its notification intent atomically');

-- ════ Supersede-and-link (D2-02) ════════════════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select lives_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000006',
      'c0000000-0000-4000-8000-000000000005',
      'Same synthetic person registered twice')$$,
  'the administrator resolves the duplicate pair by supersede-and-link');

select pg_temp.as_system();
select is(
  (select p.superseded_by from public.persons p
   where p.id = 'c0000000-0000-4000-8000-000000000006'),
  'c0000000-0000-4000-8000-000000000005'::uuid,
  'the losing record points at the survivor and is preserved');
select throws_ok(
  $$update public.persons set first_name = 'Changed'
    where id = 'c0000000-0000-4000-8000-000000000006'$$,
  'P0001', 'PERSON_FROZEN', 'a superseded person is frozen — history, not a working record');
select is(
  (select count(*)::int from public.audit_events
   where action = 'person.superseded'
     and target_id = 'c0000000-0000-4000-8000-000000000006'),
  1, 'the resolution is audited');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000006',
      'c0000000-0000-4000-8000-000000000004', 'again')$$,
  'P0001', 'SUPERSEDE_NOT_ELIGIBLE', 'an already-superseded person cannot lose twice');

select throws_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000005', 'blocked')$$,
  'P0001', 'SUPERSEDE_BLOCKED_BY_OPEN_APPLICATION',
  'a person with an undecided application cannot be superseded');

select throws_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000003',
      'c0000000-0000-4000-8000-000000000007', 'blocked')$$,
  'P0001', 'SUPERSEDE_BLOCKED_BY_TWO_ACCOUNTS',
  'two linked accounts refuse an automatic resolution — unlinking is a deliberate act');

-- Account MOVE rule: loser linked, survivor account-less.
select lives_ok(
  $$select public.supersede_person(
      'c0000000-0000-4000-8000-000000000003',
      'c0000000-0000-4000-8000-000000000004',
      'Synthetic duplicate; account moves to survivor')$$,
  'supersede moves the loser''s account to an account-less survivor under the explicit rule');

select pg_temp.as_system();
select is(
  (select pa.user_id from public.person_accounts pa
   where pa.person_id = 'c0000000-0000-4000-8000-000000000004'),
  '00000000-0000-4000-8000-000000000012'::uuid,
  'the survivor now holds the moved account link');
select is(
  (select count(*)::int from public.person_accounts
   where person_id = 'c0000000-0000-4000-8000-000000000003'),
  0, 'the frozen loser holds no link');
select is(
  (select count(*)::int from public.audit_events
   where action in ('person_account.unlinked', 'person_account.linked')
     and metadata ->> 'user_id' = '00000000-0000-4000-8000-000000000012'),
  3, 'the move is fully audited (seed link + unlink and relink)');

-- ════ Unlink requires a reason ══════════════════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.unlink_person_account(
      'c0000000-0000-4000-8000-000000000004', '')$$,
  'P0001', 'REASON_REQUIRED', 'unlinking demands a reason');
select lives_ok(
  $$select public.unlink_person_account(
      'c0000000-0000-4000-8000-000000000004',
      'Synthetic account detached for testing')$$,
  'unlinking with a reason succeeds');
select pg_temp.as_system();
select is(
  (select count(*)::int from public.audit_events
   where action = 'person_account.unlinked'
     and metadata ->> 'reason' = 'Synthetic account detached for testing'),
  1, 'the unlink reason lands in the audit metadata');

-- ════ Outbox rows accept dispatch bookkeeping only ══════════════════════════

select throws_ok(
  $$update public.outbox_events set payload = '{}'::jsonb where id = 1$$,
  'P0001', 'only dispatch bookkeeping may change on outbox_events',
  'outbox payloads are immutable even for the owner');
select throws_ok(
  'delete from public.outbox_events where id = 1',
  'P0001', 'outbox_events rows are not deletable',
  'outbox rows cannot be deleted ad hoc — retention is a Slice 8/9 policy');

select * from finish();

rollback;
