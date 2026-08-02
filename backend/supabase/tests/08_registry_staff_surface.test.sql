-- ============================================================================
-- pgTAP · Slice 2C · Staff registry and walk-in creation surface
--
-- The 2C user interface hides the "Add a walk-in resident" affordance from
-- barangay_staff and shows it to barangay_administrator. That is convenience
-- only: this file proves the DATABASE enforces the same split, so the screen
-- can never be the thing keeping a walk-in from being created.
--
-- Also pins the audit-metadata hygiene of the walk-in path — the record's
-- provenance is audited, the resident's NAME is not.
--
-- Personas (seeds 01 + 02): u2 admin A · u3 staff A · u5 admin B.
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

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
-- transaction-local settings instead (same harness as 07).
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

-- ════ Staff A (u3): reads the registry, cannot create a walk-in ═════════════
-- registry.read WITHOUT registry.create_walk_in is precisely the mapping the
-- 2C page relies on when it hides the button (ADR-0006 §D2-04).

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');

select isnt(
  (select count(*)::int from public.persons
   where barangay_id = 'a0000000-0000-4000-8000-000000000001'),
  0, 'staff hold registry.read and see their tenant''s persons');

select throws_ok(
  $$select public.create_walk_in_person(
      'a0000000-0000-4000-8000-000000000001', 'Walkin', 'Denied (Test)',
      'renter', 'staff must not be able to do this (synthetic)')$$,
  '42501', null,
  'staff CANNOT create a walk-in person — the hidden button is not the control');

-- Reading the duplicate scanner is part of registry.read, so staff keep it;
-- what they lack is the write.
select lives_ok(
  $$select * from public.duplicate_candidates(
      'a0000000-0000-4000-8000-000000000001', 'Maria', 'Santos')$$,
  'staff may still SCAN for duplicates (a read), which the walk-in form uses');

-- ════ Admin A (u2): holds the capability the staff account lacks ════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

select pg_temp.remember('walkin', public.create_walk_in_person(
  'a0000000-0000-4000-8000-000000000001',
  'Audit', 'Hygiene Walkin (Test)', 'renter',
  'Slice 2C walk-in audit fixture (synthetic)'));

select isnt(pg_temp.recall('walkin'), null,
  'an administrator CAN create a walk-in person');

select is(
  (select source_channel::text from public.persons where id = pg_temp.recall('walkin')),
  'staff', 'the record is stamped as the staff-assisted channel, not self');

-- ── Audit metadata hygiene for the walk-in path ─────────────────────────────
-- Provenance yes; personal values never (Phase 6 §37.2, mirroring the
-- profile-audit rule already pinned in 04_audit.test.sql).
--
-- Read as the system role: the claim under test is what the metadata
-- CONTAINS, which must not depend on who is permitted to read the trail.

select pg_temp.as_system();

select is(
  (select count(*)::int from public.audit_events
   where target_type = 'person'
     and target_id = pg_temp.recall('walkin')::text
     and metadata ->> 'source_channel' = 'staff'),
  1, 'walk-in creation is audited with its source channel');

select is(
  (select count(*)::int from public.audit_events
   where target_id = pg_temp.recall('walkin')::text
     and metadata::text like '%Hygiene Walkin%'),
  0, 'the audit metadata does NOT carry the resident''s name');

select is(
  (select count(*)::int from public.audit_events
   where target_id = pg_temp.recall('walkin')::text
     and metadata::text like '%Slice 2C walk-in audit fixture%'),
  0, 'nor the free-text creation reason');

-- ════ Admin B (u5): the new record is invisible across the tenant line ══════
-- The 2C detail route reaches a person by opaque UUID, so cross-tenant
-- isolation is what makes an enumerated id indistinguishable from a
-- non-existent one (Phase 4 §13.6).

select pg_temp.impersonate('00000000-0000-4000-8000-000000000005');

select is(
  (select count(*)::int from public.persons where id = pg_temp.recall('walkin')),
  0, 'a tenant-B administrator cannot read the tenant-A walk-in by its id');

select pg_temp.as_system();
select * from finish();

rollback;
