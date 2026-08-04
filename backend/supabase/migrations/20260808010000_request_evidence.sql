-- ============================================================================
-- Slice 3D · Supporting evidence for document requests
--
-- The roadmap says this reuses the Slice 2 evidence pattern "verbatim"
-- (Slice 3 §12), and it does: private bucket, metadata row BEFORE any upload,
-- an opaque server-generated path, Storage RLS that joins the object name back
-- to that metadata, finalization that reads the object rather than trusting a
-- client claim, and a separate capability for reading it.
--
-- Two deliberate differences from Slice 2F, each because the domain differs:
--
--   1. **No `kind` enum.** Verification needed identity AND residency, so it
--      needed a taxonomy to express a minimum. A document request needs
--      "whatever this document type asks for" — inventing categories nobody
--      specified would be scope, not rigour. `requires_supporting_evidence`
--      (3A) already says whether anything is needed at all.
--   2. **Editable window is `draft` only**, not `draft`/`info_requested` —
--      the request state machine has no information-request state
--      (DEC-REQ-01), so `draft` is the whole composition phase.
-- ============================================================================

-- ── The seventh capability ──────────────────────────────────────────────────
-- Mirrors D2-04's ruling that evidence is the most sensitive surface and
-- carries its own capability: ordinary staff work the queue without the
-- documents. Administrator-only, exactly like verification.evidence.read.

insert into public.permissions (key, scope, description) values
  ('requests.evidence.read', 'barangay',
   'Read supporting-evidence metadata for document requests and obtain authorized access to the files.');

insert into public.role_permissions (role_key, permission_key, scope) values
  ('barangay_administrator', 'requests.evidence.read', 'barangay');

-- ── Metadata ────────────────────────────────────────────────────────────────

create table public.document_request_evidence (
  id            uuid primary key default gen_random_uuid(),
  barangay_id   uuid not null,
  request_id    uuid not null,

  -- Same allow-list as Slice 2F, enforced again at the bucket.
  mime_type     text not null check (mime_type in
                  ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  -- Opaque, tenant/request/evidence-scoped path. UUIDs only: no filename, no
  -- resident name, nothing a person could be identified from (roadmap §11).
  storage_path  text not null unique,

  declared_size_bytes bigint not null
    check (declared_size_bytes between 1 and 10485760),
  -- Trusted size, read from the stored object at finalization.
  size_bytes    bigint check (size_bytes is null or size_bytes between 1 and 10485760),
  content_hash  text check (content_hash is null or content_hash ~ '^[a-f0-9]{64}$'),
  uploaded_at   timestamptz,

  created_at    timestamptz not null default now(),

  unique (id, barangay_id),
  foreign key (request_id, barangay_id)
    references public.document_requests (id, barangay_id) on delete cascade,
  -- Confirmation is all-or-nothing.
  check ((uploaded_at is null) = (content_hash is null)
     and (uploaded_at is null) = (size_bytes is null))
);

create index document_request_evidence_request_idx
  on public.document_request_evidence (request_id);

comment on table public.document_request_evidence is
  'Supporting documents for a request (Slice 3D). Metadata only — the bytes live in the private `request-evidence` bucket, reachable solely through short-lived signed URLs. Rows exist before any upload, which is what makes an unfinalized item visibly incomplete rather than silently missing.';

-- ── Bucket ──────────────────────────────────────────────────────────────────
-- Created by MIGRATION so `pnpm db:reset` reproduces it from empty; a bucket
-- that exists only because someone clicked a dashboard is not reproducible and
-- cannot be asserted in pgTAP.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-evidence',
  'request-evidence',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Object-access predicates ────────────────────────────────────────────────
-- Joined to the unique server-generated `storage_path`, so authorization
-- cannot drift from the metadata and an object with no metadata row is
-- unreachable by construction.

create function public.request_evidence_object_writable(p_object_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.document_request_evidence e
    join public.document_requests dr on dr.id = e.request_id
    where e.storage_path = p_object_name
      -- Composition phase only: once submitted, the evidence set is what
      -- staff are reviewing.
      and dr.state = 'draft'
      and (
        public.caller_owns_request(e.request_id)
        -- The counter files evidence on the resident's behalf, under the same
        -- capability that lets it file the request.
        or public.auth_has_permission(e.barangay_id, 'requests.create_walk_in')
      )
  );
$$;

comment on function public.request_evidence_object_writable is
  'May the caller write or delete this evidence object? The requester or the assisted channel, and only while the request is still a draft.';

create function public.request_evidence_object_readable(p_object_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.document_request_evidence e
    where e.storage_path = p_object_name
      and (
        public.caller_owns_request(e.request_id)
        -- Deliberately requests.evidence.read, NOT requests.read: staff work
        -- the queue without opening residents' documents.
        or public.auth_has_permission(e.barangay_id, 'requests.evidence.read')
      )
  );
$$;

comment on function public.request_evidence_object_readable is
  'May the caller read this evidence object? The requester, or a holder of requests.evidence.read in the object''s own barangay. Platform administrators match neither branch.';

revoke execute on function
  public.request_evidence_object_writable(text),
  public.request_evidence_object_readable(text)
from public, anon, authenticated;

grant execute on function
  public.request_evidence_object_writable(text),
  public.request_evidence_object_readable(text)
to authenticated;

-- ── Storage RLS ─────────────────────────────────────────────────────────────
-- `anon` receives NO policy: anonymous upload, read and listing are denied by
-- the deny-by-default posture rather than by an explicit rule. No UPDATE
-- policy either — an evidence object is written once.

create policy request_evidence_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'request-evidence'
    and public.request_evidence_object_writable(name)
  );

