-- ============================================================================
-- pgTAP · Slice 2D · Verification queue, decisions, outbox and audit
--
-- 2A proved the state machine's legality in isolation. 2D adds the workflow
-- as it is actually driven: who may see the queue, who may move an
-- application through review, who may decide it, what the resident may do to
-- their own application, and what lands in the outbox and the audit trail
-- while all of that happens.
--
-- The capability split is the point (ADR-0006 §D2-04): barangay_staff holds
-- review + request_information but NOT approve/reject; barangay_administrator
-- holds everything. The 2D UI hides what a role cannot do — this file proves
-- the database refuses it regardless.
--
-- Personas (seeds 01 + 02): u1 platform · u2 admin A · u3 staff A ·
-- u5 admin B · u10 applicant (person c1, submitted) · u11 applicant
-- (person c2, info_requested) · u12 applicant (person c3, REJECTED —
-- terminal) · u4 resident (person c7, approved).
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(41);

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

/**
 * Outbox rows for one application, by event type.
 *
 * SECURITY DEFINER because NO client role holds any privilege on
 * outbox_events — that is the 2A design, asserted separately in
 * 06_registry_rls. The claim under test here is that the intent was
 * ENQUEUED, not who may read it, so the harness reads as the owner.
 */
create function pg_temp.intents(p_app uuid, p_type text) returns int
language sql stable security definer as $fn$
  select count(*)::int from public.outbox_events
  where event_type = p_type and payload ->> 'application_id' = p_app::text;
$fn$;

/** How many intents of a type carry a given payload key (same reasoning). */
create function pg_temp.intents_with_key(p_type text, p_key text) returns int
language sql stable security definer as $fn$
  select count(*)::int from public.outbox_events
  where event_type = p_type and payload ? p_key;
$fn$;

-- ════ Queue visibility by capability ════════════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');

select isnt(
  (select count(*)::int from public.verification_applications
   where barangay_id = 'a0000000-0000-4000-8000-000000000001'),
  0, 'staff hold verification.read and see their tenant''s queue');

select is(
  (select count(*)::int from public.verification_applications
   where barangay_id <> 'a0000000-0000-4000-8000-000000000001'),
  0, 'the queue is tenant-scoped: nothing from another barangay is visible');

-- Evidence is a SEPARATE capability (D2-04): the queue without the documents.
select is((select count(*)::int from public.verification_evidence), 0,
  'staff WITHOUT verification.evidence.read see no evidence metadata');

-- ════ Staff A (u3): may move review forward, may NOT decide ═════════════════

select lives_ok(
  $$select public.review_verification('d0000000-0000-4000-8000-000000000001')$$,
  'staff hold verification.review: submitted → in_review succeeds');

select is(
  (select state::text from public.verification_applications
   where id = 'd0000000-0000-4000-8000-000000000001'),
  'in_review', 'the application is now in review');

-- Idempotence is deliberately NOT silent: a second start is an illegal
-- transition, which is what stops two reviewers racing the same application.
select throws_ok(
  $$select public.review_verification('d0000000-0000-4000-8000-000000000001')$$,
  'P0001', null, 'starting review twice is refused as an illegal transition');

select throws_ok(
  $$select public.approve_verification('d0000000-0000-4000-8000-000000000001')$$,
  '42501', null,
  'staff CANNOT approve — the hidden button is not the control (D2-04)');

select throws_ok(
  $$select public.reject_verification(
      'd0000000-0000-4000-8000-000000000001', 'staff must not be able to')$$,
  '42501', null, 'staff CANNOT reject');

-- request_information IS a staff capability, and the note is mandatory.
select throws_ok(
  $$select public.request_information('d0000000-0000-4000-8000-000000000001', '   ')$$,
  'P0001', null, 'an information request without a note is refused');

select lives_ok(
  $$select public.request_information(
      'd0000000-0000-4000-8000-000000000001',
      'Please provide a clearer proof of residency (synthetic).')$$,
  'staff hold verification.request_information: in_review → info_requested');

