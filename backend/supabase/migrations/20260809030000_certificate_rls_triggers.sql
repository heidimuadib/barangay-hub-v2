-- ============================================================================
-- Slice 4A · Certificate RLS, immutability guards, and same-transaction audit
--
-- Identical discipline to Slices 2A and 3A: writes NEVER flow through table
-- grants, so the grant surface for `authenticated` is SELECT-only and `anon`
-- holds nothing at all — including on certificates.
--
-- The `anon` position is worth stating explicitly because Slice 4 ships a
-- PUBLIC verification surface. That surface will NOT be an anon table grant:
-- opening `certificates` to anonymous SELECT would make the table an
-- enumeration oracle no matter how narrow the policy. 4D reads it through the
-- `public-certificate-verification` service-role path the allow-list already
-- reserved, returning a fixed, PII-free shape. This migration therefore grants
-- `anon` nothing, and pgTAP asserts that it stays that way.
-- ============================================================================

-- ── updated_at ──────────────────────────────────────────────────────────────

create trigger certificate_templates_set_updated_at
  before update on public.certificate_templates
  for each row execute function public.set_updated_at();

create trigger certificate_series_set_updated_at
  before update on public.certificate_series
  for each row execute function public.set_updated_at();

create trigger certificates_set_updated_at
  before update on public.certificates
  for each row execute function public.set_updated_at();

-- ── Immutability: an issued certificate's identity is history ───────────────

create function public.certificates_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Everything that identifies WHAT was issued, to WHOM, under WHICH number
  -- is a historical fact. A certificate someone is holding cannot be edited
  -- underneath them.
  if new.barangay_id <> old.barangay_id
     or new.request_id <> old.request_id
     or new.person_id <> old.person_id
     or new.template_id <> old.template_id
     or new.series_id <> old.series_id then
    raise exception 'certificate identity is immutable';
  end if;

  if new.serial_sequence <> old.serial_sequence
     or new.serial_display <> old.serial_display then
    raise exception 'certificate serial is immutable';
  end if;

  -- Rotating the token would silently invalidate a QR code already printed on
  -- paper in somebody's hand. If rotation is ever needed it is a new
  -- certificate, not an edit.
  if new.verification_token <> old.verification_token then
    raise exception 'verification token is immutable';
  end if;

  if new.issued_at <> old.issued_at
     or new.issued_by is distinct from old.issued_by then
    raise exception 'issuance provenance is immutable';
  end if;

  -- The only legal transition. There is deliberately no path back from
  -- voided: reinstating a withdrawn certificate would leave the serial book
  -- ambiguous about which numbers are live.
  if new.status is distinct from old.status then
    if not (old.status = 'issued' and new.status = 'voided') then
      raise exception 'ILLEGAL_TRANSITION';
    end if;
  end if;

  return new;
end;
$$;

create trigger certificates_guard
  before update on public.certificates
  for each row execute function public.certificates_guard();

create function public.certificates_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Actor stamped server-side, never accepted from a caller.
    new.issued_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger certificates_before_write
  before insert on public.certificates
  for each row execute function public.certificates_before_write();

-- A void record is written once and never revised: it is the explanation for a
-- gap in an accountable book.
create function public.certificate_voids_immutable()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  raise exception 'certificate_voids is append-only';
end;
$$;

create trigger certificate_voids_immutable
  before update or delete on public.certificate_voids
  for each row execute function public.certificate_voids_immutable();

-- The serial counter never moves backwards. Enforced at the TABLE so even an
-- owner-path mistake — a seed, a future function, a manual correction — cannot
-- silently make a number available for reuse.
create function public.certificate_series_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.barangay_id <> old.barangay_id or new.year <> old.year then
    raise exception 'series identity is immutable';
  end if;
  if new.next_sequence < old.next_sequence then
    raise exception 'SERIAL_SEQUENCE_CANNOT_REWIND';
  end if;
  return new;
end;
$$;

create trigger certificate_series_guard
  before update on public.certificate_series
  for each row execute function public.certificate_series_guard();

