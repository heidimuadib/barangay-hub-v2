-- ============================================================================
-- Slice 2A · Registry and verification domain functions
--
-- Single write path: authenticated clients hold NO insert/update/delete
-- grants on registry tables — every mutation flows through the SECURITY
-- DEFINER functions below, each of which re-checks capability or ownership
-- itself (fail closed), so the RPC surface and the RLS grants can never
-- disagree. All functions pin an empty search_path and fully qualify.
--
-- The online and staff-assisted paths call the SAME functions
-- (ADR-0006 point 6): create_own_person vs create_walk_in_person differ only
-- in channel and authorization, then converge on one registry.
-- ============================================================================

-- ── Internal helpers ────────────────────────────────────────────────────────

create function public.caller_owns_person(p_person_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.person_accounts pa
    where pa.person_id = p_person_id and pa.user_id = auth.uid()
  );
$$;

create function public.caller_owns_application(p_application_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.verification_applications va
    join public.person_accounts pa on pa.person_id = va.person_id
    where va.id = p_application_id and pa.user_id = auth.uid()
  );
$$;

-- Enqueue is INTERNAL: no client role may execute it; the domain functions
-- below call it inside their own transaction (README non-negotiable).
create function public.enqueue_outbox(
  p_barangay_id uuid,
  p_event_type text,
  p_payload jsonb,
  p_correlation_id uuid default null
)
returns bigint
language plpgsql volatile security definer set search_path = ''
as $$
declare v_id bigint;
begin
  insert into public.outbox_events (barangay_id, event_type, payload, correlation_id)
  values (p_barangay_id, p_event_type, coalesce(p_payload, '{}'::jsonb), p_correlation_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- ── Person creation (one registry, two channels — ADR-0006 point 6) ─────────

create function public.create_own_person(
  p_barangay_id uuid,
  p_first_name text,
  p_last_name text,
  p_residency_basis public.residency_basis,
  p_middle_name text default null,
  p_suffix text default null,
  p_birthdate date default null,
  p_contact_phone text default null,
  p_address_line text default null,
  p_residency_explanation text default null
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare v_person_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if not exists (select 1 from public.barangays b where b.id = p_barangay_id and b.is_active) then
    -- Uniform: an unknown and an inactive barangay are indistinguishable.
    raise exception 'BARANGAY_NOT_AVAILABLE' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.person_accounts pa
    where pa.barangay_id = p_barangay_id and pa.user_id = auth.uid()
  ) then
    raise exception 'PERSON_ALREADY_EXISTS' using errcode = 'P0001';
  end if;

  insert into public.persons
    (barangay_id, first_name, middle_name, last_name, suffix, birthdate,
     contact_phone, address_line, residency_basis_key,
     residency_basis_explanation, source_channel)
  values
    (p_barangay_id, p_first_name, p_middle_name, p_last_name, p_suffix,
     p_birthdate, p_contact_phone, p_address_line, p_residency_basis,
     p_residency_explanation, 'self')
  returning id into v_person_id;

  -- Self-registration links the creating account in the same transaction.
  insert into public.person_accounts (person_id, barangay_id, user_id)
  values (v_person_id, p_barangay_id, auth.uid());

  return v_person_id;
end;
$$;

comment on function public.create_own_person is
  'Resident onboarding entry (Option C public path). Creates the person AND its account link in one transaction; audited by triggers. One person per account per barangay.';

create function public.create_walk_in_person(
  p_barangay_id uuid,
  p_first_name text,
  p_last_name text,
  p_residency_basis public.residency_basis,
  p_reason text,
  p_middle_name text default null,
  p_suffix text default null,
  p_birthdate date default null,
  p_contact_phone text default null,
  p_address_line text default null,
  p_residency_explanation text default null
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare v_person_id uuid;
begin
  if not public.auth_has_permission(p_barangay_id, 'registry.create_walk_in') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;

  insert into public.persons
    (barangay_id, first_name, middle_name, last_name, suffix, birthdate,
     contact_phone, address_line, residency_basis_key,
     residency_basis_explanation, source_channel, creation_reason)
  values
    (p_barangay_id, p_first_name, p_middle_name, p_last_name, p_suffix,
     p_birthdate, p_contact_phone, p_address_line, p_residency_basis,
     p_residency_explanation, 'staff', p_reason)
  returning id into v_person_id;

  return v_person_id;
end;
$$;

comment on function public.create_walk_in_person is
  'Staff-assisted person creation (ADR-0006 points 5/7/16). Same registry as self-registration; requires registry.create_walk_in; the reason requirement and actor stamping are trigger-enforced; no account is created or required.';

-- ── Account ↔ person matching (ADR-0006 point 8) ────────────────────────────

create function public.link_person_account(p_person_id uuid, p_user_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_barangay uuid; v_superseded uuid;
begin
  select p.barangay_id, p.superseded_by into v_barangay, v_superseded
  from public.persons p where p.id = p_person_id;
  if v_barangay is null
     or not public.auth_has_permission(v_barangay, 'registry.match_account') then
    -- Not found and not authorized are indistinguishable (Phase 4 §13.6).
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_superseded is not null then
    raise exception 'PERSON_SUPERSEDED' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.user_profiles up where up.user_id = p_user_id) then
    raise exception 'LINK_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;

  -- Uniques enforce one-account-per-person and one-person-per-account-per-
  -- barangay; surface them uniformly.
  begin
    insert into public.person_accounts (person_id, barangay_id, user_id)
    values (p_person_id, v_barangay, p_user_id);
  exception when unique_violation then
    raise exception 'LINK_NOT_ELIGIBLE' using errcode = 'P0001';
  end;
end;
$$;

create function public.unlink_person_account(p_person_id uuid, p_reason text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_barangay uuid;
begin
  select p.barangay_id into v_barangay from public.persons p where p.id = p_person_id;
  if v_barangay is null
     or not public.auth_has_permission(v_barangay, 'registry.match_account') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  -- Set BEFORE the delete: the AFTER-DELETE audit trigger fires during the
  -- statement below, so a setting written afterwards would never reach it.
  perform set_config('app.unlink_reason', btrim(p_reason), true);

  delete from public.person_accounts where person_id = p_person_id;
  if not found then
    raise exception 'LINK_NOT_FOUND' using errcode = 'P0001';
  end if;
end;
$$;

-- ── Duplicate handling (D2-02; ADR-0006 points 9–11) ────────────────────────

create function public.duplicate_candidates(
  p_barangay_id uuid,
  p_first_name text,
  p_last_name text,
  p_birthdate date default null,
  p_exclude_person uuid default null
)
returns table (
  person_id uuid,
  first_name text,
  last_name text,
  birthdate date,
  name_similarity real,
  same_birthdate boolean,
  has_account boolean
)
language plpgsql stable security definer set search_path = ''
as $$
declare v_query text;
begin
  if not public.auth_has_permission(p_barangay_id, 'registry.read') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  v_query := lower(extensions.unaccent(
    coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')));

  -- Threshold 0.30 is the documented domain rule (mirrored in
  -- src/features/registry/rules/duplicate-scoring.ts — the SQL value is
  -- authoritative). Candidates are SIGNALS for manual review, never proof
  -- (ADR-0006 points 9–10); superseded persons are excluded as targets.
  return query
  select p.id, p.first_name, p.last_name, p.birthdate,
         extensions.similarity(p.search_text, v_query) as name_similarity,
         (p_birthdate is not null and p.birthdate = p_birthdate) as same_birthdate,
         exists (select 1 from public.person_accounts pa where pa.person_id = p.id)
           as has_account
  from public.persons p
  where p.barangay_id = p_barangay_id
    and p.superseded_by is null
    and (p_exclude_person is null or p.id <> p_exclude_person)
    and extensions.similarity(p.search_text, v_query) >= 0.30
  order by name_similarity desc, same_birthdate desc
  limit 10;
end;
$$;

create function public.person_search(
  p_barangay_id uuid,
  p_query text,
  p_limit int default 20
)
returns table (
  person_id uuid,
  first_name text,
  middle_name text,
  last_name text,
  birthdate date,
  residency_basis_key public.residency_basis,
  source_channel public.person_source,
  superseded boolean,
  has_account boolean,
  rank real
)
language plpgsql stable security definer set search_path = ''
as $$
declare v_query text;
begin
  if not public.auth_has_permission(p_barangay_id, 'registry.read') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  v_query := lower(extensions.unaccent(coalesce(p_query, '')));
  if length(btrim(v_query)) < 2 then
    return;
  end if;

  return query
  select p.id, p.first_name, p.middle_name, p.last_name, p.birthdate,
         p.residency_basis_key, p.source_channel,
         (p.superseded_by is not null) as superseded,
         exists (select 1 from public.person_accounts pa where pa.person_id = p.id)
           as has_account,
         extensions.similarity(p.search_text, v_query) as rank
  from public.persons p
  where p.barangay_id = p_barangay_id
    and (p.search_text like '%' || v_query || '%'
         or extensions.similarity(p.search_text, v_query) >= 0.30)
  order by rank desc, p.last_name, p.first_name
  limit least(greatest(p_limit, 1), 50);
end;
$$;

comment on function public.person_search is
  'Registry search (registry.read). Invoked via POST RPC so the query never enters a URL (P6-C-E); superseded rows are returned flagged, preserving history visibility for staff.';

create function public.supersede_person(
  p_loser_id uuid,
  p_survivor_id uuid,
  p_reason text
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_loser public.persons%rowtype;
  v_survivor public.persons%rowtype;
  v_loser_user uuid;
  v_survivor_has_account boolean;
begin
  select * into v_loser from public.persons where id = p_loser_id;
  if v_loser.id is null
     or not public.auth_has_permission(v_loser.barangay_id, 'registry.resolve_duplicates') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  select * into v_survivor from public.persons where id = p_survivor_id;

  if v_survivor.id is null or v_survivor.barangay_id <> v_loser.barangay_id then
    raise exception 'SUPERSEDE_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;
  if p_loser_id = p_survivor_id
     or v_loser.superseded_by is not null
     or v_survivor.superseded_by is not null then
    raise exception 'SUPERSEDE_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  -- An undecided application on the loser must be decided first — otherwise
  -- a live review would silently point at a frozen person.
  if exists (
    select 1 from public.verification_applications va
    where va.person_id = p_loser_id and va.state not in ('approved', 'rejected')
  ) then
    raise exception 'SUPERSEDE_BLOCKED_BY_OPEN_APPLICATION' using errcode = 'P0001';
  end if;

  -- Explicit audited link rule (ADR-0006 point 11 / D2-02): move the loser's
  -- account to the survivor when the survivor has none; refuse when both are
  -- linked (staff must unlink deliberately first).
  select pa.user_id into v_loser_user
  from public.person_accounts pa where pa.person_id = p_loser_id;
  v_survivor_has_account := exists (
    select 1 from public.person_accounts pa where pa.person_id = p_survivor_id);

  if v_loser_user is not null and v_survivor_has_account then
    raise exception 'SUPERSEDE_BLOCKED_BY_TWO_ACCOUNTS' using errcode = 'P0001';
  end if;

  if v_loser_user is not null then
    -- Same ordering rule as unlink_person_account: the trigger reads this
    -- during the DELETE.
    perform set_config('app.unlink_reason',
      'moved to surviving person on supersede', true);
    delete from public.person_accounts where person_id = p_loser_id;
    insert into public.person_accounts (person_id, barangay_id, user_id)
    values (p_survivor_id, v_survivor.barangay_id, v_loser_user);
  end if;

  update public.persons
  set superseded_by = p_survivor_id,
      superseded_at = now(),
      superseded_reason = btrim(p_reason)
  where id = p_loser_id;
  -- The frozen record REMAINS queryable forever (D2-02). No deletion path
  -- exists anywhere in this schema.
end;
$$;

comment on function public.supersede_person is
  'D2-02 supersede-and-link: administrator capability + reason required; survivor chosen explicitly; loser preserved and frozen; account link moved only under the explicit rule above; reversal is a future audited correction workflow, not an UPDATE.';

-- ── Verification lifecycle ──────────────────────────────────────────────────

create function public.create_verification_application(p_person_id uuid)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare v_barangay uuid; v_superseded uuid; v_app uuid;
begin
  select p.barangay_id, p.superseded_by into v_barangay, v_superseded
  from public.persons p where p.id = p_person_id;
  if v_barangay is null
     or not (public.caller_owns_person(p_person_id)
             or public.auth_has_permission(v_barangay, 'verification.review')) then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_superseded is not null then
    raise exception 'PERSON_SUPERSEDED' using errcode = 'P0001';
  end if;

  begin
    insert into public.verification_applications (barangay_id, person_id)
    values (v_barangay, p_person_id)
    returning id into v_app;
  exception when unique_violation then
    -- The partial unique index: one open application per person.
    raise exception 'APPLICATION_ALREADY_OPEN' using errcode = 'P0001';
  end;
  return v_app;
end;
$$;

create function public.submit_verification(p_application_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_app public.verification_applications%rowtype;
begin
  select * into v_app from public.verification_applications where id = p_application_id;
  if v_app.id is null
     or not (public.caller_owns_application(p_application_id)
             or public.auth_has_permission(v_app.barangay_id, 'verification.review')) then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_app.state <> 'draft' then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001';
  end if;
  -- Minimum-evidence rule: at least one identity and one residency item.
  -- (Metadata presence in 2A; upload-completeness tightens in subpart 2F.)
  if not exists (select 1 from public.verification_evidence e
                 where e.application_id = p_application_id and e.kind = 'identity')
     or not exists (select 1 from public.verification_evidence e
                 where e.application_id = p_application_id and e.kind = 'residency') then
    raise exception 'EVIDENCE_INCOMPLETE' using errcode = 'P0001';
  end if;

  update public.verification_applications
  set state = 'submitted', submitted_at = now()
  where id = p_application_id;
end;
$$;

create function public.review_verification(p_application_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_app public.verification_applications%rowtype;
begin
  select * into v_app from public.verification_applications where id = p_application_id;
  if v_app.id is null
     or not public.auth_has_permission(v_app.barangay_id, 'verification.review') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_app.state not in ('submitted', 'resubmitted') then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001';
  end if;
  update public.verification_applications
  set state = 'in_review' where id = p_application_id;
end;
$$;

create function public.request_information(p_application_id uuid, p_note text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_app public.verification_applications%rowtype;
begin
  select * into v_app from public.verification_applications where id = p_application_id;
  if v_app.id is null
     or not public.auth_has_permission(v_app.barangay_id, 'verification.request_information') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_app.state <> 'in_review' then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001';
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'NOTE_REQUIRED' using errcode = 'P0001';
  end if;
  update public.verification_applications
  set state = 'info_requested', info_request_note = btrim(p_note)
  where id = p_application_id;
end;
$$;

create function public.resubmit_verification(p_application_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_app public.verification_applications%rowtype;
begin
  select * into v_app from public.verification_applications where id = p_application_id;
  if v_app.id is null
     or not (public.caller_owns_application(p_application_id)
             or public.auth_has_permission(v_app.barangay_id, 'verification.review')) then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_app.state <> 'info_requested' then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001';
  end if;
  update public.verification_applications
  set state = 'resubmitted' where id = p_application_id;
end;
$$;

create function public.approve_verification(
  p_application_id uuid,
  p_correlation_id uuid default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_app public.verification_applications%rowtype;
  v_user uuid;
  v_membership_id uuid;
  v_membership_status public.membership_status;
begin
  select * into v_app from public.verification_applications where id = p_application_id;
  if v_app.id is null
     or not public.auth_has_permission(v_app.barangay_id, 'verification.approve') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_app.state <> 'in_review' then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001';
  end if;

  update public.verification_applications
  set state = 'approved', decided_at = now(), decided_by = auth.uid()
  where id = p_application_id;

  -- A linked account becomes an ACTIVE resident member in this same
  -- transaction. A walk-in without an account is simply a verified person.
  select pa.user_id into v_user
  from public.person_accounts pa where pa.person_id = v_app.person_id;

  if v_user is not null then
    select m.id, m.status into v_membership_id, v_membership_status
    from public.memberships m
    where m.barangay_id = v_app.barangay_id and m.user_id = v_user;

    if v_membership_id is null then
      insert into public.memberships (barangay_id, user_id, status)
      values (v_app.barangay_id, v_user, 'active')
      returning id into v_membership_id;
    elsif v_membership_status = 'invited' then
      update public.memberships set status = 'active' where id = v_membership_id;
    elsif v_membership_status = 'disabled' then
      -- Reactivating a deliberately disabled member is NOT a side effect of
      -- verification — staff must resolve the membership status explicitly.
      raise exception 'MEMBERSHIP_DISABLED' using errcode = 'P0001';
    end if;

    insert into public.membership_roles (membership_id, barangay_id, role_key)
    values (v_membership_id, v_app.barangay_id, 'resident')
    on conflict (membership_id, role_key) do nothing;
  end if;

  -- Notification INTENT in the same transaction; delivery is Slice 8.
  perform public.enqueue_outbox(
    v_app.barangay_id, 'verification.approved',
    jsonb_build_object('application_id', p_application_id,
                       'person_id', v_app.person_id),
    p_correlation_id);
end;
$$;

comment on function public.approve_verification is
  'in_review → approved; activates the linked account''s resident membership in the SAME transaction (or none for account-less walk-ins); refuses when the membership was deliberately disabled; enqueues the notification intent atomically.';

create function public.reject_verification(
  p_application_id uuid,
  p_reason text,
  p_correlation_id uuid default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_app public.verification_applications%rowtype;
begin
  select * into v_app from public.verification_applications where id = p_application_id;
  if v_app.id is null
     or not public.auth_has_permission(v_app.barangay_id, 'verification.reject') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_app.state <> 'in_review' then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  update public.verification_applications
  set state = 'rejected', decided_at = now(), decided_by = auth.uid(),
      decision_reason = btrim(p_reason)
  where id = p_application_id;

  perform public.enqueue_outbox(
    v_app.barangay_id, 'verification.rejected',
    jsonb_build_object('application_id', p_application_id,
                       'person_id', v_app.person_id),
    p_correlation_id);
end;
$$;

-- ── Evidence metadata lifecycle (D2-03; upload broker arrives in 2F) ────────

create function public.add_evidence_metadata(
  p_application_id uuid,
  p_kind public.evidence_kind,
  p_mime_type text,
  p_declared_size_bytes bigint
)
returns table (evidence_id uuid, storage_path text)
language plpgsql volatile security definer set search_path = ''
as $$
declare v_app public.verification_applications%rowtype; v_id uuid; v_path text;
begin
  select * into v_app from public.verification_applications where id = p_application_id;
  if v_app.id is null
     or not (public.caller_owns_application(p_application_id)
             or public.auth_has_permission(v_app.barangay_id, 'verification.review')) then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_app.state not in ('draft', 'info_requested') then
    raise exception 'APPLICATION_NOT_EDITABLE' using errcode = 'P0001';
  end if;

  v_id := gen_random_uuid();
  -- Opaque D2-03 path: UUIDs only — no names, no original filenames.
  v_path := v_app.barangay_id || '/' || p_application_id || '/' || v_id;

  insert into public.verification_evidence
    (id, barangay_id, application_id, kind, mime_type, storage_path,
     declared_size_bytes)
  values
    (v_id, v_app.barangay_id, p_application_id, p_kind, p_mime_type, v_path,
     p_declared_size_bytes);

  return query select v_id, v_path;
end;
$$;

create function public.confirm_evidence_upload(
  p_evidence_id uuid,
  p_content_hash text,
  p_size_bytes bigint
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_ev public.verification_evidence%rowtype;
begin
  select * into v_ev from public.verification_evidence where id = p_evidence_id;
  if v_ev.id is null
     or not (public.caller_owns_application(v_ev.application_id)
             or public.auth_has_permission(v_ev.barangay_id, 'verification.review')) then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_ev.uploaded_at is not null then
    raise exception 'EVIDENCE_ALREADY_CONFIRMED' using errcode = 'P0001';
  end if;

  update public.verification_evidence
  set uploaded_at = now(), content_hash = p_content_hash, size_bytes = p_size_bytes
  where id = p_evidence_id;
end;
$$;

create function public.remove_evidence(p_evidence_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_ev public.verification_evidence%rowtype; v_state public.verification_state;
begin
  select * into v_ev from public.verification_evidence where id = p_evidence_id;
  if v_ev.id is null
     or not (public.caller_owns_application(v_ev.application_id)
             or public.auth_has_permission(v_ev.barangay_id, 'verification.review')) then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  select va.state into v_state
  from public.verification_applications va where va.id = v_ev.application_id;
  if v_state not in ('draft', 'info_requested') then
    raise exception 'APPLICATION_NOT_EDITABLE' using errcode = 'P0001';
  end if;

  delete from public.verification_evidence where id = p_evidence_id;
  -- Storage object cleanup is the 2F broker's job; the audit trigger records
  -- the removal either way.
end;
$$;

-- ── Execution grants — deny by default, then the minimum ────────────────────

revoke execute on function
  public.caller_owns_person(uuid),
  public.caller_owns_application(uuid),
  public.enqueue_outbox(uuid, text, jsonb, uuid),
  public.create_own_person(uuid, text, text, public.residency_basis, text, text, date, text, text, text),
  public.create_walk_in_person(uuid, text, text, public.residency_basis, text, text, text, date, text, text, text),
  public.link_person_account(uuid, uuid),
  public.unlink_person_account(uuid, text),
  public.duplicate_candidates(uuid, text, text, date, uuid),
  public.person_search(uuid, text, int),
  public.supersede_person(uuid, uuid, text),
  public.create_verification_application(uuid),
  public.submit_verification(uuid),
  public.review_verification(uuid),
  public.request_information(uuid, text),
  public.resubmit_verification(uuid),
  public.approve_verification(uuid, uuid),
  public.reject_verification(uuid, text, uuid),
  public.add_evidence_metadata(uuid, public.evidence_kind, text, bigint),
  public.confirm_evidence_upload(uuid, text, bigint),
  public.remove_evidence(uuid)
from public, anon, authenticated;

-- The ownership predicates are used INSIDE the RLS policies, which evaluate
-- with the querying role's privileges — so authenticated must be able to
-- execute them (exactly as auth_has_permission is granted in Slice 1). Both
-- are scoped to auth.uid() by construction: they answer only "does the caller
-- own this?" and can disclose nothing about anyone else.
grant execute on function
  public.caller_owns_person(uuid),
  public.caller_owns_application(uuid)
to authenticated;

grant execute on function
  public.create_own_person(uuid, text, text, public.residency_basis, text, text, date, text, text, text),
  public.create_walk_in_person(uuid, text, text, public.residency_basis, text, text, text, date, text, text, text),
  public.link_person_account(uuid, uuid),
  public.unlink_person_account(uuid, text),
  public.duplicate_candidates(uuid, text, text, date, uuid),
  public.person_search(uuid, text, int),
  public.supersede_person(uuid, uuid, text),
  public.create_verification_application(uuid),
  public.submit_verification(uuid),
  public.review_verification(uuid),
  public.request_information(uuid, text),
  public.resubmit_verification(uuid),
  public.approve_verification(uuid, uuid),
  public.reject_verification(uuid, text, uuid),
  public.add_evidence_metadata(uuid, public.evidence_kind, text, bigint),
  public.confirm_evidence_upload(uuid, text, bigint),
  public.remove_evidence(uuid)
to authenticated;
-- enqueue_outbox stays owner-internal: no client role may enqueue directly,
-- so an intent can only exist as a side effect of a real domain mutation.