select is(
  (select info_request_note from public.verification_applications
   where id = 'd0000000-0000-4000-8000-000000000001'),
  'Please provide a clearer proof of residency (synthetic).',
  'the note is carried back to the resident on the application row');

-- ── Outbox: the 2D intents are enqueued in the same transaction ────────────

select is(
  pg_temp.intents('d0000000-0000-4000-8000-000000000001', 'verification.info_requested'),
  1, 'the information request enqueued exactly one intent');

select is(
  pg_temp.intents_with_key('verification.info_requested', 'note'),
  0, 'the intent payload carries IDs only — never the note text');

-- ════ Resident (u10): may resubmit their OWN application ════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

select throws_ok(
  $$select public.approve_verification('d0000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'a resident cannot approve their own application');

select lives_ok(
  $$select public.resubmit_verification('d0000000-0000-4000-8000-000000000001')$$,
  'the owner may resubmit: info_requested → resubmitted');

select is(
  pg_temp.intents('d0000000-0000-4000-8000-000000000001', 'verification.resubmitted'),
  1, 'the resubmission enqueued exactly one intent');

-- A repeat call cannot double-enqueue: the state gate rejects it first.
select throws_ok(
  $$select public.resubmit_verification('d0000000-0000-4000-8000-000000000001')$$,
  'P0001', null, 'resubmitting twice is an illegal transition');

select is(
  pg_temp.intents('d0000000-0000-4000-8000-000000000001', 'verification.resubmitted'),
  1, 'and therefore enqueued NO duplicate intent');

-- Someone else's application is not theirs to move.
select throws_ok(
  $$select public.resubmit_verification('d0000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'a resident cannot resubmit ANOTHER resident''s application');

-- ════ Admin A (u2): decides ═════════════════════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

-- The committed machine routes a resubmission back through in_review; there
-- is no resubmitted → approved edge.
select throws_ok(
  $$select public.approve_verification('d0000000-0000-4000-8000-000000000001')$$,
  'P0001', null,
  'a resubmitted application must re-enter review before it can be decided');

select lives_ok(
  $$select public.review_verification('d0000000-0000-4000-8000-000000000001')$$,
  'resubmitted → in_review');

-- ── Membership activation on approval ──────────────────────────────────────

select is(
  (select count(*)::int from public.memberships
   where barangay_id = 'a0000000-0000-4000-8000-000000000001'
     and user_id = '00000000-0000-4000-8000-000000000010'),
  0, 'the applicant holds no membership before approval');

select lives_ok(
  $$select public.approve_verification('d0000000-0000-4000-8000-000000000001')$$,
  'an administrator holds verification.approve');

select is(
  (select status::text from public.memberships
   where barangay_id = 'a0000000-0000-4000-8000-000000000001'
     and user_id = '00000000-0000-4000-8000-000000000010'),
  'active', 'approval activated the linked account''s membership atomically');

select is(
  (select count(*)::int from public.membership_roles mr
   join public.memberships m on m.id = mr.membership_id
   where m.user_id = '00000000-0000-4000-8000-000000000010'
     and mr.role_key = 'resident'),
  1, 'and granted the resident role');

select is(
  pg_temp.intents('d0000000-0000-4000-8000-000000000001', 'verification.approved'),
  1, 'approval enqueued exactly one intent, in the same transaction');

-- ── Terminal states are locked ─────────────────────────────────────────────

select throws_ok(
  $$select public.review_verification('d0000000-0000-4000-8000-000000000001')$$,
  'P0001', null, 'an approved application cannot be reopened for review');

select throws_ok(
  $$select public.request_information(
      'd0000000-0000-4000-8000-000000000003', 'reopen the rejected one')$$,
  'P0001', null, 'a rejected application cannot be reopened either');

select throws_ok(
  $$update public.verification_applications
      set state = 'in_review'
      where id = 'd0000000-0000-4000-8000-000000000003'$$,
  '42501', null,
  'and a client cannot bypass the functions — there is no UPDATE grant at all');

-- ── Rejection requires a reason ────────────────────────────────────────────

-- The d2 fixture sits in info_requested, and info_requested has exactly ONE
-- legal exit: the owner resubmits. Staff cannot pull it back into review
-- directly — the resident's turn is structural, not a convention.
select throws_ok(
  $$select public.review_verification('d0000000-0000-4000-8000-000000000002')$$,
  'P0001', null,
  'staff cannot skip the resident''s turn: info_requested → in_review is illegal');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000011');
select lives_ok(
  $$select public.resubmit_verification('d0000000-0000-4000-8000-000000000002')$$,
  'its owner resubmits');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select lives_ok(
  $$select public.review_verification('d0000000-0000-4000-8000-000000000002')$$,
  'and it re-enters review');

select throws_ok(
  $$select public.reject_verification('d0000000-0000-4000-8000-000000000002', '  ')$$,
  'P0001', null, 'rejection without a reason is refused');

select lives_ok(
  $$select public.reject_verification(
      'd0000000-0000-4000-8000-000000000002',
      'Evidence does not establish residency (synthetic).')$$,
  'an administrator holds verification.reject');

select is(
  pg_temp.intents('d0000000-0000-4000-8000-000000000002', 'verification.rejected'),
  1, 'rejection enqueued exactly one intent');

-- ── Disabled membership refuses approval (no silent reactivation) ──────────
-- u7 is the seeded DISABLED member of tenant A. Give them a person and an
-- application, then prove approval refuses rather than quietly re-enabling.

select pg_temp.as_system();

with inserted as (
  insert into public.persons
    (barangay_id, first_name, last_name, residency_basis_key, source_channel,
     creation_reason)
  values ('a0000000-0000-4000-8000-000000000001', 'Disabled', 'Member (Test)',
          'renter', 'staff', 'Slice 2D disabled-membership fixture (synthetic)')
  returning id
)
select pg_temp.remember('p_disabled', (select id from inserted));

insert into public.person_accounts (person_id, barangay_id, user_id)
values (pg_temp.recall('p_disabled'), 'a0000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000007');

with inserted as (
  insert into public.verification_applications (barangay_id, person_id, state, submitted_at)
  values ('a0000000-0000-4000-8000-000000000001', pg_temp.recall('p_disabled'),
          'in_review', now())
  returning id
)
select pg_temp.remember('a_disabled', (select id from inserted));

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

select throws_ok(
  format($f$select public.approve_verification('%s')$f$, pg_temp.recall('a_disabled')),
  'P0001', null,
  'approval REFUSES when the membership was deliberately disabled — verification never silently reactivates it');

select pg_temp.as_system();
select is(
  (select status::text from public.memberships
   where barangay_id = 'a0000000-0000-4000-8000-000000000001'
     and user_id = '00000000-0000-4000-8000-000000000007'),
  'disabled', 'and the membership is still disabled afterwards');

select is(
  pg_temp.intents(pg_temp.recall('a_disabled'), 'verification.approved'),
  0, 'a refused decision enqueues NO intent — atomicity in both directions');

-- ── Audit: every transition recorded, presence flags but never the text ────

select is(
  (select count(*)::int from public.audit_events
   where action = 'verification.state_changed'
     and target_id = 'd0000000-0000-4000-8000-000000000001'
     and metadata ->> 'from_state' = 'in_review'
     and metadata ->> 'to_state' = 'approved'),
  1, 'the approval is audited with its from/to states');

select is(
  (select metadata ->> 'reason_present' from public.audit_events
   where action = 'verification.state_changed'
     and target_id = 'd0000000-0000-4000-8000-000000000002'
     and metadata ->> 'to_state' = 'rejected'),
  'true', 'the rejection audit records that a reason WAS given');

select is(
  (select count(*)::int from public.audit_events
   where action = 'verification.state_changed'
     and metadata::text like '%Evidence does not establish residency%'),
  0, 'but never the reason TEXT itself (Phase 6 §37.2)');

select pg_temp.as_system();
select * from finish();

rollback;
