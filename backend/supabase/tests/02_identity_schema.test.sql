-- ============================================================================
-- pgTAP · Slice 1 · Identity schema structure
--
-- Structural guarantees: enums, forced RLS on every table, security-definer
-- functions with pinned search_path, append-only wiring, and the grant
-- surface (anon holds ONLY the US-UI-006 public catalog since Slice 3D;
-- authenticated may write only display_name).
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

-- ── Enumerations ────────────────────────────────────────────────────────────

select has_type('public', 'membership_status', 'membership_status enum exists');
select enum_has_labels(
  'public', 'membership_status', array['invited', 'active', 'disabled'],
  'membership lifecycle is invited → active → disabled');
select has_type('public', 'role_scope', 'role_scope enum exists');
select enum_has_labels(
  'public', 'role_scope', array['platform', 'barangay'],
  'platform and barangay authority are distinct scopes');

-- ── RLS enabled AND forced on every Slice 1 table ───────────────────────────

select is(
  (
    select count(*)::int
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relrowsecurity and c.relforcerowsecurity
  ),
  20,
  'all twenty tables have RLS enabled AND forced — including against the owner');

-- ── Every table carries at least one explicit policy ────────────────────────

select is(
  (
    select count(distinct c.relname)::int
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_policy p on p.polrelid = c.oid
    where n.nspname = 'public'
  ),
  20,
  'every table has explicit policies — forced RLS with none would brick the owner path silently');

-- ── Authenticated write surface is exactly as designed ──────────────────────

select is(
  (
    select array_agg(privilege_type::text order by privilege_type::text)
    from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'audit_events'
      and grantee = 'authenticated'
  ),
  array['SELECT'],
  'authenticated holds SELECT and nothing else on audit_events');

select is(
  (
    select count(*)::int
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('roles', 'permissions', 'role_permissions', 'barangays')
      and grantee = 'authenticated'
      and privilege_type <> 'SELECT'
  ),
  0,
  'catalogs and barangays are read-only for authenticated');

-- anon holds EXACTLY the public catalog, and nothing else.
--
-- This was `count = 0` until Slice 3D. US-UI-006 needs an anonymous visitor to
-- read what a barangay issues, so 3A's deliberate withholding of that grant
-- ended with the surface that needed it (migration 20260808020000).
--
-- Restated as an exhaustive INVENTORY rather than a relaxed count: a naked
-- "how many" would pass just as happily if a future migration handed `anon`
-- the requests table. Naming the tables means any addition fails here.
select is(
  (
    select coalesce(string_agg(distinct table_name, ',' order by table_name), '')
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'
  ),
  'document_type_requirements,document_types',
  'anon holds table privileges on the public catalog ONLY');

select is(
  (
    select count(*)::int
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon' and privilege_type <> 'SELECT'
  ),
  0,
  'and that privilege is SELECT — anon can write nothing, anywhere');

-- Column-level: display_name is the only updatable profile column.
select is(
  (
    select array_agg(column_name::text order by column_name)
    from information_schema.role_column_grants
    where table_schema = 'public' and table_name = 'user_profiles'
      and grantee = 'authenticated' and privilege_type = 'UPDATE'
  ),
  array['display_name'],
  'authenticated may update ONLY user_profiles.display_name');

-- ── Composite tenant keys (Phase 4 DB-ADR-01) ───────────────────────────────

select is(
  (
    select count(*)::int
    from information_schema.table_constraints tc
    join information_schema.key_column_usage k
      on k.constraint_name = tc.constraint_name and k.constraint_schema = tc.constraint_schema
    where tc.table_schema = 'public' and tc.table_name = 'membership_roles'
      and tc.constraint_type = 'FOREIGN KEY'
      and k.column_name in ('membership_id', 'barangay_id')
  ),
  2,
  'membership_roles carries the composite (membership_id, barangay_id) FK');

select is(
  (
    select count(*)::int
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname in ('membership_roles', 'platform_role_assignments')
      and c.contype = 'c'
      and pg_catalog.pg_get_constraintdef(c.oid) like '%role_scope =%'
  ),
  2,
  'role assignments pin their scope by CHECK — platform roles cannot enter the tenant path');

-- ── Security-definer functions with pinned search_path ──────────────────────

select is(
  (
    select count(*)::int
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'auth_is_platform_admin', 'auth_has_platform_permission',
        'auth_is_active_member', 'auth_has_permission', 'auth_can_read_profile',
        'append_audit_entry', 'auth_context', 'create_membership_by_email')
      and p.prosecdef
      and exists (
        select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%'
      )
  ),
  8,
  'every authorization/audit function is SECURITY DEFINER with a pinned search_path');

select is(
  (
    select count(*)::int
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and (p.proconfig is null
        or not exists (select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%'))
  ),
  0,
  'no SECURITY DEFINER function exists without a pinned search_path');

-- anon may execute exactly one public function: the US-UI-006 directory.
--
-- Also `count = 0` until Slice 3D. Named rather than counted, for the same
-- reason as the table grant above.
select is(
  (
    select coalesce(string_agg(distinct routine_name, ',' order by routine_name), '')
    from information_schema.routine_privileges
    where routine_schema = 'public' and grantee = 'anon'
  ),
  'barangay_is_public,list_public_barangays',
  'anon may execute the public barangay directory and no other function');

-- ── Audit wiring ────────────────────────────────────────────────────────────

select is(
  (
    select a.attgenerated
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.audit_events'::regclass and a.attname = 'metadata_hash'
  ),
  's',
  'audit_events.metadata_hash is a STORED generated column (DB-ADR-08)');

select has_trigger('public', 'audit_events', 'audit_events_append_only',
  'the append-only trigger exists on audit_events');

select has_trigger('public', 'memberships', 'memberships_audit_insert',
  'membership creation is audited by trigger');
select has_trigger('public', 'memberships', 'memberships_audit_status_change',
  'membership status changes are audited by trigger');
select has_trigger('public', 'membership_roles', 'membership_roles_audit',
  'role grants and revocations are audited by trigger');
select has_trigger('public', 'platform_role_assignments', 'platform_role_assignments_audit',
  'platform role changes are audited by trigger');
select has_trigger('public', 'user_profiles', 'user_profiles_audit_update',
  'profile updates are audited by trigger');

-- ── Immutability and provisioning triggers ──────────────────────────────────

select has_trigger('public', 'memberships', 'memberships_reject_rebinding',
  'memberships cannot be rebound to another user or barangay');

select is(
  (
    select count(*)::int
    from pg_catalog.pg_trigger t
    where t.tgrelid = 'auth.users'::regclass and t.tgname = 'on_auth_user_created'
  ),
  1,
  'profile provisioning trigger exists on auth.users');

select * from finish();

rollback;
