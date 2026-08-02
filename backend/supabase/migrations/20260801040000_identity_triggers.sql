-- ============================================================================
-- Slice 1 · US-DB-004 · Triggers: timestamps, immutability, automatic audit
--
-- The audit triggers are what make the README guarantee structural: EVERY
-- privileged identity change writes its audit entry in the same transaction,
-- regardless of which code path performed the mutation. An application that
-- forgets to audit cannot exist, because the database audits for it.
-- ============================================================================

-- ── updated_at maintenance ──────────────────────────────────────────────────

create function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger barangays_set_updated_at
  before update on public.barangays
  for each row execute function public.set_updated_at();

create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

-- ── Immutability guards ─────────────────────────────────────────────────────

-- Two table-specific functions rather than one shared: PL/pgSQL compiles NEW
-- field references against the concrete row type, so a shared body naming
-- memberships.barangay_id would fail at runtime on user_profiles rows.

create function public.reject_profile_rebinding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'user_profiles.user_id is immutable';
  end if;
  return new;
end;
$$;

create function public.reject_membership_rebinding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id or new.barangay_id <> old.barangay_id then
    raise exception 'memberships.user_id and memberships.barangay_id are immutable';
  end if;
  return new;
end;
$$;

comment on function public.reject_membership_rebinding() is
  'A membership can change STATUS, never owner or tenant. Rebinding either would silently move history across users or barangays.';

create trigger user_profiles_reject_rebinding
  before update on public.user_profiles
  for each row execute function public.reject_profile_rebinding();

create trigger memberships_reject_rebinding
  before update on public.memberships
  for each row execute function public.reject_membership_rebinding();

-- ── Audit append-only enforcement ───────────────────────────────────────────

create function public.reject_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'audit_events is append-only';
end;
$$;

create trigger audit_events_append_only
  before update or delete on public.audit_events
  for each row execute function public.reject_audit_mutation();

-- ── Grantor stamping ────────────────────────────────────────────────────────

create function public.stamp_granted_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Server-derived, never client-supplied. Null when granted by seed/system.
  new.granted_by := auth.uid();
  new.granted_at := now();
  return new;
end;
$$;

create trigger membership_roles_stamp_grantor
  before insert on public.membership_roles
  for each row execute function public.stamp_granted_by();

create trigger platform_role_assignments_stamp_grantor
  before insert on public.platform_role_assignments
  for each row execute function public.stamp_granted_by();

-- ── Automatic audit of identity changes ─────────────────────────────────────
-- Metadata carries status values, role keys and field NAMES only — never
-- display names, emails or other personal values (Phase 6 §37.2).

create function public.audit_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.append_audit_entry(
      'membership.created', 'membership', new.id::text, new.barangay_id,
      jsonb_build_object('status', new.status), 'success', 'db');
    return new;
  end if;

  perform public.append_audit_entry(
    'membership.status_changed', 'membership', new.id::text, new.barangay_id,
    jsonb_build_object('from_status', old.status, 'to_status', new.status),
    'success', 'db');
  return new;
end;
$$;

create trigger memberships_audit_insert
  after insert on public.memberships
  for each row execute function public.audit_membership_change();

create trigger memberships_audit_status_change
  after update on public.memberships
  for each row
  when (old.status is distinct from new.status)
  execute function public.audit_membership_change();

create function public.audit_membership_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.append_audit_entry(
      'membership.role_granted', 'membership_role',
      new.membership_id::text, new.barangay_id,
      jsonb_build_object('role_key', new.role_key), 'success', 'db');
    return new;
  end if;

  perform public.append_audit_entry(
    'membership.role_revoked', 'membership_role',
    old.membership_id::text, old.barangay_id,
    jsonb_build_object('role_key', old.role_key), 'success', 'db');
  return old;
end;
$$;

create trigger membership_roles_audit
  after insert or delete on public.membership_roles
  for each row execute function public.audit_membership_role_change();

create function public.audit_platform_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.append_audit_entry(
      'platform.role_granted', 'platform_role_assignment',
      new.user_id::text, null,
      jsonb_build_object('role_key', new.role_key), 'success', 'db');
    return new;
  end if;

  perform public.append_audit_entry(
    'platform.role_revoked', 'platform_role_assignment',
    old.user_id::text, null,
    jsonb_build_object('role_key', old.role_key), 'success', 'db');
  return old;
end;
$$;

create trigger platform_role_assignments_audit
  after insert or delete on public.platform_role_assignments
  for each row execute function public.audit_platform_role_change();

create function public.audit_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_barangay uuid;
  v_scoped boolean := false;
begin
  -- Field names only. The old and new VALUES are personal data and never
  -- enter the audit trail.
  --
  -- One row PER membership tenant, so the change is visible to that tenant's
  -- auditors (who can already read the profile) and NEVER to the platform
  -- scope (Phase 4 §16.4). A membership-less account falls back to a single
  -- platform-scope row so the change is still audited somewhere.
  for v_barangay in
    select m.barangay_id from public.memberships m where m.user_id = new.user_id
  loop
    v_scoped := true;
    perform public.append_audit_entry(
      'profile.updated', 'user_profile', new.user_id::text, v_barangay,
      jsonb_build_object('fields', jsonb_build_array('display_name')), 'success', 'db');
  end loop;

  if not v_scoped then
    perform public.append_audit_entry(
      'profile.updated', 'user_profile', new.user_id::text, null,
      jsonb_build_object('fields', jsonb_build_array('display_name')), 'success', 'db');
  end if;

  return new;
end;
$$;

create trigger user_profiles_audit_update
  after update on public.user_profiles
  for each row
  when (old.display_name is distinct from new.display_name)
  execute function public.audit_profile_update();

-- ── Profile provisioning from auth.users ────────────────────────────────────

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- raw_user_meta_data supplies a DISPLAY NAME and nothing else. Authorization
  -- never reads auth metadata (README non-negotiable) — roles and memberships
  -- exist only in server-controlled tables.
  insert into public.user_profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, 'account'), '@', 1)
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
