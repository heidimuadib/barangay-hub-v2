-- ============================================================================
-- Slice 2A · Registry triggers: search text, validation, freezing,
-- transition defence, and same-transaction audit
--
-- The definer functions are the only client write path, but these triggers
-- bind the invariants to the TABLES, so even owner-path code (seeds, future
-- functions, a mistaken migration) cannot violate them silently.
-- ============================================================================

-- ── updated_at ──────────────────────────────────────────────────────────────

create trigger persons_set_updated_at
  before update on public.persons
  for each row execute function public.set_updated_at();

create trigger verification_applications_set_updated_at
  before update on public.verification_applications
  for each row execute function public.set_updated_at();

-- ── persons: derivation, validation, immutability, freezing ─────────────────

create function public.persons_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_requires boolean;
begin
  -- Search text is derived, never client-supplied (Phase 4 §19): trigram
  -- candidate matching over lower(unaccent(names)).
  new.search_text := lower(extensions.unaccent(
    coalesce(new.first_name, '') || ' ' ||
    coalesce(new.middle_name, '') || ' ' ||
    coalesce(new.last_name, '')));

  -- D2-01: 'other' requires an explanation; every other basis must NOT carry
  -- one (no stray narrative).
  select rb.requires_explanation into v_requires
  from public.residency_bases rb where rb.key = new.residency_basis_key;
  if v_requires and (new.residency_basis_explanation is null
                     or btrim(new.residency_basis_explanation) = '') then
    raise exception 'RESIDENCY_EXPLANATION_REQUIRED';
  end if;
  if not v_requires then
    new.residency_basis_explanation := null;
  end if;

  if tg_op = 'INSERT' then
    -- ADR-0006 point 7: actor stamped server-side; staff channel requires a
    -- reason.
    new.created_by := auth.uid();
    if new.source_channel = 'staff'
       and (new.creation_reason is null or btrim(new.creation_reason) = '') then
      raise exception 'CREATION_REASON_REQUIRED';
    end if;
    if new.source_channel = 'self' then
      new.creation_reason := null;
    end if;
    return new;
  end if;

  -- UPDATE path.
  if new.barangay_id <> old.barangay_id then
    raise exception 'persons.barangay_id is immutable';
  end if;
  if new.source_channel <> old.source_channel
     or new.created_by is distinct from old.created_by
     or new.creation_reason is distinct from old.creation_reason then
    raise exception 'person provenance is immutable';
  end if;

  -- D2-02: a superseded person is FROZEN — history, not a working record.
  if old.superseded_by is not null then
    raise exception 'PERSON_FROZEN';
  end if;
  -- The supersede operation itself may change ONLY the supersede fields.
  if new.superseded_by is not null then
    if to_jsonb(new) - 'superseded_by' - 'superseded_at' - 'superseded_reason'
         - 'updated_at'
       <> to_jsonb(old) - 'superseded_by' - 'superseded_at' - 'superseded_reason'
         - 'updated_at' then
      raise exception 'supersede may not modify other person fields';
    end if;
  end if;

  return new;
end;
$$;

create trigger persons_before_write
  before insert or update on public.persons
  for each row execute function public.persons_before_write();

create function public.persons_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_changed text[];
begin
  if tg_op = 'INSERT' then
    perform public.append_audit_entry(
      'person.created', 'person', new.id::text, new.barangay_id,
      jsonb_build_object('source_channel', new.source_channel), 'success', 'db');
    return new;
  end if;

  if old.superseded_by is null and new.superseded_by is not null then
    perform public.append_audit_entry(
      'person.superseded', 'person', new.id::text, new.barangay_id,
      jsonb_build_object('survivor_id', new.superseded_by), 'success', 'db');
    return new;
  end if;

  -- Field NAMES only — values are personal data (Phase 6 §37.2).
  select coalesce(array_agg(n.key order by n.key), '{}') into v_changed
  from jsonb_each(to_jsonb(new)) n
  join jsonb_each(to_jsonb(old)) o on o.key = n.key
  where n.value is distinct from o.value
    and n.key not in ('updated_at', 'search_text');

  if array_length(v_changed, 1) is not null then
    perform public.append_audit_entry(
      'person.updated', 'person', new.id::text, new.barangay_id,
      jsonb_build_object('fields', to_jsonb(v_changed)), 'success', 'db');
  end if;
  return new;
end;
$$;

create trigger persons_audit
  after insert or update on public.persons
  for each row execute function public.persons_audit();

-- ── person_accounts: stamping, immutability, audit ──────────────────────────

create function public.person_accounts_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.linked_by := auth.uid();
    new.linked_at := now();
    return new;
  end if;
  -- Links are never edited — only created and removed (both audited).
  raise exception 'person_accounts rows are immutable — unlink and relink';
end;
$$;

create trigger person_accounts_before_write
  before insert or update on public.person_accounts
  for each row execute function public.person_accounts_before_write();