-- ── Audit ───────────────────────────────────────────────────────────────────
--
-- What may appear: ids, the template/series involved, the serial SEQUENCE, and
-- whether a reason exists. What may never: the resident's name, address or
-- birthdate, the certificate body, the void reason's text, the artifact path,
-- the signed URL, and — above all — the verification token, which is a bearer
-- credential printed on paper.
--
-- The serial SEQUENCE is recorded because accountability is the point of this
-- slice: an audit trail that cannot say which number was consumed cannot
-- answer the question the serial book exists to answer. It is a per-tenant
-- counter, not personal data.

create function public.certificates_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.append_audit_entry(
      'certificate.issued', 'certificate', new.id::text, new.barangay_id,
      jsonb_build_object('request_id', new.request_id,
                         'template_id', new.template_id,
                         'series_id', new.series_id,
                         'serial_sequence', new.serial_sequence,
                         'serial_is_placeholder', new.serial_is_placeholder),
      'success', 'db');
    return new;
  end if;

  if new.status is distinct from old.status and new.status = 'voided' then
    perform public.append_audit_entry(
      'certificate.voided', 'certificate', new.id::text, new.barangay_id,
      -- The serial, so the book stays answerable. NOT the reason.
      jsonb_build_object('serial_sequence', new.serial_sequence),
      'success', 'db');
  end if;
  return new;
end;
$$;

create trigger certificates_audit
  after insert or update on public.certificates
  for each row execute function public.certificates_audit();

create function public.certificate_voids_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.append_audit_entry(
    'certificate.void_recorded', 'certificate_void', new.id::text,
    new.barangay_id,
    -- PRESENCE, never content — the same rule Slice 2 applies to rejection
    -- reasons and information-request notes.
    jsonb_build_object('certificate_id', new.certificate_id,
                       'reason_present', true),
    'success', 'db');
  return new;
end;
$$;

create trigger certificate_voids_audit
  after insert on public.certificate_voids
  for each row execute function public.certificate_voids_audit();

create function public.certificate_templates_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_changed text[];
begin
  if tg_op = 'INSERT' then
    -- The code is a slug by CHECK, so it is safe to record. The BODY is the
    -- barangay's legal prose and never enters an audit row.
    perform public.append_audit_entry(
      'certificate.template_created', 'certificate_template', new.id::text,
      new.barangay_id,
      jsonb_build_object('code', new.code,
                         'document_type_id', new.document_type_id,
                         'content_is_placeholder', new.content_is_placeholder),
      'success', 'db');
    return new;
  end if;

  select coalesce(array_agg(n.key order by n.key), '{}') into v_changed
  from jsonb_each(to_jsonb(new)) n
  join jsonb_each(to_jsonb(old)) o on o.key = n.key
  where n.value is distinct from o.value and n.key <> 'updated_at';

  if array_length(v_changed, 1) is not null then
    perform public.append_audit_entry(
      'certificate.template_updated', 'certificate_template', new.id::text,
      new.barangay_id,
      -- Field NAMES only, plus the flag whose FLIP is the honesty-relevant
      -- event: declaring the wording and signatories approved (B-05/-06/-07).
      jsonb_build_object('code', new.code, 'fields', to_jsonb(v_changed))
        || case
             when new.content_is_placeholder is distinct from old.content_is_placeholder
               then jsonb_build_object('content_is_placeholder', new.content_is_placeholder)
             else '{}'::jsonb
           end,
      'success', 'db');
  end if;
  return new;
end;
$$;

create trigger certificate_templates_audit
  after insert or update on public.certificate_templates
  for each row execute function public.certificate_templates_audit();

create function public.certificate_series_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.append_audit_entry(
      'certificate.series_created', 'certificate_series', new.id::text,
      new.barangay_id,
      jsonb_build_object('year', new.year,
                         'format_is_placeholder', new.format_is_placeholder),
      'success', 'db');
    return new;
  end if;

  -- Advancing the counter is not an event — it happens on every issuance and
  -- is already audited there. Flipping the placeholder flag, or retiring a
  -- book, IS: both change what the numbers mean.
  if new.format_is_placeholder is distinct from old.format_is_placeholder
     or new.is_active is distinct from old.is_active then
    perform public.append_audit_entry(
      'certificate.series_updated', 'certificate_series', new.id::text,
      new.barangay_id,
      jsonb_build_object('year', new.year,
                         'format_is_placeholder', new.format_is_placeholder,
                         'is_active', new.is_active),
      'success', 'db');
  end if;
  return new;
