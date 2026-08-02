-- ============================================================================
-- pgTAP · Slice 1 · Row-Level Security isolation matrix
--
-- Impersonates the seeded synthetic accounts and asserts the full
-- positive/negative access matrix: anon denial, tenant isolation, permission
-- boundaries, self-elevation prevention, revocation immediacy, audit
-- protection and fail-closed context resolution.
--
-- Fixture vocabulary (supabase/seed/01_slice1_identity_fixtures.sql):
--   tenant A = test-san-isidro (a0…01)   tenant B = test-malinis (a0…02)
--   u1 platform admin · u2 admin A · u3 staff A · u4 resident A ·
--   u5 admin B · u6 resident B · u7 disabled A · u8 invited A · u9 dual A+B
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(52);

-- ── Impersonation helpers (transaction-local) ───────────────────────────────

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

-- ════ Anonymous: no grant, no policy, no function ═══════════════════════════

select pg_temp.as_anon();

select throws_ok('select count(*) from public.barangays', '42501',
  null, 'anon cannot read barangays');
select throws_ok('select count(*) from public.memberships', '42501',
  null, 'anon cannot read memberships');
select throws_ok(
  $$insert into public.memberships (barangay_id, user_id)
    values ('a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004')$$,
  '42501', null, 'anon cannot insert a membership');
select throws_ok('select count(*) from public.audit_events', '42501',
  null, 'anon cannot read the audit trail');
select throws_ok(
  $$select public.auth_has_permission('a0000000-0000-4000-8000-000000000001', 'membership.read')$$,
  '42501', null, 'anon cannot even execute the authorization functions');

-- ════ Authenticated, but no membership anywhere ═════════════════════════════

select pg_temp.impersonate('ffffffff-ffff-4fff-8fff-ffffffffffff');

select is((select count(*)::int from public.barangays), 0,
  'membership-less user sees no barangay');
select is((select count(*)::int from public.memberships), 0,
  'membership-less user sees no membership');
select is((select count(*)::int from public.user_profiles), 0,
  'membership-less user sees no profile');
select is(
  public.auth_has_permission('a0000000-0000-4000-8000-000000000001', 'membership.read'),
  false, 'membership-less user resolves no permission');
select is(
  jsonb_array_length(public.auth_context() -> 'memberships'), 0,
  'auth_context returns an empty membership list, not an error');

-- ════ Resident of tenant A (u4): self-service only ══════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');

select is((select count(*)::int from public.barangays), 1,
  'resident sees exactly their own barangay');
select is((select count(*)::int from public.memberships), 1,
  'resident sees only their own membership, not the roster');
select is((select count(*)::int from public.user_profiles), 1,
  'resident sees only their own profile');
select is((select count(*)::int from public.audit_events), 0,
  'resident cannot read the audit trail');

update public.memberships set status = 'active'
  where id = 'b0000000-0000-4000-8000-000000000008';
select pg_temp.as_system();
select is(
  (select status from public.memberships where id = 'b0000000-0000-4000-8000-000000000008'),
  'invited'::public.membership_status,
  'resident''s attempt to activate another membership changed nothing');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000004');
select throws_ok(
  $$insert into public.membership_roles (membership_id, barangay_id, role_key)
    values ('b0000000-0000-4000-8000-000000000004',
            'a0000000-0000-4000-8000-000000000001', 'barangay_administrator')$$,
  '42501', null, 'resident cannot self-elevate to barangay administrator');

update public.user_profiles set display_name = 'Renamed Resident (Test)'
  where user_id = '00000000-0000-4000-8000-000000000004';
select is(
  (select display_name from public.user_profiles
   where user_id = '00000000-0000-4000-8000-000000000004'),
  'Renamed Resident (Test)',
  'resident CAN update their own display name');

select throws_ok(
  $$update public.user_profiles set user_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    where user_id = '00000000-0000-4000-8000-000000000004'$$,
  '42501', null, 'resident cannot touch any profile column beyond display_name');

