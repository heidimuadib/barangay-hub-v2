-- ============================================================================
-- Seed · Slice 3B · Resident request intake fixtures (Tier 3)
--
-- SYNTHETIC identities only (DEC-ENV-04). Same guard as every other seed.
--
-- ONE persona, for one reason the existing fixtures cannot express.
--
-- The 3B gate is "a request may be filed only by a VERIFIED resident". Proving
-- it needs someone who clears every OTHER hurdle and is refused solely for
-- want of verification. None of the seeded personas do that:
--
--   • resident.sanisidro  — active member AND approved: the happy path;
--   • applicant.sanisidro — has a person and a `submitted` application, but no
--     membership at all, so a refusal proves nothing about verification;
--   • invited/disabled    — memberships without a person record.
--
-- So: an ACTIVE member, holding the resident role, with a person record and an
-- application still in `submitted`. They can sign in, they can browse the
-- catalog — and the database must still refuse their request. That state is
-- reachable in production whenever staff add a member before verification
-- finishes (`create_membership_by_email`), which is why it is worth a fixture
-- rather than a mock.
-- ============================================================================

do $$
begin
  if exists (select 1 from public.barangays where code not like 'test-%') then
    raise exception
      'SEED REFUSED: barangays without the test- prefix exist (Phase 6 §22.2).';
  end if;
end $$;

-- ── Account (password: password123-local, as every other persona) ───────────

do $$
declare fixture record;
begin
  for fixture in
    select * from (values
      ('00000000-0000-4000-8000-000000000013'::uuid,
       'unverified.sanisidro@barangay-hub.test', 'Member Unverified (Test)')
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

-- ── Active membership with the resident role ────────────────────────────────
-- The catalog is member-visible (3A RLS), so this persona genuinely reaches
-- the browse surface. Only the REQUEST is refused.

insert into public.memberships (id, barangay_id, user_id, status) values
  ('b0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000013', 'active')
on conflict (id) do nothing;

insert into public.membership_roles (membership_id, barangay_id, role_key) values
  ('b0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000001',
   'resident')
on conflict (membership_id, role_key) do nothing;

-- ── Person, linked account, and an application that is NOT approved ─────────

insert into public.persons
  (id, barangay_id, first_name, last_name, birthdate, residency_basis_key,
   residency_basis_explanation, source_channel, creation_reason)
values
  ('c0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001',
   'Member', 'Unverified (Test)', date '1995-09-09', 'renter', null, 'self', null)
on conflict (id) do nothing;

insert into public.person_accounts (person_id, barangay_id, user_id) values
  ('c0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000013')
on conflict (person_id) do nothing;

insert into public.verification_applications
  (id, barangay_id, person_id, state, submitted_at, info_request_note,
   decided_at, decided_by, decision_reason)
values
  ('d0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000008', 'submitted', now(), null, null, null, null)
on conflict (id) do nothing;

do $$
begin
  raise notice 'barangay-hub seed: slice 3B — 1 active-but-unverified member persona (request intake gate)';
end $$;
