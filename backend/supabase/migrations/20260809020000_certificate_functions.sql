-- ============================================================================
-- Slice 4A · Certificate domain functions
--
-- Same discipline as Slices 2A and 3A: authenticated clients hold NO insert,
-- update or delete grant on any table here. Every mutation flows through a
-- SECURITY DEFINER function that re-checks capability itself and fails closed,
-- pins an empty search_path, and fully qualifies every name.
--
-- The load-bearing function is `allocate_certificate_serial`. Everything the
-- roadmap means by "serial accountability" reduces to one property: two
-- concurrent issuances must never receive the same number, and a number once
-- handed out must never come back. That is enforced in three independent
-- places — a row lock, a unique constraint, and a counter that only moves
-- forward — because any one of them alone has a failure mode.
-- ============================================================================

-- ── Ownership helper ────────────────────────────────────────────────────────

create function public.caller_owns_certificate(p_certificate_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.certificates c
    join public.person_accounts pa on pa.person_id = c.person_id
    where c.id = p_certificate_id and pa.user_id = auth.uid()
  );
$$;

comment on function public.caller_owns_certificate is
  'Ownership through the account↔person link, mirroring caller_owns_request. A certificate issued to an account-less walk-in is owned by nobody and is reachable only through certificates.read.';

-- ── Serial formatting: presentation, separated from the counter ─────────────
--
-- Kept as a function so the rendering exists in exactly ONE place. A call site
-- that string-built its own serial would be free to disagree with history, and
-- `certificates.serial_display` is captured at issue time precisely so it
-- cannot be retroactively rewritten.
--
-- The format itself is UNCONFIRMED (roadmap Slice 4 §8). This shape —
-- PREFIX-YEAR-PADDEDSEQUENCE — is a synthetic local-development rendering, not
-- an approved barangay format, which is why every series carries
-- `format_is_placeholder` and every certificate carries the flag forward.

create function public.format_certificate_serial(
  p_prefix text,
  p_year integer,
  p_sequence integer,
  p_width integer
)
returns text
language sql immutable
as $$
  select p_prefix || '-' || p_year::text || '-' || lpad(p_sequence::text, p_width, '0');
$$;

comment on function public.format_certificate_serial is
  'Renders the accountable parts into a display string. IMMUTABLE and deterministic. The shape is a SYNTHETIC placeholder pending owner sign-off (roadmap Slice 4 §8) — never present its output as an official serial while the series is flagged.';

-- ── Series management ───────────────────────────────────────────────────────

