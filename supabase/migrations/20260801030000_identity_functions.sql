-- ============================================================================
-- Slice 1 · US-DB-003 · Authorization and audit functions
--
-- All functions are SECURITY DEFINER with an EMPTY search_path and fully
-- qualified references — the only pattern that is safe to call from RLS
-- policies on the very tables they read (Phase 6 §25; forced RLS re-opens for
-- the owner through explicit `to postgres` policies in the RLS migration).
--
-- Every function fails CLOSED: a missing JWT (auth.uid() is null) yields
-- false / an empty context, never an error path that a caller might interpret
-- as success.
-- ============================================================================

-- ── auth_is_platform_admin ──────────────────────────────────────────────────

create function public.auth_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_role_assignments pra
    where pra.user_id = auth.uid()
  );
$$;

comment on function public.auth_is_platform_admin() is
  'True when the caller holds any platform-scope role. Platform authority NEVER implies tenant access (Phase 4 §16.4).';

-- ── auth_has_platform_permission ────────────────────────────────────────────

create function public.auth_has_platform_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_role_assignments pra
    join public.role_permissions rp on rp.role_key = pra.role_key
    where pra.user_id = auth.uid()
      and rp.permission_key = p_permission
      and rp.scope = 'platform'
  );
$$;

-- ── auth_is_active_member ───────────────────────────────────────────────────

create function public.auth_is_active_member(p_barangay_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.barangay_id = p_barangay_id
      and m.status = 'active'
  );
$$;

comment on function public.auth_is_active_member(uuid) is
  'True when the caller has an ACTIVE membership in the barangay. Invited and disabled memberships confer nothing (fail closed).';

-- ── auth_has_permission ─────────────────────────────────────────────────────

create function public.auth_has_permission(p_barangay_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.membership_roles mr on mr.membership_id = m.id
    join public.role_permissions rp on rp.role_key = mr.role_key
    where m.user_id = auth.uid()
      and m.barangay_id = p_barangay_id
      and m.status = 'active'
      and rp.permission_key = p_permission
      and rp.scope = 'barangay'
  );
$$;

comment on function public.auth_has_permission(uuid, text) is
  'THE authorization primitive (README non-negotiable). Resolves live from memberships → membership_roles → role_permissions; never from JWT claims (Phase 4 DB-ADR-03). A disabled or invited membership resolves to false.';

-- ── auth_can_read_profile ───────────────────────────────────────────────────

create function public.auth_can_read_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id = auth.uid()
    or exists (
      select 1
      from public.memberships target
      where target.user_id = p_user_id
        and public.auth_has_permission(target.barangay_id, 'membership.read')
    );
$$;

comment on function public.auth_can_read_profile(uuid) is
  'Self, or a member of a barangay where the caller holds membership.read. Platform administrators deliberately do NOT pass (Phase 4 §16.4).';

-- ── append_audit_entry ──────────────────────────────────────────────────────

create function public.append_audit_entry(
  p_action text,
  p_target_type text,
  p_target_id text default null,
  p_barangay_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_outcome text default 'success',
  p_source text default 'app',
  p_correlation_id uuid default null
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.audit_events
    (actor_user_id, barangay_id, action, target_type, target_id,
     outcome, source, correlation_id, metadata)
  values
    (auth.uid(), p_barangay_id, p_action, p_target_type, p_target_id,
     p_outcome, p_source, p_correlation_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.append_audit_entry(text, text, text, uuid, jsonb, text, text, uuid) is
  'The ONLY write path into audit_events. Runs inside the caller''s transaction, so a domain mutation and its audit entry commit or roll back together (README non-negotiable). The actor is auth.uid(), never a parameter.';

-- ── auth_context ────────────────────────────────────────────────────────────

create function public.auth_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then jsonb_build_object('userId', null)
    else jsonb_build_object(
      'userId', auth.uid(),
      'displayName', (
        select up.display_name from public.user_profiles up where up.user_id = auth.uid()
      ),
      'isPlatformAdmin', public.auth_is_platform_admin(),
      'platformPermissions', coalesce((
        select jsonb_agg(distinct rp.permission_key order by rp.permission_key)
        from public.platform_role_assignments pra
        join public.role_permissions rp on rp.role_key = pra.role_key and rp.scope = 'platform'
        where pra.user_id = auth.uid()
      ), '[]'::jsonb),
      'memberships', coalesce((
        select jsonb_agg(jsonb_build_object(
          'membershipId', m.id,
          'barangayId', m.barangay_id,
          'barangayCode', b.code,
          'barangayName', b.name,
          'status', m.status,
          'roles', coalesce((
            select jsonb_agg(mr.role_key order by mr.role_key)
            from public.membership_roles mr
            where mr.membership_id = m.id
          ), '[]'::jsonb),
          'permissions', case
            when m.status = 'active' then coalesce((
              select jsonb_agg(distinct rp.permission_key order by rp.permission_key)
              from public.membership_roles mr
              join public.role_permissions rp on rp.role_key = mr.role_key and rp.scope = 'barangay'
              where mr.membership_id = m.id
            ), '[]'::jsonb)
            -- Invited/disabled memberships are visible but confer NOTHING.
            else '[]'::jsonb
          end
        ) order by b.name)
        from public.memberships m
        join public.barangays b on b.id = m.barangay_id
        where m.user_id = auth.uid()
      ), '[]'::jsonb)
    )
  end;
$$;

comment on function public.auth_context() is
  'Returns the CALLER''s complete authorization context in one round trip. Scoped to auth.uid() by construction — it cannot describe another user.';

-- ── Execution grants ────────────────────────────────────────────────────────
-- Deny by default, then grant the minimum. anon gets nothing: every Slice 1
-- capability requires an authenticated session.

revoke execute on all functions in schema public from public, anon;

grant execute on function public.auth_is_platform_admin() to authenticated;
grant execute on function public.auth_has_platform_permission(text) to authenticated;
grant execute on function public.auth_is_active_member(uuid) to authenticated;
grant execute on function public.auth_has_permission(uuid, text) to authenticated;
grant execute on function public.auth_can_read_profile(uuid) to authenticated;
grant execute on function public.auth_context() to authenticated;
grant execute on function public.append_audit_entry(text, text, text, uuid, jsonb, text, text, uuid)
  to authenticated, service_role;
