-- ============================================================================
-- Seed · Slice 1 · Tier 3 development fixtures
--
-- SYNTHETIC identities only. Every value is fake by construction:
-- @barangay-hub.test addresses, "(Test)" display names, test- tenant codes.
-- The shared local password is documented in docs/local-setup.md.
--
-- Production guard (Phase 6 §22.2): these fixtures refuse to run wherever a
-- tenant exists whose code is not prefixed 'test-' — i.e. any database that
-- has ever held a real tenant.
-- ============================================================================

do $$
begin
  if exists (select 1 from public.barangays where code not like 'test-%') then
    raise exception
      'SEED REFUSED: barangays without the test- prefix exist. Tier 3 fixtures never run against a database holding real tenants (Phase 6 §22.2).';
  end if;
end $$;

-- ── Tenants ─────────────────────────────────────────────────────────────────

insert into public.barangays (id, code, name) values
  ('a0000000-0000-4000-8000-000000000001', 'test-san-isidro', 'San Isidro (Test)'),
  ('a0000000-0000-4000-8000-000000000002', 'test-malinis',    'Malinis (Test)')
on conflict (id) do nothing;

-- ── Accounts ────────────────────────────────────────────────────────────────
-- Nine deterministic accounts covering every positive and negative
-- authorization case. Password (all): password123-local

do $$
declare
  fixture record;
begin
  for fixture in
    select * from (values
      ('00000000-0000-4000-8000-000000000001'::uuid, 'platform.admin@barangay-hub.test',    'Platform Admin (Test)'),
      ('00000000-0000-4000-8000-000000000002'::uuid, 'admin.sanisidro@barangay-hub.test',   'San Isidro Admin (Test)'),
      ('00000000-0000-4000-8000-000000000003'::uuid, 'staff.sanisidro@barangay-hub.test',   'San Isidro Staff (Test)'),
      ('00000000-0000-4000-8000-000000000004'::uuid, 'resident.sanisidro@barangay-hub.test','San Isidro Resident (Test)'),
      ('00000000-0000-4000-8000-000000000005'::uuid, 'admin.malinis@barangay-hub.test',     'Malinis Admin (Test)'),
      ('00000000-0000-4000-8000-000000000006'::uuid, 'resident.malinis@barangay-hub.test',  'Malinis Resident (Test)'),
      ('00000000-0000-4000-8000-000000000007'::uuid, 'disabled.sanisidro@barangay-hub.test','Disabled Member (Test)'),
      ('00000000-0000-4000-8000-000000000008'::uuid, 'invited.sanisidro@barangay-hub.test', 'Invited Member (Test)'),
      ('00000000-0000-4000-8000-000000000009'::uuid, 'dual.member@barangay-hub.test',       'Dual Member (Test)')
    ) as t(id, email, display_name)
  loop
    insert into auth.users
      (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
       confirmation_token, recovery_token, email_change_token_new, email_change)
    values
      (fixture.id,
       '00000000-0000-0000-0000-000000000000',
       'authenticated',
       'authenticated',
       fixture.email,
       extensions.crypt('password123-local', extensions.gen_salt('bf')),
       now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('display_name', fixture.display_name),
       now(), now(), '', '', '', '')
    on conflict (id) do nothing;

    insert into auth.identities
      (id, user_id, provider_id, provider, identity_data,
       last_sign_in_at, created_at, updated_at)
    values
      (gen_random_uuid(),
       fixture.id,
       fixture.id::text,
       'email',
       jsonb_build_object('sub', fixture.id::text, 'email', fixture.email, 'email_verified', true),
       now(), now(), now())
    on conflict (provider_id, provider) do nothing;
  end loop;
end $$;

-- user_profiles rows are created by the on_auth_user_created trigger.

-- ── Memberships ─────────────────────────────────────────────────────────────

insert into public.memberships (id, barangay_id, user_id, status) values
  -- San Isidro (tenant A)
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000002', 'active'),   -- admin
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000003', 'active'),   -- staff
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000004', 'active'),   -- resident
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000007', 'disabled'), -- revoked member
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000008', 'invited'),  -- not yet active
  ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000009', 'active'),   -- dual member, tenant A
  -- Malinis (tenant B)
  ('b0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-000000000005', 'active'),   -- admin
  ('b0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-000000000006', 'active'),   -- resident
  ('b0000000-0000-4000-8000-000000000019', 'a0000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-000000000009', 'active')    -- dual member, tenant B
on conflict (id) do nothing;

-- ── Role assignments ────────────────────────────────────────────────────────

insert into public.membership_roles (membership_id, barangay_id, role_key) values
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'barangay_administrator'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'barangay_staff'),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'resident'),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'resident'),
  -- Roles on an INVITED membership grant nothing until activation — negative case.
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'barangay_staff'),
  ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'resident'),
  ('b0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000002', 'barangay_administrator'),
  ('b0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000002', 'resident'),
  ('b0000000-0000-4000-8000-000000000019', 'a0000000-0000-4000-8000-000000000002', 'resident')
on conflict (membership_id, role_key) do nothing;

-- The platform administrator holds NO barangay membership: the console must
-- work — and tenant data must stay invisible — without one (Phase 4 §16.4).
insert into public.platform_role_assignments (user_id, role_key) values
  ('00000000-0000-4000-8000-000000000001', 'platform_administrator')
on conflict (user_id, role_key) do nothing;

do $$
begin
  raise notice 'barangay-hub seed: slice 1 — 2 test tenants, 9 synthetic accounts';
end $$;
