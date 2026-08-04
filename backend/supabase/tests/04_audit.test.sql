-- ============================================================================
-- pgTAP · Slice 1 · Audit trail behaviour
--
-- Append-only under every role including the owner; same-transaction capture
-- via triggers; tamper-evidence hashing; metadata hygiene (names and keys,
-- never personal values); the invite RPC's audit and anti-enumeration
-- behaviour.
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

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

-- ── Append-only, even for the owner ─────────────────────────────────────────

select throws_ok(
  $$update public.audit_events set metadata = '{}'::jsonb where id = 1$$,
  'P0001', 'audit_events is append-only',
  'not even the system path may rewrite an audit record');

select throws_ok(
  'delete from public.audit_events where id = 1',
  'P0001', 'audit_events is append-only',
  'not even the system path may delete an audit record');

-- ── Seed-time capture ───────────────────────────────────────────────────────

-- Derived rather than pinned to a literal. The property is that EVERY seeded
-- membership produced an audit row, and the two counts come from independent
-- sources — the seed's inserts and the trigger's writes. A hard-coded number
-- restated that property as a fixture census, and broke whenever a slice added
-- a persona (it did, when 3B added the active-but-unverified member).
-- Runs on the system path, so neither side is RLS-filtered.
select is(
  (select count(*)::int from public.audit_events where action = 'membership.created'),
  (select count(*)::int from public.memberships),
  'every seeded membership was captured by the audit trigger');

-- ── Same-transaction capture on the system path ─────────────────────────────

update public.memberships set status = 'disabled'
  where id = 'b0000000-0000-4000-8000-000000000016';
select is(
  (select count(*)::int from public.audit_events
   where action = 'membership.status_changed'
     and target_id = 'b0000000-0000-4000-8000-000000000016'),
  1, 'a status change is audited in the same transaction regardless of code path');

-- ── Tamper-evidence hash (DB-ADR-08) ────────────────────────────────────────

select is(
  (select bool_and(metadata_hash = encode(extensions.digest(metadata::text, 'sha256'), 'hex'))
   from public.audit_events),
  true, 'every metadata_hash matches its payload digest');

-- ── Actor is derived, action format is constrained ──────────────────────────

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select lives_ok(
  $$select public.append_audit_entry(
      'test.event', 'membership', null,
      'a0000000-0000-4000-8000-000000000001'::uuid, '{"k":"v"}'::jsonb)$$,
  'an authenticated caller can append through the function');

select pg_temp.as_system();
select is(
  (select actor_user_id from public.audit_events where action = 'test.event'),
  '00000000-0000-4000-8000-000000000002'::uuid,
  'the actor is auth.uid(), never a caller-supplied value');

select throws_ok(
  $$select public.append_audit_entry('Not A Valid Action', 'membership')$$,
  '23514', null, 'malformed action names are rejected by constraint');

-- ── Metadata hygiene: names and keys, never personal values ─────────────────

select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');
update public.user_profiles set display_name = 'Audit Hygiene Check (Test)'
  where user_id = '00000000-0000-4000-8000-000000000004';

select pg_temp.as_system();
select is(
  (select metadata -> 'fields'
   from public.audit_events
   where action = 'profile.updated'
     and target_id = '00000000-0000-4000-8000-000000000004'
   order by id desc limit 1),
  '["display_name"]'::jsonb,
  'profile audit records WHICH fields changed');
select is(
  (select count(*)::int from public.audit_events
   where metadata::text like '%Audit Hygiene Check%'),
  0, 'profile audit records no personal VALUES');

-- ── Invite RPC: success path ────────────────────────────────────────────────

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

select isnt(
  public.create_membership_by_email(
    'a0000000-0000-4000-8000-000000000001', 'resident.malinis@barangay-hub.test'),
  null, 'administrator invites an existing account and receives the membership id');

select pg_temp.as_system();
select is(
  (select status from public.memberships
   where barangay_id = 'a0000000-0000-4000-8000-000000000001'
     and user_id = '00000000-0000-4000-8000-000000000006'),
  'invited'::public.membership_status,
  'the invited membership starts in the invited state');
select is(
  (select count(*)::int from public.audit_events
   where action = 'membership.invite' and outcome = 'success'
     and metadata ? 'email_hash'),
  1, 'the successful invite is audited with an email digest');
select is(
  (select count(*)::int from public.audit_events
   where action = 'membership.invite' and metadata::text like '%@%'),
  0, 'no raw email address enters the audit trail');

-- ── Invite RPC: uniform ineligibility, hard authorization failure ───────────

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

select throws_ok(
  $$select public.create_membership_by_email(
      'a0000000-0000-4000-8000-000000000001', 'nobody@barangay-hub.test')$$,
  'P0001', 'INVITE_NOT_ELIGIBLE',
  'an unknown email fails with the uniform message');

select throws_ok(
  $$select public.create_membership_by_email(
      'a0000000-0000-4000-8000-000000000001', 'staff.sanisidro@barangay-hub.test')$$,
  'P0001', 'INVITE_NOT_ELIGIBLE',
  'an existing member fails with the SAME message — no account enumeration');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');
select throws_ok(
  $$select public.create_membership_by_email(
      'a0000000-0000-4000-8000-000000000001', 'resident.malinis@barangay-hub.test')$$,
  '42501', 'AUTHORIZATION_DENIED',
  'membership.manage is required to invite');

select pg_temp.as_system();
select * from finish();

rollback;