create function public.create_certificate_series(
  p_barangay_id uuid,
  p_year integer,
  p_prefix text,
  p_sequence_width integer default 5
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not public.auth_has_permission(p_barangay_id, 'certificates.manage_series') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;

  -- format_is_placeholder is NOT a parameter, for the same reason
  -- values_are_placeholder is not one on document_types: confirming a serial
  -- format is an owner act recorded against the decision, not something a
  -- caller asserts while creating a book.
  insert into public.certificate_series
    (barangay_id, year, prefix, sequence_width)
  values
    (p_barangay_id, p_year, p_prefix, coalesce(p_sequence_width, 5))
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.create_certificate_series is
  'Opens an accountable serial book for one barangay-year (certificates.manage_series). Always created with format_is_placeholder = true.';

-- ── Template management ─────────────────────────────────────────────────────

create function public.create_certificate_template(
  p_barangay_id uuid,
  p_document_type_id uuid,
  p_code text,
  p_name text,
  p_body text,
  p_signatory_name text default null,
  p_signatory_title text default null
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not public.auth_has_permission(p_barangay_id, 'certificates.manage_templates') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;

  -- The type must belong to this tenant. The composite FK would catch a
  -- cross-tenant id anyway; checking here makes the refusal uniform rather
  -- than a raw constraint error (Phase 4 §13.6).
  if not exists (
    select 1 from public.document_types dt
    where dt.id = p_document_type_id and dt.barangay_id = p_barangay_id
  ) then
    raise exception 'DOCUMENT_TYPE_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  -- content_is_placeholder is likewise not a parameter: B-05/-06/-07 are
  -- owner approvals, not caller assertions.
  insert into public.certificate_templates
    (barangay_id, document_type_id, code, name, body, signatory_name, signatory_title)
  values
    (p_barangay_id, p_document_type_id, p_code, p_name, p_body,
     p_signatory_name, p_signatory_title)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.create_certificate_template is
  'Adds a certificate template (certificates.manage_templates). Always created with content_is_placeholder = true — confirming wording and signatories is an owner act against B-05/-06/-07.';

-- ── Serial allocation: the accountability primitive ─────────────────────────
--
-- INTERNAL. Not granted to any client role, and deliberately not callable on
-- its own: a serial allocated outside an issuance would be a number nobody can
-- account for. `issue_certificate` is the only caller.
--
-- Concurrency safety, three independent mechanisms:
--
--   1. `FOR UPDATE` on the series row serialises concurrent allocators. The
--      second transaction blocks until the first commits and then reads the
--      ADVANCED counter — not the stale one it would have read otherwise.
--   2. The counter only ever moves forward. There is no path that decrements
--      it, so a voided or abandoned number stays consumed. This is what the
--      roadmap means by "gap accountability": the gap is visible and explained
--      rather than backfilled.
--   3. `unique (series_id, serial_sequence)` on `certificates` means that even
--      if 1 and 2 were both wrong, the duplicate could not be WRITTEN.
--
-- Mechanism 3 is not redundancy for its own sake. Locks protect against
-- concurrency; a constraint protects against a future function that forgets to
-- take the lock.

create function public.allocate_certificate_serial(p_series_id uuid)
returns table (sequence_number integer, display text, is_placeholder boolean)
language plpgsql volatile security definer set search_path = ''
as $$
declare v_series public.certificate_series%rowtype; v_next integer;
begin
  -- The row lock IS the serialisation point.
  select * into v_series
  from public.certificate_series
  where id = p_series_id
  for update;

  if v_series.id is null then
    raise exception 'SERIES_NOT_AVAILABLE' using errcode = 'P0001';
  end if;
  if not v_series.is_active then
    raise exception 'SERIES_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  v_next := v_series.next_sequence;

  update public.certificate_series
  set next_sequence = v_next + 1
  where id = p_series_id;

  return query
    select v_next,
           public.format_certificate_serial(
             v_series.prefix, v_series.year, v_next, v_series.sequence_width),
           v_series.format_is_placeholder;
end;
$$;

comment on function public.allocate_certificate_serial is
  'Consumes the next number under a row lock and advances the counter. INTERNAL — a serial allocated outside an issuance is a number nobody can account for, so issue_certificate is the only caller. The counter never decreases: a voided number stays consumed and the gap is explained by certificate_voids.';

-- ── Issuance ────────────────────────────────────────────────────────────────

create function public.issue_certificate(
  p_request_id uuid,
  p_template_id uuid,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_req public.document_requests%rowtype;
  v_template public.certificate_templates%rowtype;
  v_series_id uuid;
  v_alloc record;
  v_certificate_id uuid;
  v_token text;
begin
  select * into v_req from public.document_requests where id = p_request_id;
  if v_req.id is null
     or not public.auth_has_permission(v_req.barangay_id, 'certificates.issue') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;

  -- THE hand-off gate. Slice 3 stopped at ready_for_issue precisely so this
  -- check could be exact: a draft, submitted or in-review request has not been
  -- through the review that makes issuing safe.
  if v_req.state <> 'ready_for_issue' then
    raise exception 'REQUEST_NOT_READY_FOR_ISSUE' using errcode = 'P0001';
  end if;

  select * into v_template
  from public.certificate_templates
  where id = p_template_id and barangay_id = v_req.barangay_id and is_active;
  if v_template.id is null then
    raise exception 'TEMPLATE_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  -- The template must render the type that was actually requested. Without
  -- this a clearance request could be issued an indigency certificate.
  if v_template.document_type_id <> v_req.document_type_id then
    raise exception 'TEMPLATE_TYPE_MISMATCH' using errcode = 'P0001';
  end if;

  -- The accountable book for the issuing year.
  select id into v_series_id
  from public.certificate_series
  where barangay_id = v_req.barangay_id
    and year = extract(year from now())::integer
    and is_active;
  if v_series_id is null then
    raise exception 'SERIES_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  -- Opaque, non-sequential, unrelated to the serial or to any id.
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  -- Allocation and insertion in ONE transaction. If the insert fails, the
  -- whole statement rolls back — including the counter advance — so a failed
  -- issuance consumes nothing. If the COMMIT succeeds, both happened.
  select * into v_alloc from public.allocate_certificate_serial(v_series_id);

  insert into public.certificates
    (barangay_id, request_id, person_id, template_id, series_id,
     serial_sequence, serial_display, serial_is_placeholder,
     verification_token)
  values
    (v_req.barangay_id, p_request_id, v_req.person_id, p_template_id, v_series_id,
     v_alloc.sequence_number, v_alloc.display, v_alloc.is_placeholder,
     v_token)
  returning id into v_certificate_id;

  -- The Slice 5 hand-off, enqueued in the same transaction as the issuance.
  -- IDs only — no serial, no token, no name.
  perform public.enqueue_outbox(
    v_req.barangay_id, 'certificate.ready_for_release',
    jsonb_build_object('certificate_id', v_certificate_id,
                       'request_id', p_request_id,
                       'person_id', v_req.person_id),
    p_correlation_id);

  return v_certificate_id;
end;
$$;

comment on function public.issue_certificate is
  'ready_for_issue → an accountable certificate (certificates.issue). Allocation and insertion share one transaction, so a failed issuance consumes no serial. Refuses a request in any other state, a template for a different document type, and a barangay with no active series. Enqueues the Slice 5 release intent atomically.';

-- ── Voiding ─────────────────────────────────────────────────────────────────

create function public.void_certificate(
  p_certificate_id uuid,
  p_reason text,
  p_correlation_id uuid default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_cert public.certificates%rowtype;
begin
  select * into v_cert from public.certificates where id = p_certificate_id;
  if v_cert.id is null
     or not public.auth_has_permission(v_cert.barangay_id, 'certificates.void') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_cert.status <> 'issued' then
    raise exception 'CERTIFICATE_NOT_ISSUED' using errcode = 'P0001';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  -- The void is an ADDED fact. The certificate row keeps its serial, its
  -- issue date and its issuer; only its status changes, and the void record
  -- explains why. Nothing is deleted, so the serial stays accounted for and
  -- the gap in the book has a reason attached to it.
  insert into public.certificate_voids
    (barangay_id, certificate_id, reason, voided_by)
  values
    (v_cert.barangay_id, p_certificate_id, p_reason, auth.uid());

  update public.certificates
  set status = 'voided'
  where id = p_certificate_id;
end;
$$;

comment on function public.void_certificate is
  'Withdraws an issued certificate (certificates.void), requiring a reason. Non-destructive: the row, its serial and its issuance history all survive, and certificate_voids explains the gap. A reissue must go through issue_certificate again and receives a NEW serial.';

-- ── Artifact metadata ───────────────────────────────────────────────────────
-- The row is reserved here; 4B writes the bytes and finalizes it, exactly as
-- Slices 2F and 3D do for evidence.

create function public.register_certificate_artifact(p_certificate_id uuid)
returns table (artifact_id uuid, storage_path text)
language plpgsql volatile security definer set search_path = ''
as $$
declare v_cert public.certificates%rowtype; v_id uuid; v_path text;
begin
  select * into v_cert from public.certificates where id = p_certificate_id;
  if v_cert.id is null
     or not public.auth_has_permission(v_cert.barangay_id, 'certificates.issue') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;

  v_id := gen_random_uuid();
  -- Opaque path: UUIDs only.
  v_path := v_cert.barangay_id || '/' || p_certificate_id || '/' || v_id;

  insert into public.certificate_artifacts
    (id, barangay_id, certificate_id, mime_type, storage_path)
  values
    (v_id, v_cert.barangay_id, p_certificate_id, 'application/pdf', v_path)
  -- Regeneration reuses the row: one artifact per certificate, so a second
  -- attempt overwrites the bytes at a known path rather than creating a second
  -- row that could disagree with the first.
  on conflict (certificate_id) do update
    set generated_at = null, content_hash = null, size_bytes = null
  returning id, storage_path into v_id, v_path;

  return query select v_id, v_path;
end;
$$;

comment on function public.register_certificate_artifact is
  'Reserves the artifact slot and returns its opaque path (certificates.issue). The row exists BEFORE the PDF, so an artifact that never generated is visibly ungenerated rather than silently absent. 4B writes the bytes and finalizes.';

-- ── Grants: deny first, then grant exactly the client surface ───────────────

revoke execute on function
  public.caller_owns_certificate(uuid),
  public.format_certificate_serial(text, integer, integer, integer),
  public.create_certificate_series(uuid, integer, text, integer),
  public.create_certificate_template(uuid, uuid, text, text, text, text, text),
  public.allocate_certificate_serial(uuid),
  public.issue_certificate(uuid, uuid, uuid),
  public.void_certificate(uuid, text, uuid),
  public.register_certificate_artifact(uuid)
from public, anon, authenticated;

grant execute on function
  public.caller_owns_certificate(uuid),
  public.create_certificate_series(uuid, integer, text, integer),
  public.create_certificate_template(uuid, uuid, text, text, text, text, text),
  public.issue_certificate(uuid, uuid, uuid),
  public.void_certificate(uuid, text, uuid),
  public.register_certificate_artifact(uuid)
to authenticated;

-- allocate_certificate_serial and format_certificate_serial stay INTERNAL.
-- The first would let a caller consume a number outside an issuance; the
-- second is a rendering detail whose only legitimate caller is the allocator.
