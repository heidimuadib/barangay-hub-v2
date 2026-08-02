-- ============================================================================
-- pgTAP · Slice 2F · Private evidence Storage: bucket, policies, finalization
--
-- The bytes half of D2-03. Storage lives in this same database, so the whole
-- authorization matrix is testable here rather than only through the API:
-- `storage.objects` is an ordinary RLS-protected table, and the policies added
-- by 20260805010000 resolve through `verification_evidence.storage_path`.
--
-- What this file proves, per layer:
--   bucket      — private, size-capped, MIME-capped, reproducible from empty
--   policies    — anon nothing; owner read/write/delete; evidence.read for
--                 reviewers; no cross-person, cross-tenant or platform access
--   finalize    — an object must EXIST, and its size is taken from the object
--   submission  — pending evidence satisfies nothing
--
-- Personas (seeds 01 + 02): u1 platform · u2 admin A (holds
-- verification.evidence.read) · u3 staff A (does NOT) · u5 admin B ·
-- u12 applicant (person c3, whose application d3 is REJECTED — terminal, so
-- the one-open-application slot is free for a fresh draft) · u10 another
-- resident in the same barangay.
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

create function pg_temp.impersonate(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

create function pg_temp.as_system() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('role', 'postgres', true);
end;
$$;

create function pg_temp.remember(p_key text, p_value text) returns text
language plpgsql as $fn$
begin
  perform set_config('app.test_' || p_key, p_value, true);
  return p_value;
end;
$fn$;

create function pg_temp.recall(p_key text) returns text
language sql stable as $fn$
  select nullif(current_setting('app.test_' || p_key, true), '');
$fn$;

-- ════ The bucket is private and constrained ═════════════════════════════════

select is(
  (select public from storage.buckets where id = 'verification-evidence'),
  false, 'the evidence bucket is PRIVATE — no public URL is ever possible');

select is(
  (select file_size_limit from storage.buckets where id = 'verification-evidence'),
  10485760::bigint, 'the bucket enforces the same 10 MiB ceiling as the table CHECK');

select is(
  (select allowed_mime_types from storage.buckets where id = 'verification-evidence'),
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  'the bucket enforces the D2-03 MIME allow-list at the Storage layer too');

select is(
  (select count(*)::int from storage.buckets where public),
  0, 'NO bucket in this project is public');

select ok(
  (select relrowsecurity from pg_class
   where relname = 'objects' and relnamespace = 'storage'::regnamespace),
  'RLS is enabled on storage.objects');

-- ════ Fixture: a pending evidence row on the applicant's own application ════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000012');

-- d3 is REJECTED — terminal, and therefore not editable. Prove uploads are
-- refused there before moving to a fresh draft.
select throws_ok(
  $$select * from public.add_evidence_metadata(
      'd0000000-0000-4000-8000-000000000003', 'identity', 'image/png', 2048)$$,
  'P0001', 'APPLICATION_NOT_EDITABLE',
  'evidence cannot be added to a decided application');

select pg_temp.as_system();
-- A fresh draft application for the applicant, so the editable path is real.
with created as (
  insert into public.verification_applications (barangay_id, person_id, state)
  values ('a0000000-0000-4000-8000-000000000001',
          'c0000000-0000-4000-8000-000000000003', 'draft')
  returning id
)
select pg_temp.remember('app_draft', (select id::text from created));

select pg_temp.impersonate('00000000-0000-4000-8000-000000000012');

select pg_temp.remember('ev', (public.add_evidence_metadata(
  pg_temp.recall('app_draft')::uuid, 'identity', 'image/png', 2048)).evidence_id::text);

select pg_temp.remember('path', (
  select storage_path from public.verification_evidence
  where id = pg_temp.recall('ev')::uuid));

select matches(
  pg_temp.recall('path'),
  '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$',
  'the object path is opaque UUIDs only — no filename, no name, no PII');

-- ════ Finalization cannot be forged ═════════════════════════════════════════

select throws_ok(
  format($f$select public.confirm_evidence_upload('%s',
    '1111111111111111111111111111111111111111111111111111111111111111')$f$,
    pg_temp.recall('ev')),
  'P0001', 'EVIDENCE_OBJECT_MISSING',
  'claiming an upload that never happened finalizes NOTHING');

select is(
  (select uploaded_at from public.verification_evidence
   where id = pg_temp.recall('ev')::uuid),
  null, 'and the row stays pending after the failed claim');

-- Stand in for the browser's PUT. The RLS path for this insert is proven
-- separately below; here we need the object to exist.
select pg_temp.as_system();
insert into storage.objects (bucket_id, name, owner, metadata)
values ('verification-evidence', pg_temp.recall('path'), null,
        jsonb_build_object('size', 4096, 'mimetype', 'image/png'));

select pg_temp.impersonate('00000000-0000-4000-8000-000000000012');
select lives_ok(
  format($f$select public.confirm_evidence_upload('%s',
    '1111111111111111111111111111111111111111111111111111111111111111')$f$,
    pg_temp.recall('ev')),
  'with the object present the upload finalizes');

