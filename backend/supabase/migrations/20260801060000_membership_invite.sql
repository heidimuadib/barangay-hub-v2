-- ============================================================================
-- Slice 1 · US-DB-005 · Invite an existing account into a barangay
--
-- Account provisioning policy (decision log DEC-AUTH-01): Slice 1 has NO public
-- sign-up. Accounts exist via seed (local/CI) or platform provisioning (later
-- slice); a barangay administrator connects an EXISTING account to their
-- barangay by exact email — the only privileged operation that needs to see
-- auth.users, hence a SECURITY DEFINER function rather than a table grant.
--
-- Anti-enumeration: every ineligible outcome (no such account, already a
-- member) raises the SAME error. Successful invites are audited HERE, in the
-- same transaction, with a sha-256 email digest — never the address itself
-- (Phase 6 §37.2). FAILED attempts cannot be audited inside this function:
-- the raise aborts the transaction and would discard the entry. Denials are
-- therefore audited by the application through the service-role audit path
-- ('audit-append'), whose write is a separate transaction that survives.
-- ============================================================================

create function public.create_membership_by_email(
  p_barangay_id uuid,
  p_email text,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_email_hash text := encode(extensions.digest(lower(btrim(p_email)), 'sha256'), 'hex');
  v_user_id uuid;
  v_membership_id uuid;
begin
  -- Fail closed: the permission check happens HERE, inside the definer,
  -- because the inserts below run on the owner path.
  if not public.auth_has_permission(p_barangay_id, 'membership.manage') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  if v_user_id is null
     or not exists (select 1 from public.user_profiles up where up.user_id = v_user_id)
     or exists (
       select 1 from public.memberships m
       where m.barangay_id = p_barangay_id and m.user_id = v_user_id
     ) then
    -- Uniform for every ineligible case — an admin cannot use this function
    -- to probe which email addresses hold accounts.
    raise exception 'INVITE_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;

  insert into public.memberships (barangay_id, user_id, status)
  values (p_barangay_id, v_user_id, 'invited')
  returning id into v_membership_id;
  -- membership.created is audited by the table trigger in this same
  -- transaction; the explicit entry below records WHO was targeted by email
  -- digest so the invite attempt and the created row correlate.
  perform public.append_audit_entry(
    'membership.invite', 'membership', v_membership_id::text, p_barangay_id,
    jsonb_build_object('email_hash', v_email_hash),
    'success', 'db', p_correlation_id);

  return v_membership_id;
end;
$$;

comment on function public.create_membership_by_email(uuid, text, uuid) is
  'Barangay-admin invite of an existing account by exact email. Uniform failure for all ineligible outcomes; every attempt audited with an email digest, never the address.';

revoke execute on function public.create_membership_by_email(uuid, text, uuid) from public, anon;
grant execute on function public.create_membership_by_email(uuid, text, uuid) to authenticated;