select throws_ok(
  $$insert into public.platform_role_assignments (user_id, role_key)
    values ('00000000-0000-4000-8000-000000000004', 'platform_administrator')$$,
  '42501', null, 'resident cannot grant themselves platform authority');

-- ════ Staff of tenant A (u3): read the roster, change nothing ═══════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');

select is((select count(*)::int from public.memberships), 6,
  'staff sees the full tenant-A roster via membership.read');
select is((select count(*)::int from public.user_profiles), 6,
  'staff sees co-member profiles via membership.read');

update public.memberships set status = 'active'
  where id = 'b0000000-0000-4000-8000-000000000008';
select pg_temp.as_system();
select is(
  (select status from public.memberships where id = 'b0000000-0000-4000-8000-000000000008'),
  'invited'::public.membership_status,
  'staff''s attempt to change a membership status changed nothing');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');
select throws_ok(
  $$insert into public.membership_roles (membership_id, barangay_id, role_key)
    values ('b0000000-0000-4000-8000-000000000004',
            'a0000000-0000-4000-8000-000000000001', 'barangay_staff')$$,
  '42501', null, 'staff cannot assign roles');
select is((select count(*)::int from public.audit_events), 0,
  'staff cannot read the audit trail without audit.read');
select is(
  (select count(*)::int from public.memberships
   where barangay_id = 'a0000000-0000-4000-8000-000000000002'),
  0, 'staff of tenant A sees nothing of tenant B');

-- ════ Administrator of tenant A (u2): full in-tenant authority ══════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

update public.memberships set status = 'active'
  where id = 'b0000000-0000-4000-8000-000000000008';
select is(
  (select status from public.memberships where id = 'b0000000-0000-4000-8000-000000000008'),
  'active'::public.membership_status,
  'administrator CAN activate an invited membership');

-- "At least one" rather than "exactly one": the audit trail is append-only and
-- accumulates across runs of the e2e suite, so an exact count would assert the
-- database's history rather than this transaction's behaviour.
select cmp_ok(
  (select count(*)::int from public.audit_events
   where action = 'membership.status_changed'
     and target_id = 'b0000000-0000-4000-8000-000000000008'),
  '>=', 1, 'the activation wrote its audit entry in the same transaction');

select lives_ok(
  $$insert into public.membership_roles (membership_id, barangay_id, role_key)
    values ('b0000000-0000-4000-8000-000000000004',
            'a0000000-0000-4000-8000-000000000001', 'barangay_staff')$$,
  'administrator CAN assign a barangay-scoped role');

select pg_temp.as_system();
select is(
  (select granted_by from public.membership_roles
   where membership_id = 'b0000000-0000-4000-8000-000000000004'
     and role_key = 'barangay_staff'),
  '00000000-0000-4000-8000-000000000002'::uuid,
  'granted_by is stamped server-side from auth.uid(), not from input');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
delete from public.membership_roles
  where membership_id = 'b0000000-0000-4000-8000-000000000004'
    and role_key = 'barangay_staff';
select pg_temp.as_system();
select is(
  (select count(*)::int from public.membership_roles
   where membership_id = 'b0000000-0000-4000-8000-000000000004'),
  1, 'administrator CAN revoke a role (only the original resident role remains)');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$insert into public.membership_roles (membership_id, barangay_id, role_key)
    values ('b0000000-0000-4000-8000-000000000016',
            'a0000000-0000-4000-8000-000000000002', 'resident')$$,
  '42501', null, 'tenant-A administrator cannot assign roles in tenant B');
select throws_ok(
  $$insert into public.membership_roles (membership_id, barangay_id, role_key)
    values ('b0000000-0000-4000-8000-000000000016',
            'a0000000-0000-4000-8000-000000000001', 'barangay_staff')$$,
  '23503', null,
  'forging the tenant id fails STRUCTURALLY on the composite FK, beneath RLS');

select is(
  (select count(*)::int from public.audit_events
   where barangay_id = 'a0000000-0000-4000-8000-000000000002'),
  0, 'tenant-A administrator sees none of tenant B''s audit trail');