create policy request_evidence_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'request-evidence'
    and public.request_evidence_object_readable(name)
  );

create policy request_evidence_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'request-evidence'
    and public.request_evidence_object_writable(name)
  );

-- ── Table RLS ───────────────────────────────────────────────────────────────

alter table public.document_request_evidence enable row level security;
alter table public.document_request_evidence force  row level security;

revoke all on public.document_request_evidence from public, anon, authenticated;
grant select on public.document_request_evidence to authenticated;

create policy document_request_evidence_system_all on public.document_request_evidence
  as permissive for all to postgres, service_role using (true) with check (true);

create policy document_request_evidence_select on public.document_request_evidence
  for select to authenticated
  using (
    public.caller_owns_request(request_id)
    or public.auth_has_permission(barangay_id, 'requests.evidence.read')
  );

-- ── Audit ───────────────────────────────────────────────────────────────────

create function public.document_request_evidence_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- MIME only. Never the opaque path, never a filename, never the bytes.
    perform public.append_audit_entry(
      'request.evidence_added', 'document_request_evidence', new.id::text,
      new.barangay_id,
      jsonb_build_object('request_id', new.request_id, 'mime_type', new.mime_type),
      'success', 'db');
    return new;
  end if;
  perform public.append_audit_entry(
    'request.evidence_removed', 'document_request_evidence', old.id::text,
    old.barangay_id,
    jsonb_build_object('request_id', old.request_id),
    'success', 'db');
  return old;
end;
$$;

create trigger document_request_evidence_audit
  after insert or delete on public.document_request_evidence
  for each row execute function public.document_request_evidence_audit();

-- ── Domain functions ────────────────────────────────────────────────────────

create function public.add_request_evidence_metadata(
  p_request_id uuid,
  p_mime_type text,
  p_declared_size_bytes bigint
)
returns table (evidence_id uuid, storage_path text)
language plpgsql volatile security definer set search_path = ''
as $$
declare v_req public.document_requests%rowtype; v_id uuid; v_path text;
begin
  select * into v_req from public.document_requests where id = p_request_id;
  if v_req.id is null
     or not (public.caller_owns_request(p_request_id)
             or public.auth_has_permission(v_req.barangay_id, 'requests.create_walk_in')) then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_req.state <> 'draft' then
    raise exception 'REQUEST_NOT_EDITABLE' using errcode = 'P0001';
  end if;

  v_id := gen_random_uuid();
  -- Opaque path: UUIDs only.
  v_path := v_req.barangay_id || '/' || p_request_id || '/' || v_id;

  insert into public.document_request_evidence
    (id, barangay_id, request_id, mime_type, storage_path, declared_size_bytes)
  values
    (v_id, v_req.barangay_id, p_request_id, p_mime_type, v_path, p_declared_size_bytes);

  return query select v_id, v_path;
end;
$$;

comment on function public.add_request_evidence_metadata is
  'Reserves an evidence slot and returns its opaque path. The row exists BEFORE the upload, so an item that never arrives is visibly unfinalized rather than silently absent.';