create function public.person_accounts_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_reason text;
begin
  if tg_op = 'INSERT' then
    perform public.append_audit_entry(
      'person_account.linked', 'person_account', new.person_id::text,
      new.barangay_id,
      jsonb_build_object('user_id', new.user_id), 'success', 'db');
    return new;
  end if;

  v_reason := nullif(btrim(coalesce(
    current_setting('app.unlink_reason', true), '')), '');
  perform public.append_audit_entry(
    'person_account.unlinked', 'person_account', old.person_id::text,
    old.barangay_id,
    jsonb_build_object('user_id', old.user_id)
      || case when v_reason is null then '{}'::jsonb
              else jsonb_build_object('reason', v_reason) end,
    'success', 'db');
  return old;
end;
$$;

create trigger person_accounts_audit
  after insert or delete on public.person_accounts
  for each row execute function public.person_accounts_audit();

-- ── verification_applications: transition defence + audit ───────────────────

create function public.verification_applications_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.barangay_id <> old.barangay_id or new.person_id <> old.person_id then
    raise exception 'application identity is immutable';
  end if;

  -- Terminal states are locked outright: a new application is the only way
  -- forward (roadmap Slice 2 §4).
  if old.state in ('approved', 'rejected') then
    raise exception 'APPLICATION_FINAL';
  end if;

  if new.state is distinct from old.state then
    if not (
      (old.state = 'draft'          and new.state = 'submitted') or
      (old.state = 'submitted'      and new.state = 'in_review') or
      (old.state = 'resubmitted'    and new.state = 'in_review') or
      (old.state = 'in_review'      and new.state = 'info_requested') or
      (old.state = 'in_review'      and new.state = 'approved') or
      (old.state = 'in_review'      and new.state = 'rejected') or
      (old.state = 'info_requested' and new.state = 'resubmitted')
    ) then
      raise exception 'ILLEGAL_TRANSITION';
    end if;

    if new.state = 'rejected'
       and (new.decision_reason is null or btrim(new.decision_reason) = '') then
      raise exception 'REASON_REQUIRED';
    end if;
    if new.state in ('approved', 'rejected') and new.decided_at is null then
      raise exception 'DECISION_TIMESTAMP_REQUIRED';
    end if;
  end if;

  return new;
end;
$$;

create trigger verification_applications_guard
  before update on public.verification_applications
  for each row execute function public.verification_applications_guard();

create function public.verification_applications_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.state is distinct from old.state then
    if old.state = 'draft' and new.state = 'submitted' then
      perform public.append_audit_entry(
        'verification.submitted', 'verification_application', new.id::text,
        new.barangay_id, '{}'::jsonb, 'success', 'db');
    else
      perform public.append_audit_entry(
        'verification.state_changed', 'verification_application', new.id::text,
        new.barangay_id,
        jsonb_build_object('from_state', old.state, 'to_state', new.state),
        'success', 'db');
    end if;
  end if;
  return new;
end;
$$;

create trigger verification_applications_audit
  after update on public.verification_applications
  for each row execute function public.verification_applications_audit();

-- ── verification_evidence: confirmation-only updates + audit ────────────────

create function public.verification_evidence_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Only the upload-confirmation fields may ever change.
  if to_jsonb(new) - 'uploaded_at' - 'content_hash' - 'size_bytes'
     <> to_jsonb(old) - 'uploaded_at' - 'content_hash' - 'size_bytes' then
    raise exception 'evidence metadata is immutable after creation';
  end if;
  return new;
end;
$$;

create trigger verification_evidence_guard
  before update on public.verification_evidence
  for each row execute function public.verification_evidence_guard();

create function public.verification_evidence_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Kind and MIME only — the opaque path and never a filename
    -- (roadmap §11: no filenames containing PII).
    perform public.append_audit_entry(
      'verification.evidence_added', 'verification_evidence', new.id::text,
      new.barangay_id,
      jsonb_build_object('application_id', new.application_id,
                         'kind', new.kind, 'mime_type', new.mime_type),
      'success', 'db');
    return new;
  end if;
  perform public.append_audit_entry(
    'verification.evidence_removed', 'verification_evidence', old.id::text,
    old.barangay_id,
    jsonb_build_object('application_id', old.application_id, 'kind', old.kind),
    'success', 'db');
  return old;
end;
$$;

create trigger verification_evidence_audit
  after insert or delete on public.verification_evidence
  for each row execute function public.verification_evidence_audit();

-- ── outbox_events: dispatch-only mutation + audit ───────────────────────────

create function public.outbox_events_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- Retention/cleanup is a Slice 8/9 policy decision, not an ad-hoc DELETE.
    raise exception 'outbox_events rows are not deletable';
  end if;
  if to_jsonb(new) - 'dispatch_status' - 'dispatched_at'
     <> to_jsonb(old) - 'dispatch_status' - 'dispatched_at' then
    raise exception 'only dispatch bookkeeping may change on outbox_events';
  end if;
  return new;
end;
$$;

create trigger outbox_events_guard
  before update or delete on public.outbox_events
  for each row execute function public.outbox_events_guard();

create function public.outbox_events_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.append_audit_entry(
    'outbox.enqueued', 'outbox_event', new.id::text, new.barangay_id,
    jsonb_build_object('event_type', new.event_type), 'success', 'db');
  return new;
end;
$$;

create trigger outbox_events_audit
  after insert on public.outbox_events
  for each row execute function public.outbox_events_audit();