update public.memberships set status = 'disabled'
  where id = 'b0000000-0000-4000-8000-000000000016';
select pg_temp.as_system();
select is(
  (select status from public.memberships where id = 'b0000000-0000-4000-8000-000000000016'),
  'active'::public.membership_status,
  'tenant-A administrator''s write into tenant B changed nothing');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$update public.role_permissions set permission_key = 'role.assign'
    where role_key = 'barangay_staff'$$,
  '42501', null, 'no ordinary user can modify role-permission mappings');
select throws_ok('delete from public.audit_events', '42501',
  null, 'administrator cannot delete audit records');
select throws_ok(
  $$update public.audit_events set metadata = '{}'::jsonb$$, '42501',
  null, 'administrator cannot rewrite audit records');
select throws_ok(
  $$insert into public.platform_role_assignments (user_id, role_key)
    values ('00000000-0000-4000-8000-000000000002', 'platform_administrator')$$,
  '42501', null, 'barangay administrator cannot self-grant platform authority');

-- ════ Disabled membership (u7): revocation removes everything ═══════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000007');

select is((select count(*)::int from public.barangays), 0,
  'disabled member no longer sees the barangay');
select is(
  public.auth_is_active_member('a0000000-0000-4000-8000-000000000001'),
  false, 'disabled membership is not an active membership');

-- ════ Invited membership (u8): roles are inert until activation ═════════════

-- The administrator block above activated u8's membership to prove the
-- positive path; return it to 'invited' so this block tests the seeded state.
select pg_temp.as_system();
update public.memberships set status = 'invited'
  where id = 'b0000000-0000-4000-8000-000000000008';

select pg_temp.impersonate('00000000-0000-4000-8000-000000000008');

select is(
  public.auth_has_permission('a0000000-0000-4000-8000-000000000001', 'membership.read'),
  false, 'a staff role on an INVITED membership resolves no permission');
select is((select count(*)::int from public.memberships), 1,
  'an invited member can see their own pending membership');

-- ════ Platform administrator (u1): platform scope ONLY ══════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

select is((select count(*)::int from public.barangays), 2,
  'platform administrator lists tenant metadata');
select is((select count(*)::int from public.memberships), 0,
  'platform administrator sees NO tenant memberships (Phase 4 §16.4)');
select is((select count(*)::int from public.user_profiles), 1,
  'platform administrator sees no tenant member profiles — only their own');
select is(
  (select count(*)::int from public.audit_events where barangay_id is not null),
  0, 'platform administrator sees NO tenant audit events');
-- Platform scope also collects sessionless auth events (failed sign-ins,
-- sign-up attempts), so the property is visibility, not a fixed count.
select cmp_ok(
  (select count(*)::int from public.audit_events where barangay_id is null),
  '>=', 1, 'platform administrator sees platform-scope audit events');
select is(
  public.auth_has_permission('a0000000-0000-4000-8000-000000000001', 'membership.read'),
  false, 'platform authority resolves no barangay permission');

-- ════ Dual membership (u9) ══════════════════════════════════════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000009');

select is((select count(*)::int from public.barangays), 2,
  'dual member sees both of their barangays');
select is((select count(*)::int from public.memberships), 2,
  'dual member sees both memberships and nothing else');

-- ════ Revocation takes effect immediately ═══════════════════════════════════

select pg_temp.as_system();
delete from public.membership_roles
  where membership_id = 'b0000000-0000-4000-8000-000000000003'
    and role_key = 'barangay_staff';

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');
select is(
  public.auth_has_permission('a0000000-0000-4000-8000-000000000001', 'membership.read'),
  false, 'a revoked role stops resolving on the very next statement');

-- ════ Fail closed: session without a subject ════════════════════════════════

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select set_config('role', 'authenticated', true);
select is(
  (public.auth_context() ->> 'userId') is null,
  true, 'a session with no subject resolves to an empty context, never to access');

select pg_temp.as_system();
select * from finish();

rollback;