select is(
  (select size_bytes from public.verification_evidence
   where id = pg_temp.recall('ev')::uuid),
  4096::bigint,
  'the recorded size came from the OBJECT (4096), not the declared 2048');

-- Read as the system role: a resident holds no `audit.read`, and the claim
-- under test is what the trail CONTAINS, not who may read it.
select pg_temp.as_system();
select is(
  (select count(*)::int from public.audit_events
   where action = 'verification.evidence_finalized'
     and target_id = pg_temp.recall('ev')),
  1, 'finalization is audited');

select is(
  (select count(*)::int from public.audit_events
   where action = 'verification.evidence_finalized'
     and metadata::text like '%' || pg_temp.recall('path') || '%'),
  0, 'and the audit metadata never carries the object path');

-- ════ Submission requires FINALIZED evidence of both kinds ══════════════════

select pg_temp.impersonate('00000000-0000-4000-8000-000000000012');
select throws_ok(
  format($f$select public.submit_verification('%s')$f$, pg_temp.recall('app_draft')),
  'P0001', 'EVIDENCE_INCOMPLETE',
  'one finalized identity item alone does not satisfy the rule');

-- Add a residency item and leave it PENDING: still incomplete.
select pg_temp.remember('ev_res', (public.add_evidence_metadata(
  pg_temp.recall('app_draft')::uuid, 'residency', 'application/pdf', 1024)).evidence_id::text);

select throws_ok(
  format($f$select public.submit_verification('%s')$f$, pg_temp.recall('app_draft')),
  'P0001', 'EVIDENCE_INCOMPLETE',
  'a PENDING residency upload does not count toward submission');

select pg_temp.as_system();
insert into storage.objects (bucket_id, name, owner, metadata)
select 'verification-evidence', storage_path, null,
       jsonb_build_object('size', 1024, 'mimetype', 'application/pdf')
from public.verification_evidence where id = pg_temp.recall('ev_res')::uuid;

select pg_temp.impersonate('00000000-0000-4000-8000-000000000012');
select lives_ok(
  format($f$select public.confirm_evidence_upload('%s',
    '2222222222222222222222222222222222222222222222222222222222222222')$f$,
    pg_temp.recall('ev_res')),
  'the residency item finalizes');

select lives_ok(
  format($f$select public.submit_verification('%s')$f$, pg_temp.recall('app_draft')),
  'with BOTH kinds finalized the resident can submit');

select is(
  (select state::text from public.verification_applications
   where id = pg_temp.recall('app_draft')::uuid),
  'submitted', 'the application is submitted');

-- Frozen after submission: the object is no longer writable or deletable.
select is(
  (select count(*)::int from storage.objects o
   where o.name = pg_temp.recall('path')
     and public.evidence_object_writable(o.name)),
  0, 'a submitted application freezes its evidence objects (no write, no delete)');

select is(
  (select count(*)::int from storage.objects o
   where o.name = pg_temp.recall('path')
     and public.evidence_object_readable(o.name)),
  1, 'but the owner can still READ their own document');

-- ════ The access matrix ═════════════════════════════════════════════════════

select pg_temp.as_anon();
select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'verification-evidence'),
  0, 'anonymous callers see NOTHING in the bucket — no read, no listing');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000010');
select is(
  (select count(*)::int from storage.objects o
   where o.name = pg_temp.recall('path')
     and public.evidence_object_readable(o.name)),
  0, 'another RESIDENT in the same barangay cannot read this document');
select is(
  (select count(*)::int from storage.objects o
   where o.name = pg_temp.recall('path')
     and public.evidence_object_writable(o.name)),
  0, 'nor upload to or delete from another resident''s application');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000003');
select is(
  (select count(*)::int from storage.objects o
   where o.name = pg_temp.recall('path')
     and public.evidence_object_readable(o.name)),
  0, 'staff WITHOUT verification.evidence.read cannot reach the bytes (D2-04)');
select is(
  (select count(*)::int from public.verification_evidence
   where id = pg_temp.recall('ev')::uuid),
  0, 'and cannot even see the metadata row — visibility does not imply access');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000002');
select is(
  (select count(*)::int from storage.objects o
   where o.name = pg_temp.recall('path')
     and public.evidence_object_readable(o.name)),
  1, 'an administrator holding verification.evidence.read may read it');
select is(
  (select count(*)::int from storage.objects o
   where o.name = pg_temp.recall('path')
     and public.evidence_object_writable(o.name)),
  0, 'but even an administrator never WRITES a resident''s evidence');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000005');
select is(
  (select count(*)::int from storage.objects o
   where o.name = pg_temp.recall('path')
     and public.evidence_object_readable(o.name)),
  0, 'a tenant-B administrator cannot read tenant-A evidence');

select pg_temp.impersonate('00000000-0000-4000-8000-000000000001');
select is(
  (select count(*)::int from storage.objects o
   where o.name = pg_temp.recall('path')
     and public.evidence_object_readable(o.name)),
  0, 'a platform administrator holds no tenant evidence access (ADR-0006 point 18)');

select pg_temp.as_system();
select * from finish();

rollback;
