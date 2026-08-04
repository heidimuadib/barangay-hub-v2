-- ============================================================================
-- Slice 3A · Document catalog and request domain functions
--
-- Same discipline as Slice 2A: authenticated clients hold NO insert/update/
-- delete grant on any table here. Every mutation flows through a SECURITY
-- DEFINER function that re-checks capability or ownership itself (fail
-- closed), so the RPC surface and the RLS grants cannot disagree. All
-- functions pin an empty search_path and fully qualify every name.
--
-- The resident and staff-assisted channels call functions that differ ONLY in
-- authorization and recorded channel, then converge on one table and one
-- submit/review path — the roadmap's "walk-in equals resident" requirement
-- (Slice 3 §3/§17), which pgTAP asserts field-by-field.
-- ============================================================================

-- ── Internal helpers ────────────────────────────────────────────────────────

create function public.caller_owns_request(p_request_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.document_requests dr
    join public.person_accounts pa on pa.person_id = dr.person_id
    where dr.id = p_request_id and pa.user_id = auth.uid()
  );
$$;

comment on function public.caller_owns_request is
  'Ownership through the account↔person link, mirroring caller_owns_application. A walk-in request with no linked account is owned by nobody and is reachable only through requests.read.';

-- Resolves the person the CALLER is, in one barangay. Null when the caller has
-- no person record there — which is the normal state for staff.
create function public.caller_person_in(p_barangay_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select pa.person_id
  from public.person_accounts pa
  where pa.user_id = auth.uid() and pa.barangay_id = p_barangay_id;
$$;

-- ── Catalog visibility rule, shared by RLS and the functions ────────────────
-- Kept as a function so the "residents see active types only" rule exists in
-- exactly one place.

create function public.document_type_is_visible(p_document_type_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.document_types dt
    where dt.id = p_document_type_id
      and (
        (dt.is_active and public.auth_is_active_member(dt.barangay_id))
        or public.auth_has_permission(dt.barangay_id, 'documents.catalog.read')
      )
  );
$$;

-- ── Catalog management (documents.catalog.manage) ───────────────────────────

create function public.create_document_type(
  p_barangay_id uuid,
  p_code text,
  p_name text,
  p_description text default null,
  p_fee_amount numeric default null,
  p_sla_days integer default null,
  p_validity_days integer default null,
  p_requires_supporting_evidence boolean default false
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not public.auth_has_permission(p_barangay_id, 'documents.catalog.manage') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;

  -- values_are_placeholder is NOT a parameter. A row created through this
  -- function is placeholder by definition: confirming the fee schedule is an
  -- owner act recorded against blocker B-08, not something a caller asserts
  -- while creating a document type.
  insert into public.document_types
    (barangay_id, code, name, description, fee_amount, sla_days, validity_days,
     requires_supporting_evidence)
  values
    (p_barangay_id, p_code, p_name, p_description, p_fee_amount, p_sla_days,
     p_validity_days, coalesce(p_requires_supporting_evidence, false))
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.create_document_type is
  'Adds a document type (documents.catalog.manage). The row is always created with values_are_placeholder = true: B-08 confirmation is an owner decision, not a caller-supplied flag.';

create function public.add_document_type_requirement(
  p_document_type_id uuid,
  p_key text,
  p_label text,
  p_input_kind public.requirement_input_kind default 'text',
  p_is_required boolean default true,
  p_help_text text default null,
  p_options jsonb default '[]'::jsonb,
  p_sort_order integer default 0
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare v_barangay uuid; v_id uuid;
begin
  select dt.barangay_id into v_barangay
  from public.document_types dt where dt.id = p_document_type_id;
  -- Not found and not authorized are indistinguishable (Phase 4 §13.6).
  if v_barangay is null
     or not public.auth_has_permission(v_barangay, 'documents.catalog.manage') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;

  insert into public.document_type_requirements
    (barangay_id, document_type_id, key, label, help_text, input_kind,
     is_required, options, sort_order)
  values
    (v_barangay, p_document_type_id, p_key, p_label, p_help_text, p_input_kind,
     coalesce(p_is_required, true), coalesce(p_options, '[]'::jsonb),
     coalesce(p_sort_order, 0))
  returning id into v_id;

  return v_id;
end;
$$;

-- ── Request creation: two channels, one table (roadmap Slice 3 §3) ──────────

create function public.create_own_request(
  p_barangay_id uuid,
  p_document_type_id uuid,
  p_purpose text
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare v_person_id uuid; v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  -- The caller must BE a person in this barangay. An account alone is not
  -- enough — that is the Slice 2 rule that an account proves nothing.
  v_person_id := public.caller_person_in(p_barangay_id);
  if v_person_id is null then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;

  -- An inactive or cross-tenant type is not requestable, and both are
  -- reported identically.
  if not exists (
    select 1 from public.document_types dt
    where dt.id = p_document_type_id
      and dt.barangay_id = p_barangay_id
      and dt.is_active
  ) then
    raise exception 'DOCUMENT_TYPE_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.document_requests
    (barangay_id, document_type_id, person_id, source_channel, purpose)
  values
    (p_barangay_id, p_document_type_id, v_person_id, 'self', p_purpose)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

comment on function public.create_own_request is
  'Resident self-service request creation. Requires the caller to be a person in the barangay; the type must be active. Creates a DRAFT — nothing reaches the queue until submit_request.';

create function public.create_walk_in_request(
  p_barangay_id uuid,
  p_person_id uuid,
  p_document_type_id uuid,
  p_purpose text,
  p_reason text
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare v_request_id uuid;
begin
  if not public.auth_has_permission(p_barangay_id, 'requests.create_walk_in') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;

  -- The person must exist IN THIS TENANT. The composite FK would catch a
  -- cross-tenant id anyway; checking here makes the refusal uniform rather
  -- than a raw constraint error.
  if not exists (
    select 1 from public.persons p
    where p.id = p_person_id and p.barangay_id = p_barangay_id
      and p.superseded_by is null
  ) then
    raise exception 'PERSON_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  -- Staff may file against an inactive type only if they can see the whole
  -- catalog; the active-type rule is otherwise identical to the self path.
  if not exists (
    select 1 from public.document_types dt
    where dt.id = p_document_type_id
      and dt.barangay_id = p_barangay_id
      and (dt.is_active
           or public.auth_has_permission(p_barangay_id, 'documents.catalog.read'))
  ) then
    raise exception 'DOCUMENT_TYPE_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.document_requests
    (barangay_id, document_type_id, person_id, source_channel, purpose,
     creation_reason)
  values
    (p_barangay_id, p_document_type_id, p_person_id, 'staff', p_purpose,
     p_reason)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

comment on function public.create_walk_in_request is
  'Staff-assisted request creation (requests.create_walk_in). Produces a record identical to the resident path except source_channel/created_by/creation_reason — the roadmap''s walk-in-equals-resident requirement, asserted field-by-field in pgTAP.';

-- ── Answering the type's requirements ───────────────────────────────────────

create function public.set_request_answer(
  p_request_id uuid,
  p_requirement_id uuid,
  p_value text
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare v_req public.document_requests%rowtype; v_id uuid;
begin
  select * into v_req from public.document_requests where id = p_request_id;
  if v_req.id is null
     or not (public.caller_owns_request(p_request_id)
             or public.auth_has_permission(v_req.barangay_id, 'requests.create_walk_in')) then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;

  -- Answers are part of composing the request. Once submitted the record is
  -- what staff review, so it stops moving.
  if v_req.state <> 'draft' then
    raise exception 'REQUEST_NOT_EDITABLE' using errcode = 'P0001';
  end if;

  -- The requirement must belong to THIS request's type.
  if not exists (
    select 1 from public.document_type_requirements r
    where r.id = p_requirement_id
      and r.document_type_id = v_req.document_type_id
  ) then
    raise exception 'REQUIREMENT_NOT_APPLICABLE' using errcode = 'P0001';
  end if;

  insert into public.document_request_answers
    (barangay_id, request_id, requirement_id, value)
  values
    (v_req.barangay_id, p_request_id, p_requirement_id, p_value)
  on conflict (request_id, requirement_id)
    do update set value = excluded.value, updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.set_request_answer is
  'Records or replaces one answer while the request is still a draft. Idempotent per requirement; the value is validated against the requirement''s input_kind by trigger.';

-- ── Lifecycle ───────────────────────────────────────────────────────────────

create function public.submit_request(
  p_request_id uuid,
  p_correlation_id uuid default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_req public.document_requests%rowtype; v_missing integer;
begin
  select * into v_req from public.document_requests where id = p_request_id;
  if v_req.id is null
     or not (public.caller_owns_request(p_request_id)
             or public.auth_has_permission(v_req.barangay_id, 'requests.create_walk_in')) then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_req.state <> 'draft' then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001';
  end if;

  -- Completeness gate: every REQUIRED requirement of the type must have a
  -- non-blank answer. Checked here rather than by constraint because it is a
  -- property of the whole request, not of any single row.
  select count(*) into v_missing
  from public.document_type_requirements r
  where r.document_type_id = v_req.document_type_id
    and r.is_required
    and not exists (
      select 1 from public.document_request_answers a
      where a.request_id = p_request_id and a.requirement_id = r.id
    );

  if v_missing > 0 then
    raise exception 'REQUIREMENTS_INCOMPLETE' using errcode = 'P0001';
  end if;

  update public.document_requests
  set state = 'submitted', submitted_at = now()
  where id = p_request_id;

  -- NO outbox intent, deliberately. Submission is the requester's own action,
  -- confirmed on screen — the same ruling Slice 2 made for
  -- verification.submitted. Asserted in pgTAP so it stays deliberate.
end;
$$;

comment on function public.submit_request is
  'draft → submitted (owner, or staff holding requests.create_walk_in for the assisted path). Refuses until every required answer exists. Enqueues NO intent: the requester''s own action needs no notification.';

create function public.review_request(
  p_request_id uuid,
  p_correlation_id uuid default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_req public.document_requests%rowtype;
begin
  select * into v_req from public.document_requests where id = p_request_id;
  if v_req.id is null
     or not public.auth_has_permission(v_req.barangay_id, 'requests.review') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_req.state <> 'submitted' then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001';
  end if;

  update public.document_requests
  set state = 'in_review', review_started_at = now()
  where id = p_request_id;

  -- Intent in the same transaction. IDs only — no purpose, no answers, no
  -- name. A repeated call raises ILLEGAL_TRANSITION above, so no duplicate
  -- intent is reachable without bookkeeping.
  perform public.enqueue_outbox(
    v_req.barangay_id, 'request.in_review',
    jsonb_build_object('request_id', p_request_id, 'person_id', v_req.person_id),
    p_correlation_id);
end;
$$;

comment on function public.review_request is
  'submitted → in_review (requests.review). Enqueues request.in_review atomically — the requester learns that someone picked their request up.';

create function public.mark_request_ready(
  p_request_id uuid,
  p_correlation_id uuid default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_req public.document_requests%rowtype;
begin
  select * into v_req from public.document_requests where id = p_request_id;
  if v_req.id is null
     or not public.auth_has_permission(v_req.barangay_id, 'requests.mark_ready') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_req.state <> 'in_review' then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001';
  end if;

  update public.document_requests
  set state = 'ready_for_issue', ready_at = now()
  where id = p_request_id;

  perform public.enqueue_outbox(
    v_req.barangay_id, 'request.ready_for_issue',
    jsonb_build_object('request_id', p_request_id, 'person_id', v_req.person_id),
    p_correlation_id);
end;
$$;

comment on function public.mark_request_ready is
  'in_review → ready_for_issue (requests.mark_ready). The Slice 3 terminus and the Slice 4 hand-off point: issuance, serials and artifacts belong to that slice, not this one.';

-- ── Grants: deny first, then grant exactly the client surface ───────────────

revoke execute on function
  public.caller_owns_request(uuid),
  public.caller_person_in(uuid),
  public.document_type_is_visible(uuid),
  public.create_document_type(uuid, text, text, text, numeric, integer, integer, boolean),
  public.add_document_type_requirement(uuid, text, text, public.requirement_input_kind, boolean, text, jsonb, integer),
  public.create_own_request(uuid, uuid, text),
  public.create_walk_in_request(uuid, uuid, uuid, text, text),
  public.set_request_answer(uuid, uuid, text),
  public.submit_request(uuid, uuid),
  public.review_request(uuid, uuid),
  public.mark_request_ready(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.caller_owns_request(uuid),
  public.document_type_is_visible(uuid),
  public.create_document_type(uuid, text, text, text, numeric, integer, integer, boolean),
  public.add_document_type_requirement(uuid, text, text, public.requirement_input_kind, boolean, text, jsonb, integer),
  public.create_own_request(uuid, uuid, text),
  public.create_walk_in_request(uuid, uuid, uuid, text, text),
  public.set_request_answer(uuid, uuid, text),
  public.submit_request(uuid, uuid),
  public.review_request(uuid, uuid),
  public.mark_request_ready(uuid, uuid)
to authenticated;

-- caller_person_in stays internal: it answers "who is the caller here", which
-- is a building block for the functions above, not a client query.
