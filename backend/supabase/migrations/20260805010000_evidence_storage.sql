-- ============================================================================
-- Slice 2F · Private verification-evidence Storage: bucket, policies, and a
-- finalization the client cannot forge
--
-- 2A built the metadata half (D2-03): the row is created BEFORE any upload and
-- carries an opaque `{barangay}/{application}/{evidence}` path. 2F adds the
-- bytes half — a private bucket, Storage RLS that mirrors the table policies,
-- and the two hardenings the metadata-only design could not enforce:
--
--   1. `confirm_evidence_upload` now reads `storage.objects` DIRECTLY. The
--      object must exist, and its size is taken from the object itself rather
--      than from a client parameter. A browser that merely *claims* an upload
--      succeeded finalizes nothing.
--   2. `submit_verification` now requires FINALIZED evidence (uploaded_at set),
--      not merely a metadata row. Pending or abandoned uploads no longer
--      satisfy the minimum-evidence rule — the tightening 2A deferred here.
--
-- No service-role client is involved anywhere in this subpart: every Storage
-- operation runs on the caller's own session against the policies below.
-- ============================================================================

-- ── The bucket: private, size-capped, MIME-capped ───────────────────────────
-- Created by MIGRATION so `pnpm db:reset` reproduces it from an empty stack —
-- a bucket that only exists because someone clicked a dashboard is not
-- reproducible, and could not be asserted in pgTAP.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-evidence',
  'verification-evidence',
  false,
  10485760, -- 10 MiB, matching the declared_size_bytes CHECK and config.toml
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- (No COMMENT ON here: `storage.buckets` is owned by supabase_storage_admin,
-- and a migration that annotates a table it does not own fails to apply.)

-- ── Object-access predicates ────────────────────────────────────────────────
-- These join the object NAME to `verification_evidence.storage_path`, which is
-- unique and server-generated. Authorization therefore cannot drift from the
-- metadata, and an object with no metadata row is unreachable by construction
-- (which is what makes an orphaned object inert — see the removal model in
-- docs/architecture/resident-registry-and-verification.md).
--
-- SECURITY DEFINER for the same reason `caller_owns_application` is: they are
-- used INSIDE policies, and they answer only "may the caller touch this exact
-- object?" — scoped to auth.uid() by construction, disclosing nothing else.

create function public.evidence_object_writable(p_object_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.verification_evidence e
    join public.verification_applications va on va.id = e.application_id
    where e.storage_path = p_object_name
      -- Uploads and deletes only while the application is editable: a
      -- submitted or decided application freezes its evidence.
      and va.state in ('draft', 'info_requested')
      and public.caller_owns_application(e.application_id)
  );
$$;

comment on function public.evidence_object_writable is
  'Slice 2F: may the caller write/delete this evidence object? Owner only, and only while the application is editable. Staff never write resident evidence.';

create function public.evidence_object_readable(p_object_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.verification_evidence e
    where e.storage_path = p_object_name
      and (
        public.caller_owns_application(e.application_id)
        -- Deliberately verification.evidence.read, NOT verification.read:
        -- ordinary staff work the queue without the documents (D2-04).
        or public.auth_has_permission(e.barangay_id, 'verification.evidence.read')
      )
  );
$$;

comment on function public.evidence_object_readable is
  'Slice 2F: may the caller read this evidence object? The owner, or a holder of verification.evidence.read in the object''s own barangay. Platform administrators match neither branch.';

revoke execute on function
  public.evidence_object_writable(text),
  public.evidence_object_readable(text)
from public, anon, authenticated;

-- Policies evaluate with the querying role's privileges, so `authenticated`
-- must be able to execute them — exactly as for caller_owns_application.
grant execute on function
  public.evidence_object_writable(text),
  public.evidence_object_readable(text)
to authenticated;

-- ── Storage RLS ─────────────────────────────────────────────────────────────
-- `anon` receives NO policy at all: anonymous upload, read and listing are
-- denied by the deny-by-default posture rather than by an explicit rule.
-- There is no UPDATE policy either — an evidence object is written once.

create policy evidence_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-evidence'
    and public.evidence_object_writable(name)
  );

create policy evidence_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification-evidence'
    and public.evidence_object_readable(name)
  );

