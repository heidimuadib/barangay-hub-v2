-- ============================================================================
-- Slice 1 · US-DB-003 · Row-Level Security: forced, deny-by-default, explicit
--
-- Layered enforcement, in order of evaluation:
--   1. GRANTS   — anon holds NOTHING on any Slice 1 table; authenticated holds
--                 only the verbs a policy actually serves.
--   2. RLS      — enabled AND forced on every table (README non-negotiable).
--                 Forcing applies RLS even to the table owner, so the owner
--                 paths used by SECURITY DEFINER helpers, triggers and seeds
--                 are re-opened EXPLICITLY below and are visible in pg_policies
--                 rather than being an implicit ownership bypass.
--   3. TRIGGERS — append-only audit, immutable identity bindings.
--
-- service_role carries BYPASSRLS in Supabase; it is nevertheless named in the
-- system policies so the privilege is explicit and testable, not an accident
-- of a role attribute.
-- ============================================================================

-- ── Enable + force ──────────────────────────────────────────────────────────

alter table public.barangays                 enable row level security;
alter table public.barangays                 force row level security;
alter table public.user_profiles             enable row level security;
alter table public.user_profiles             force row level security;
alter table public.roles                     enable row level security;
alter table public.roles                     force row level security;
alter table public.permissions               enable row level security;
alter table public.permissions               force row level security;
alter table public.role_permissions          enable row level security;
alter table public.role_permissions          force row level security;
alter table public.memberships               enable row level security;
alter table public.memberships               force row level security;
alter table public.membership_roles          enable row level security;
alter table public.membership_roles          force row level security;
alter table public.platform_role_assignments enable row level security;
alter table public.platform_role_assignments force row level security;
alter table public.audit_events              enable row level security;
alter table public.audit_events              force row level security;

-- ── Grants: deny by default, then the minimum ───────────────────────────────

revoke all on public.barangays,
              public.user_profiles,
              public.roles,
              public.permissions,
              public.role_permissions,
              public.memberships,
              public.membership_roles,
              public.platform_role_assignments,
              public.audit_events
  from public, anon, authenticated;

grant select on public.barangays        to authenticated;
grant select on public.roles            to authenticated;
grant select on public.permissions      to authenticated;
grant select on public.role_permissions to authenticated;

grant select on public.user_profiles to authenticated;
-- Column-level: display_name is the ONLY self-writable profile field.
grant update (display_name) on public.user_profiles to authenticated;

grant select, insert, update on public.memberships               to authenticated;
grant select, insert, delete on public.membership_roles          to authenticated;
grant select, insert, delete on public.platform_role_assignments to authenticated;
grant select                 on public.audit_events              to authenticated;

-- ── System policies (owner + service role) ──────────────────────────────────
-- Forced RLS applies to postgres too. These policies are the explicit,
-- auditable owner path used by SECURITY DEFINER functions, triggers and seeds.

create policy barangays_system_all on public.barangays
  as permissive for all to postgres, service_role using (true) with check (true);
create policy user_profiles_system_all on public.user_profiles
  as permissive for all to postgres, service_role using (true) with check (true);
create policy roles_system_all on public.roles
  as permissive for all to postgres, service_role using (true) with check (true);
create policy permissions_system_all on public.permissions
  as permissive for all to postgres, service_role using (true) with check (true);
create policy role_permissions_system_all on public.role_permissions
  as permissive for all to postgres, service_role using (true) with check (true);
create policy memberships_system_all on public.memberships
  as permissive for all to postgres, service_role using (true) with check (true);
create policy membership_roles_system_all on public.membership_roles
  as permissive for all to postgres, service_role using (true) with check (true);
create policy platform_role_assignments_system_all on public.platform_role_assignments
  as permissive for all to postgres, service_role using (true) with check (true);
create policy audit_events_system_all on public.audit_events
  as permissive for all to postgres, service_role using (true) with check (true);

-- ── barangays ───────────────────────────────────────────────────────────────
-- Members see their own barangay; platform.barangay.read lists tenant METADATA
-- for the console. No authenticated write path exists — tenant lifecycle is a
-- platform provisioning operation in a later slice.

create policy barangays_member_or_platform_select on public.barangays
  for select to authenticated
  using (
    public.auth_is_active_member(id)
    or public.auth_has_platform_permission('platform.barangay.read')
  );

-- ── user_profiles ───────────────────────────────────────────────────────────

create policy user_profiles_select on public.user_profiles
  for select to authenticated
  using (public.auth_can_read_profile(user_id));

create policy user_profiles_self_update on public.user_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Catalogs ────────────────────────────────────────────────────────────────
-- Deliberately readable by any authenticated user: rows are capability
-- vocabulary (role keys, permission keys), never tenant or personal data.
-- All write verbs are revoked; the catalogs change only by migration.

create policy roles_authenticated_select on public.roles
  for select to authenticated using (true);

create policy permissions_authenticated_select on public.permissions
  for select to authenticated using (true);

create policy role_permissions_authenticated_select on public.role_permissions
  for select to authenticated using (true);

-- ── memberships ─────────────────────────────────────────────────────────────

create policy memberships_select on public.memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.auth_has_permission(barangay_id, 'membership.read')
  );

create policy memberships_manage_insert on public.memberships
  for insert to authenticated
  with check (public.auth_has_permission(barangay_id, 'membership.manage'));

create policy memberships_manage_update on public.memberships
  for update to authenticated
  using (public.auth_has_permission(barangay_id, 'membership.manage'))
  with check (public.auth_has_permission(barangay_id, 'membership.manage'));

-- No DELETE policy: revocation is status = 'disabled', preserving history.

-- ── membership_roles ────────────────────────────────────────────────────────

create policy membership_roles_select on public.membership_roles
  for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.id = membership_id and m.user_id = auth.uid()
    )
    or public.auth_has_permission(barangay_id, 'membership.read')
  );

create policy membership_roles_assign_insert on public.membership_roles
  for insert to authenticated
  with check (public.auth_has_permission(barangay_id, 'role.assign'));

create policy membership_roles_assign_delete on public.membership_roles
  for delete to authenticated
  using (public.auth_has_permission(barangay_id, 'role.assign'));

-- ── platform_role_assignments ───────────────────────────────────────────────
-- Only an existing platform administrator can change platform authority.
-- Bootstrap happens via seed (local/CI) or the tenant-provisioning service-role
-- operation (later slice) — never through self-service.

create policy platform_role_assignments_select on public.platform_role_assignments
  for select to authenticated
  using (user_id = auth.uid() or public.auth_is_platform_admin());

create policy platform_role_assignments_admin_insert on public.platform_role_assignments
  for insert to authenticated
  with check (public.auth_is_platform_admin());

create policy platform_role_assignments_admin_delete on public.platform_role_assignments
  for delete to authenticated
  using (public.auth_is_platform_admin());

-- ── audit_events ────────────────────────────────────────────────────────────
-- Tenant events are visible to audit.read holders of THAT tenant. Platform
-- events (barangay_id is null) are visible to platform.audit.read holders.
-- A platform administrator deliberately cannot read tenant audit trails
-- (Phase 4 §16.4). No authenticated write verb is even granted.

create policy audit_events_scoped_select on public.audit_events
  for select to authenticated
  using (
    (barangay_id is not null and public.auth_has_permission(barangay_id, 'audit.read'))
    or (barangay_id is null and public.auth_has_platform_permission('platform.audit.read'))
  );
