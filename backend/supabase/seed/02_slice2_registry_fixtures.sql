-- ============================================================================
-- Seed · Slice 2A · Registry and verification fixtures (Tier 3)
--
-- SYNTHETIC identities only (DEC-ENV-04). Same guard as the Slice 1 seed:
-- refuses to run wherever a non-`test-` tenant exists (Phase 6 §22.2).
-- Personas cover every 2A scenario: submitted / info-requested / rejected /
-- approved applications, an account-less walk-in, a same-tenant duplicate
-- pair (with an accent variant for the unaccent+trgm path), and a
-- cross-tenant name twin for isolation tests.
-- ============================================================================

do $$
begin
  if exists (select 1 from public.barangays where code not like 'test-%') then
    raise exception
      'SEED REFUSED: barangays without the test- prefix exist (Phase 6 §22.2).';
  end if;
end $$;

-- ── Additional auth accounts (password: password123-local) ──────────────────

do $$
declare fixture record;
begin
  for fixture in
    select * from (values
      ('00000000-0000-4000-8000-000000000010'::uuid, 'applicant.sanisidro@barangay-hub.test', 'Applicant One (Test)'),
      ('00000000-0000-4000-8000-000000000011'::uuid, 'inforeq.sanisidro@barangay-hub.test',   'Applicant InfoReq (Test)'),
      ('00000000-0000-4000-8000-000000000012'::uuid, 'rejected.sanisidro@barangay-hub.test',  'Applicant Rejected (Test)')
    ) as t(id, email, display_name)
  loop
    insert into auth.users
      (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
       confirmation_token, recovery_token, email_change_token_new, email_change)
    values
      (fixture.id, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', fixture.email,
       extensions.crypt('password123-local', extensions.gen_salt('bf')),
       now(), '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('display_name', fixture.display_name),
       now(), now(), '', '', '', '')
    on conflict (id) do nothing;

    insert into auth.identities
      (id, user_id, provider_id, provider, identity_data,
       last_sign_in_at, created_at, updated_at)
    values
      (gen_random_uuid(), fixture.id, fixture.id::text, 'email',
       jsonb_build_object('sub', fixture.id::text, 'email', fixture.email,
                          'email_verified', true),
       now(), now(), now())
    on conflict (provider_id, provider) do nothing;
  end loop;
end $$;

-- ── Persons ─────────────────────────────────────────────────────────────────
-- Triggers derive search_text and stamp created_by (null on the seed path).

insert into public.persons
  (id, barangay_id, first_name, last_name, birthdate, residency_basis_key,
   residency_basis_explanation, source_channel, creation_reason)
values
  -- Self-registered applicants (San Isidro).
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Applicant', 'One (Test)', date '1990-01-01', 'renter', null, 'self', null),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Applicant', 'InfoReq (Test)', date '1991-02-02', 'household_member', null, 'self', null),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Applicant', 'Rejected (Test)', date '1992-03-03', 'other',
   'Synthetic residency arrangement for testing', 'self', null),
  -- Approved, linked to the seeded active resident account.
  ('c0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001',
   'Resident', 'SanIsidro (Test)', date '1985-05-05', 'property_owner', null, 'self', null),
  -- Walk-in with NO account (ADR-0006 point 16).
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'Juan', 'Dela Cruz (Test)', date '1970-06-15', 'property_owner', null,
   'staff', 'Walk-in registration at the counter (synthetic)'),
  -- Duplicate pair in San Isidro: plain and accented variants, same birthdate.
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001',
   'Maria', 'Santos (Test)', date '1988-08-08', 'renter', null,
   'staff', 'Duplicate-detection fixture A (synthetic)'),
  ('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001',
   'María', 'Sántos (Test)', date '1988-08-08', 'renter', null,
   'staff', 'Duplicate-detection fixture B (synthetic)'),
  -- Cross-tenant name twin (Malinis): must NEVER appear in San Isidro results.
  ('c0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000002',
   'Maria', 'Santos (Test)', date '1988-08-08', 'renter', null,
   'staff', 'Cross-tenant isolation fixture (synthetic)')
on conflict (id) do nothing;

-- ── Account ↔ person links ──────────────────────────────────────────────────

insert into public.person_accounts (person_id, barangay_id, user_id) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000010'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000011'),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000012'),
  ('c0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000004')
on conflict (person_id) do nothing;

-- ── Verification applications ───────────────────────────────────────────────
-- Inserted directly in their scenario states (owner path; the transition
-- trigger governs UPDATEs).

insert into public.verification_applications
  (id, barangay_id, person_id, state, submitted_at, info_request_note,
   decided_at, decided_by, decision_reason)
values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'submitted', now(), null, null, null, null),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000002', 'info_requested', now(),
   'Please add a clearer proof of residency (synthetic note).', null, null, null),
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000003', 'rejected', now(), null,
   now(), '00000000-0000-4000-8000-000000000002',
   'Evidence does not establish residency (synthetic reason).'),
  ('d0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000007', 'approved', now(), null,
   now(), '00000000-0000-4000-8000-000000000002', null)
on conflict (id) do nothing;

-- ── Evidence metadata (synthetic, confirmed uploads) ────────────────────────

insert into public.verification_evidence
  (id, barangay_id, application_id, kind, mime_type, storage_path,
   declared_size_bytes, size_bytes, content_hash, uploaded_at)
values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'd0000000-0000-4000-8000-000000000001', 'identity', 'image/png',
   'a0000000-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000001/e0000000-0000-4000-8000-000000000001',
   2048, 2048,
   '1111111111111111111111111111111111111111111111111111111111111111', now()),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'd0000000-0000-4000-8000-000000000001', 'residency', 'application/pdf',
   'a0000000-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000001/e0000000-0000-4000-8000-000000000002',
   4096, 4096,
   '2222222222222222222222222222222222222222222222222222222222222222', now()),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'd0000000-0000-4000-8000-000000000002', 'identity', 'image/jpeg',
   'a0000000-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000002/e0000000-0000-4000-8000-000000000003',
   1024, 1024,
   '3333333333333333333333333333333333333333333333333333333333333333', now())
on conflict (id) do nothing;

-- ── Outbox intent for the approved application ──────────────────────────────

insert into public.outbox_events (barangay_id, event_type, payload)
select 'a0000000-0000-4000-8000-000000000001', 'verification.approved',
       jsonb_build_object(
         'application_id', 'd0000000-0000-4000-8000-000000000004',
         'person_id', 'c0000000-0000-4000-8000-000000000007')
where not exists (
  select 1 from public.outbox_events
  where event_type = 'verification.approved'
);

do $$
begin
  raise notice 'barangay-hub seed: slice 2A — 8 persons, 4 applications, registry fixtures';
end $$;