create policy evidence_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'verification-evidence'
    and public.evidence_object_writable(name)
  );

-- ── Finalization the client cannot forge ────────────────────────────────────
-- Signature changes (the trusted size now comes from the object), so the old
-- overload is dropped rather than replaced.

drop function public.confirm_evidence_upload(uuid, text, bigint);

create function public.confirm_evidence_upload(
  p_evidence_id uuid,
  p_content_hash text
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_ev public.verification_evidence%rowtype;
  v_state public.verification_state;
  v_size bigint;
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

  select va.state into v_state
  from public.verification_applications va where va.id = v_ev.application_id;
  if v_state not in ('draft', 'info_requested') then
    raise exception 'APPLICATION_NOT_EDITABLE' using errcode = 'P0001';
  end if;

  -- THE point of this function: the object must actually be there. Storage
  -- lives in this same database, so the check is a join, not a promise.
  select (o.metadata ->> 'size')::bigint into v_size
  from storage.objects o
  where o.bucket_id = 'verification-evidence' and o.name = v_ev.storage_path;

  if v_size is null then
    raise exception 'EVIDENCE_OBJECT_MISSING' using errcode = 'P0001';
  end if;
  -- An empty object is a failed upload wearing a success costume.
  if v_size < 1 or v_size > 10485760 then
    raise exception 'EVIDENCE_SIZE_INVALID' using errcode = 'P0001';
  end if;

  update public.verification_evidence
  set uploaded_at = now(),
      content_hash = p_content_hash,
      -- The TRUSTED size: read from the stored object, never a parameter.
      size_bytes = v_size
  where id = p_evidence_id;
end;
$$;

comment on function public.confirm_evidence_upload is
  'Slice 2F finalization. Verifies the object exists in the private bucket and takes its size from the object itself, so a client cannot finalize an upload that did not happen. Owner or verification.review; editable states only.';

revoke execute on function public.confirm_evidence_upload(uuid, text)
  from public, anon, authenticated;
grant execute on function public.confirm_evidence_upload(uuid, text) to authenticated;

-- ── Submission requires FINALIZED evidence (the 2A deferral, now due) ───────

create or replace function public.submit_verification(p_application_id uuid)
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

  -- Minimum-evidence rule, tightened for 2F: at least one identity and one
  -- residency item that were actually UPLOADED. A pending metadata row is an
  -- intention, not a document.
  if not exists (select 1 from public.verification_evidence e
                 where e.application_id = p_application_id
                   and e.kind = 'identity' and e.uploaded_at is not null)
     or not exists (select 1 from public.verification_evidence e
                 where e.application_id = p_application_id
                   and e.kind = 'residency' and e.uploaded_at is not null) then
    raise exception 'EVIDENCE_INCOMPLETE' using errcode = 'P0001';
  end if;

  update public.verification_applications
  set state = 'submitted', submitted_at = now()
  where id = p_application_id;
end;
$$;

comment on function public.submit_verification is
  'draft → submitted. Slice 2F: requires one FINALIZED identity item and one FINALIZED residency item (uploaded_at set) — pending uploads no longer satisfy the rule.';

-- ── Audit the finalization ──────────────────────────────────────────────────
-- 2A audited evidence added and removed; the confirmation was an UPDATE the
-- trigger did not cover, so a finalized document left no trace of when it
-- became real.

create or replace function public.verification_evidence_audit()
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

  if tg_op = 'UPDATE' then
    if old.uploaded_at is null and new.uploaded_at is not null then
      perform public.append_audit_entry(
        'verification.evidence_finalized', 'verification_evidence', new.id::text,
        new.barangay_id,
        jsonb_build_object('application_id', new.application_id,
                           'kind', new.kind,
                           'mime_type', new.mime_type,
                           'size_bytes', new.size_bytes,
                           -- The checksum IS the tamper-evidence record; it is
                           -- a digest of bytes, not a personal value.
                           'content_hash', new.content_hash),
        'success', 'db');
    end if;
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

drop trigger verification_evidence_audit on public.verification_evidence;
create trigger verification_evidence_audit
  after insert or update or delete on public.verification_evidence
  for each row execute function public.verification_evidence_audit();
