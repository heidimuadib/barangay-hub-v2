-- ============================================================================
-- Seed · Slice 4A · Certificate and serial fixtures (Tier 3)
--
-- SYNTHETIC content only (DEC-ENV-04). Same guard as every other seed.
--
-- EVERY word of template body below is INVENTED for testing. No barangay has
-- approved any of it (B-05/-06/-07), which is why every template keeps
-- `content_is_placeholder = true` and carries no real signatory name. The
-- serial FORMAT is equally invented (roadmap Slice 4 §8 — owner sign-off
-- pending), so the series keeps `format_is_placeholder = true`.
--
-- The seed must never be the place where invented legal wording quietly
-- becomes official text.
--
-- Coverage: an active series for the current year; templates for two document
-- types (one of which is deliberately INACTIVE); one issued certificate
-- against the seeded ready_for_issue request; one voided certificate proving
-- the serial stays consumed and the gap is explained; a cross-tenant series
-- and certificate so isolation tests have something real to fail to see.
-- ============================================================================

do $$
begin
  if exists (select 1 from public.barangays where code not like 'test-%') then
    raise exception
      'SEED REFUSED: barangays without the test- prefix exist (Phase 6 §22.2).';
  end if;
end $$;

-- ── Serial series ───────────────────────────────────────────────────────────
-- next_sequence starts at 3 because the two seeded certificates below consume
-- 1 and 2. Seeding the counter to match its own history keeps the book
-- internally consistent, which is exactly what the accountability tests check.

insert into public.certificate_series
  (id, barangay_id, year, prefix, next_sequence, sequence_width)
values
  ('c1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   extract(year from now())::integer, 'SI', 3, 5),
  -- Cross-tenant: San Isidro must never allocate from, or read, this book.
  -- next_sequence = 2 because its one seeded certificate consumed 1. A book
  -- whose counter sits at or below its own history would collide on the next
  -- allocation — `db:reset:verified` checks exactly this, and caught it here.
  ('c1000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000002',
   extract(year from now())::integer, 'MAL', 2, 5)
on conflict (id) do nothing;

-- ── Templates ───────────────────────────────────────────────────────────────
-- The bodies use {{placeholder}} tokens that 4B will resolve. They are written
-- to look OBVIOUSLY synthetic rather than plausibly official.

insert into public.certificate_templates
  (id, barangay_id, document_type_id, code, name, body,
   signatory_name, signatory_title, is_active)
values
  ('c2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'f0000000-0000-4000-8000-000000000001', 'barangay-clearance-v1',
   'Barangay Clearance (Test Template)',
   E'SYNTHETIC TEST TEMPLATE — NOT APPROVED WORDING (B-05).\n\n'
   'This is to certify that {{resident_full_name}} is a resident of '
   '{{barangay_name}} and is known to this office.\n\n'
   'Issued on {{issue_date}} under serial {{serial_display}}.\n\n'
   'Placeholder signatory block pending B-06/B-07 confirmation.',
   null, null, true),

  ('c2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'f0000000-0000-4000-8000-000000000002', 'indigency-v1',
   'Certificate of Indigency (Test Template)',
   E'SYNTHETIC TEST TEMPLATE — NOT APPROVED WORDING (B-05).\n\n'
   'This is to certify that {{resident_full_name}} belongs to an indigent '
   'household of {{barangay_name}}.\n\n'
   'Issued on {{issue_date}} under serial {{serial_display}}.',
   null, null, true),

  -- Retired template: a barangay replaced it. Kept because issued
  -- certificates reference it forever.
  ('c2000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'f0000000-0000-4000-8000-000000000001', 'barangay-clearance-v0',
   'Barangay Clearance (Test Template, retired)',
   'SYNTHETIC RETIRED TEST TEMPLATE — NOT APPROVED WORDING (B-05).',
   null, null, false),

  -- Cross-tenant template for isolation tests.
  ('c2000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000002',
   'f0000000-0000-4000-8000-000000000011', 'barangay-clearance-v1',
   'Barangay Clearance (Test Template, Malinis)',
   'SYNTHETIC TEST TEMPLATE — NOT APPROVED WORDING (B-05).',
   null, null, true)
on conflict (id) do nothing;

-- ── Certificates ────────────────────────────────────────────────────────────
-- Inserted on the owner path in their final states. The request f2…04 is the
-- Slice 3 fixture already sitting in ready_for_issue, which is the only state
-- issuance accepts.
--
-- Tokens are fixed 64-hex strings so tests can address them; real tokens come
-- from gen_random_bytes and are never predictable.

insert into public.certificates
  (id, barangay_id, request_id, person_id, template_id, series_id,
   serial_sequence, serial_display, verification_token, status, issued_by)
values
  -- Serial 1: live, against the seeded ready_for_issue request.
  ('c3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'f2000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000007',
   'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   1, 'SI-' || extract(year from now())::text || '-00001',
   'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
   'issued', '00000000-0000-4000-8000-000000000002'),

  -- Serial 2: VOIDED. The number stays consumed — this is the gap the
  -- accountability tests look for, and certificate_voids explains it.
  ('c3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'f2000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000004',
   'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   2, 'SI-' || extract(year from now())::text || '-00002',
   'b1c2d3e4f5a60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f91',
   'voided', '00000000-0000-4000-8000-000000000002'),

  -- Cross-tenant certificate: San Isidro staff must never see this.
  ('c3000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000002',
   'f2000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000015',
   'c2000000-0000-4000-8000-000000000011', 'c1000000-0000-4000-8000-000000000011',
   1, 'MAL-' || extract(year from now())::text || '-00001',
   'c1d2e3f4a5b60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f92',
   'issued', '00000000-0000-4000-8000-000000000005')
on conflict (id) do nothing;

-- The void record for serial 2. Written after the certificate so the FK holds.
insert into public.certificate_voids
  (id, barangay_id, certificate_id, reason, voided_by)
values
  ('c4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'c3000000-0000-4000-8000-000000000002',
   'Issued against the wrong template (synthetic reason).',
   '00000000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

-- ── Outbox intents matching the seeded issuances ────────────────────────────
-- Each live issuance would have enqueued one release intent had it travelled
-- through issue_certificate; seeding them keeps the outbox consistent with the
-- certificate states a test will find.

insert into public.outbox_events (barangay_id, event_type, payload)
select 'a0000000-0000-4000-8000-000000000001', 'certificate.ready_for_release',
       jsonb_build_object('certificate_id', 'c3000000-0000-4000-8000-000000000001',
                          'request_id',     'f2000000-0000-4000-8000-000000000004',
                          'person_id',      'c0000000-0000-4000-8000-000000000007')
where not exists (
  select 1 from public.outbox_events where event_type = 'certificate.ready_for_release'
);

do $$
begin
  raise notice 'barangay-hub seed: slice 4A — 2 series, 4 templates, 3 certificates (1 voided). ALL wording and serial formats are SYNTHETIC and placeholder-flagged (B-05/-06/-07, serial format pending).';
end $$;
