-- ============================================================================
-- Slice 3A · Catalog and request triggers: validation, transition defence,
-- immutability, and same-transaction audit
--
-- The definer functions are the only client write path, but these triggers
-- bind the invariants to the TABLES, so even owner-path code (seeds, a future
-- function, a mistaken migration) cannot violate them silently. This is the
-- Slice 2A pattern, applied to the same kinds of invariant.
-- ============================================================================

-- ── updated_at ──────────────────────────────────────────────────────────────

create trigger document_types_set_updated_at
  before update on public.document_types
  for each row execute function public.set_updated_at();

create trigger document_requests_set_updated_at
  before update on public.document_requests
  for each row execute function public.set_updated_at();

create trigger document_request_answers_set_updated_at
  before update on public.document_request_answers
  for each row execute function public.set_updated_at();

-- ── document_types: tenant immutability + audit ─────────────────────────────

create function public.document_types_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.barangay_id <> old.barangay_id then
      raise exception 'document_types.barangay_id is immutable';
    end if;
    -- The code appears in URLs and audit metadata; letting it change would
    -- silently re-point history at a different document.
    if new.code <> old.code then
      raise exception 'document_types.code is immutable';
    end if;
  end if;
  return new;
end;
$$;

create trigger document_types_before_write
  before insert or update on public.document_types
  for each row execute function public.document_types_before_write();

create function public.document_types_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_changed text[];
begin
  if tg_op = 'INSERT' then
    perform public.append_audit_entry(
      'catalog.document_type_created', 'document_type', new.id::text,
      new.barangay_id,
      -- The code is a slug by CHECK, so it is safe to record; the name and
      -- description are barangay-authored prose and stay off the audit row.
      jsonb_build_object('code', new.code,
                         'values_are_placeholder', new.values_are_placeholder),
      'success', 'db');
    return new;
  end if;

  -- Field NAMES only, plus the two flags whose FLIP is the security- and
  -- honesty-relevant event: activating a type, and declaring its fee schedule
  -- confirmed (B-08). Values of prose fields are never recorded.
  select coalesce(array_agg(n.key order by n.key), '{}') into v_changed
  from jsonb_each(to_jsonb(new)) n
  join jsonb_each(to_jsonb(old)) o on o.key = n.key
  where n.value is distinct from o.value
    and n.key <> 'updated_at';

  if array_length(v_changed, 1) is not null then
    perform public.append_audit_entry(
      'catalog.document_type_updated', 'document_type', new.id::text,
      new.barangay_id,
      jsonb_build_object('code', new.code, 'fields', to_jsonb(v_changed))
        || case
             when new.is_active is distinct from old.is_active
               then jsonb_build_object('is_active', new.is_active)
             else '{}'::jsonb
           end
        || case
             when new.values_are_placeholder is distinct from old.values_are_placeholder
               then jsonb_build_object('values_are_placeholder', new.values_are_placeholder)
             else '{}'::jsonb
           end,
      'success', 'db');
  end if;
  return new;
end;
$$;

create trigger document_types_audit
  after insert or update on public.document_types
  for each row execute function public.document_types_audit();

-- ── document_type_requirements: options/kind coherence ──────────────────────

create function public.document_type_requirements_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- A `select` without choices is an unanswerable question; choices on any
  -- other kind are dead data that a form would silently ignore.
  if new.input_kind = 'select' then
    if jsonb_typeof(new.options) <> 'array' or jsonb_array_length(new.options) = 0 then
      raise exception 'SELECT_REQUIRES_OPTIONS';
    end if;
  elsif jsonb_array_length(coalesce(new.options, '[]'::jsonb)) > 0 then
    raise exception 'OPTIONS_NOT_APPLICABLE';
  end if;
  return new;
end;
$$;

create trigger document_type_requirements_before_write
  before insert or update on public.document_type_requirements
  for each row execute function public.document_type_requirements_before_write();

-- ── document_requests: transition defence + audit ───────────────────────────