create function public.confirm_request_evidence_upload(
  p_evidence_id uuid,
  p_content_hash text
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_ev public.document_request_evidence%rowtype;
  v_state public.document_request_state;
  v_size bigint;
begin
  select * into v_ev from public.document_request_evidence where id = p_evidence_id;
  if v_ev.id is null
     or not (public.caller_owns_request(v_ev.request_id)
             or public.auth_has_permission(v_ev.barangay_id, 'requests.create_walk_in')) then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_ev.uploaded_at is not null then
    raise exception 'EVIDENCE_ALREADY_CONFIRMED' using errcode = 'P0001';
  end if;

  select dr.state into v_state
  from public.document_requests dr where dr.id = v_ev.request_id;
  if v_state <> 'draft' then
    raise exception 'REQUEST_NOT_EDITABLE' using errcode = 'P0001';
  end if;

  -- THE point of this function: the object must actually be there. Storage
  -- lives in this same database, so the check is a join, not a promise.
  select (o.metadata ->> 'size')::bigint into v_size
  from storage.objects o
  where o.bucket_id = 'request-evidence' and o.name = v_ev.storage_path;

  if v_size is null then
    raise exception 'EVIDENCE_OBJECT_MISSING' using errcode = 'P0001';
  end if;
  -- An empty object is a failed upload wearing a success costume.
  if v_size < 1 or v_size > 10485760 then
    raise exception 'EVIDENCE_SIZE_INVALID' using errcode = 'P0001';
  end if;

  update public.document_request_evidence
  set uploaded_at = now(),
      content_hash = p_content_hash,
      size_bytes = v_size
  where id = p_evidence_id;
end;
$$;

comment on function public.confirm_request_evidence_upload is
  'Finalization. Verifies the object exists in the private bucket and takes its size from the object itself, so a client cannot finalize an upload that did not happen.';

create function public.remove_request_evidence(p_evidence_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_ev public.document_request_evidence%rowtype; v_state public.document_request_state;
begin
  select * into v_ev from public.document_request_evidence where id = p_evidence_id;
  if v_ev.id is null
     or not (public.caller_owns_request(v_ev.request_id)
             or public.auth_has_permission(v_ev.barangay_id, 'requests.create_walk_in')) then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;

  select dr.state into v_state
  from public.document_requests dr where dr.id = v_ev.request_id;
  if v_state <> 'draft' then
    raise exception 'REQUEST_NOT_EDITABLE' using errcode = 'P0001';
  end if;

  delete from public.document_request_evidence where id = p_evidence_id;
  -- Storage object cleanup is the broker's job; the audit trigger records the
  -- removal either way, and an orphaned object is inert because the readable
  -- predicate can no longer find metadata for it.
end;
$$;

-- ── Submission now requires the evidence the type asks for ──────────────────
-- The 3A deferral, now due: `requires_supporting_evidence` existed from the
-- first migration precisely so this gate could arrive without a schema change.

create or replace function public.submit_request(
  p_request_id uuid,
  p_correlation_id uuid default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_req public.document_requests%rowtype; v_missing integer; v_needs boolean; v_finalized integer;
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

  -- Slice 3D: and the supporting document, where the type asks for one.
  -- FINALIZED, not merely reserved — a metadata row whose upload never landed
  -- would otherwise satisfy the rule while carrying no document at all. Same
  -- tightening 2F applied to submit_verification.
  select dt.requires_supporting_evidence into v_needs
  from public.document_types dt where dt.id = v_req.document_type_id;

  if coalesce(v_needs, false) then
    select count(*) into v_finalized
    from public.document_request_evidence e
    where e.request_id = p_request_id and e.uploaded_at is not null;

    if v_finalized < 1 then
      raise exception 'EVIDENCE_REQUIRED' using errcode = 'P0001';
    end if;
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
  'draft → submitted (owner, or staff holding requests.create_walk_in). Refuses until every required answer exists AND, where the type requires supporting evidence, at least one FINALIZED document. Enqueues NO intent: the requester''s own action needs no notification.';

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke execute on function
  public.add_request_evidence_metadata(uuid, text, bigint),
  public.confirm_request_evidence_upload(uuid, text),
  public.remove_request_evidence(uuid)
from public, anon, authenticated;

grant execute on function
  public.add_request_evidence_metadata(uuid, text, bigint),
  public.confirm_request_evidence_upload(uuid, text),
  public.remove_request_evidence(uuid)
to authenticated;