end;
$$;

create trigger certificate_series_audit
  after insert or update on public.certificate_series
  for each row execute function public.certificate_series_audit();

create function public.certificate_artifacts_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.append_audit_entry(
    'certificate.artifact_registered', 'certificate_artifact', new.id::text,
    new.barangay_id,
    -- The certificate it belongs to and its type. NEVER the storage path.
    jsonb_build_object('certificate_id', new.certificate_id,
                       'mime_type', new.mime_type),
    'success', 'db');
  return new;
end;
$$;

create trigger certificate_artifacts_audit
  after insert on public.certificate_artifacts
  for each row execute function public.certificate_artifacts_audit();

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.certificate_templates enable row level security;
alter table public.certificate_templates force  row level security;
alter table public.certificate_series    enable row level security;
alter table public.certificate_series    force  row level security;
alter table public.certificates          enable row level security;
alter table public.certificates          force  row level security;
alter table public.certificate_voids     enable row level security;
alter table public.certificate_voids     force  row level security;
alter table public.certificate_artifacts enable row level security;
alter table public.certificate_artifacts force  row level security;

revoke all on public.certificate_templates,
              public.certificate_series,
              public.certificates,
              public.certificate_voids,
              public.certificate_artifacts
  from public, anon, authenticated;

grant select on public.certificate_templates to authenticated;
grant select on public.certificate_series    to authenticated;
grant select on public.certificates          to authenticated;
grant select on public.certificate_voids     to authenticated;
grant select on public.certificate_artifacts to authenticated;

-- System policies (forced RLS re-opened explicitly for owner paths).
create policy certificate_templates_system_all on public.certificate_templates
  as permissive for all to postgres, service_role using (true) with check (true);
create policy certificate_series_system_all on public.certificate_series
  as permissive for all to postgres, service_role using (true) with check (true);
create policy certificates_system_all on public.certificates
  as permissive for all to postgres, service_role using (true) with check (true);
create policy certificate_voids_system_all on public.certificate_voids
  as permissive for all to postgres, service_role using (true) with check (true);
create policy certificate_artifacts_system_all on public.certificate_artifacts
  as permissive for all to postgres, service_role using (true) with check (true);

-- Templates and the serial book are STAFF-FACING reference data, not resident
-- data: a resident has no reason to read a template body or a serial counter,
-- so neither carries a self-scoped branch.
create policy certificate_templates_select on public.certificate_templates
  for select to authenticated
  using (public.auth_has_permission(barangay_id, 'certificates.read'));

create policy certificate_series_select on public.certificate_series
  for select to authenticated
  using (public.auth_has_permission(barangay_id, 'certificates.read'));

-- A resident reads their OWN certificates; staff read their tenant's under
-- capability. A certificate issued to an account-less walk-in has no owner and
-- is reachable only by capability — the same shape as document_requests.
create policy certificates_select on public.certificates
  for select to authenticated
  using (
    public.caller_owns_certificate(id)
    or public.auth_has_permission(barangay_id, 'certificates.read')
  );

-- The void record follows its certificate, so a resident can see that their
-- certificate was withdrawn rather than finding it silently invalid.
create policy certificate_voids_select on public.certificate_voids
  for select to authenticated
  using (
    public.caller_owns_certificate(certificate_id)
    or public.auth_has_permission(barangay_id, 'certificates.read')
  );

-- Artifact METADATA carries its own capability, mirroring D2-04's ruling for
-- verification evidence: the file is the most sensitive surface, and reading
-- the queue is not the same as opening the document. The owner reaches their
-- own artifact for the resident download in 4B.
create policy certificate_artifacts_select on public.certificate_artifacts
  for select to authenticated
  using (
    public.caller_owns_certificate(certificate_id)
    or public.auth_has_permission(barangay_id, 'certificates.artifact.read')
  );