create function public.document_requests_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.barangay_id <> old.barangay_id
     or new.person_id <> old.person_id
     or new.document_type_id <> old.document_type_id then
    raise exception 'request identity is immutable';
  end if;

  -- Provenance is a historical fact.
  if new.source_channel <> old.source_channel
     or new.created_by is distinct from old.created_by
     or new.creation_reason is distinct from old.creation_reason then
    raise exception 'request provenance is immutable';
  end if;

  if new.state is distinct from old.state then
    -- Roadmap Slice 3 §4. The TypeScript mirror in
    -- apps/web/src/features/documents/rules/request-transitions.ts must match
    -- this map exactly; where they disagree, this is the authority.
    if not (
      (old.state = 'draft'     and new.state = 'submitted') or
      (old.state = 'submitted' and new.state = 'in_review') or
      (old.state = 'in_review' and new.state = 'ready_for_issue')
    ) then
      raise exception 'ILLEGAL_TRANSITION';
    end if;

    -- Each state owns a timestamp, and arriving without it would leave the
    -- queue unable to order itself.
    if new.state = 'submitted'       and new.submitted_at is null then
      raise exception 'SUBMITTED_TIMESTAMP_REQUIRED';
    end if;
    if new.state = 'in_review'       and new.review_started_at is null then
      raise exception 'REVIEW_TIMESTAMP_REQUIRED';
    end if;
    if new.state = 'ready_for_issue' and new.ready_at is null then
      raise exception 'READY_TIMESTAMP_REQUIRED';
    end if;
  end if;

  -- The purpose is what staff reviewed; it cannot be rewritten underneath a
  -- decision once the request has left draft.
  if old.state <> 'draft' and new.purpose is distinct from old.purpose then
    raise exception 'REQUEST_NOT_EDITABLE';
  end if;

  return new;
end;
$$;

create trigger document_requests_guard
  before update on public.document_requests
  for each row execute function public.document_requests_guard();

create function public.document_requests_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Actor stamped server-side; the assisted channel must say why, exactly
    -- as persons does (ADR-0006 point 7).
    new.created_by := auth.uid();
    if new.source_channel = 'staff'
       and (new.creation_reason is null or btrim(new.creation_reason) = '') then
      raise exception 'CREATION_REASON_REQUIRED';
    end if;
    if new.source_channel = 'self' then
      new.creation_reason := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger document_requests_before_write
  before insert on public.document_requests
  for each row execute function public.document_requests_before_write();

create function public.document_requests_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Channel and type only. The purpose is personal free text and never
    -- appears here (Phase 6 §37.2).
    perform public.append_audit_entry(
      'request.created', 'document_request', new.id::text, new.barangay_id,
      jsonb_build_object('source_channel', new.source_channel,
                         'document_type_id', new.document_type_id),
      'success', 'db');
    return new;
  end if;

  if new.state is distinct from old.state then
    if old.state = 'draft' and new.state = 'submitted' then
      perform public.append_audit_entry(
        'request.submitted', 'document_request', new.id::text, new.barangay_id,
        -- How many answers accompanied the submission — a completeness
        -- signal that carries no answer CONTENT.
        jsonb_build_object('answer_count',
          (select count(*) from public.document_request_answers a
           where a.request_id = new.id)),
        'success', 'db');
    else
      perform public.append_audit_entry(
        'request.state_changed', 'document_request', new.id::text,
        new.barangay_id,
        jsonb_build_object('from_state', old.state, 'to_state', new.state),
        'success', 'db');
    end if;
  end if;
  return new;
end;
$$;

create trigger document_requests_audit
  after insert or update on public.document_requests
  for each row execute function public.document_requests_audit();

-- ── document_request_answers: typed validation + immutability after draft ───

create function public.document_request_answers_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_kind public.requirement_input_kind; v_options jsonb; v_state public.document_request_state;
begin
  select r.input_kind, r.options into v_kind, v_options
  from public.document_type_requirements r where r.id = new.requirement_id;

  select dr.state into v_state
  from public.document_requests dr where dr.id = new.request_id;

  -- Answers belong to the composition phase. After submission the answer set
  -- is what staff are reviewing.
  if v_state <> 'draft' then
    raise exception 'REQUEST_NOT_EDITABLE';
  end if;

  -- Validate the text against the declared kind. Storing everything as text
  -- keeps the answer set queryable as a unit; this is where it earns its type.
  case v_kind
    when 'number' then
      if new.value !~ '^-?[0-9]+(\.[0-9]+)?$' then
        raise exception 'ANSWER_NOT_A_NUMBER';
      end if;
    when 'date' then
      begin
        perform new.value::date;
      exception when others then
        raise exception 'ANSWER_NOT_A_DATE';
      end;
    when 'boolean' then
      if lower(new.value) not in ('true', 'false') then
        raise exception 'ANSWER_NOT_A_BOOLEAN';
      end if;
    when 'select' then
      if not (v_options ? new.value) then
        raise exception 'ANSWER_NOT_AN_OPTION';
      end if;
    else
      null; -- text / textarea: the length CHECK on the column is the rule.
  end case;

  return new;
end;
$$;

create trigger document_request_answers_before_write
  before insert or update on public.document_request_answers
  for each row execute function public.document_request_answers_before_write();
