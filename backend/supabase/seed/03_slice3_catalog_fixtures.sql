-- ============================================================================
-- Seed · Slice 3A · Document catalog and request fixtures (Tier 3)
--
-- SYNTHETIC content only (DEC-ENV-04). Same guard as the Slice 1/2 seeds:
-- refuses to run wherever a non-`test-` tenant exists (Phase 6 §22.2).
--
-- EVERY fee, turnaround and validity figure below is INVENTED for testing.
-- No barangay has confirmed any of them (blocker B-08), which is why every
-- row keeps `values_are_placeholder = true` — the seed must not be the place
-- where a made-up number quietly becomes an official one. Names carry the
-- "(Test)" marker for the same reason the Slice 2 personas do.
--
-- Coverage: an active type with required + optional + select + date
-- requirements; a fee-free type; an evidence-requiring type; an INACTIVE type
-- (resident-invisible, staff-visible); a cross-tenant type for isolation; and
-- requests in all four states including one walk-in for an account-less
-- person.
-- ============================================================================

do $$
begin
  if exists (select 1 from public.barangays where code not like 'test-%') then
    raise exception
      'SEED REFUSED: barangays without the test- prefix exist (Phase 6 §22.2).';
  end if;
end $$;

-- ── Document types ──────────────────────────────────────────────────────────
-- San Isidro (a0…01) runs the working catalog; Malinis (a0…02) gets one type
-- so tenant-isolation tests have something real to fail to see.

insert into public.document_types
  (id, barangay_id, code, name, description, is_active,
   fee_amount, sla_days, validity_days, requires_supporting_evidence)
values
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'barangay-clearance', 'Barangay Clearance (Test)',
   'Synthetic catalog entry for local testing. Certifies that the requester is a resident in good standing.',
   true, 50.00, 3, 180, false),

  ('f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'certificate-of-indigency', 'Certificate of Indigency (Test)',
   'Synthetic catalog entry. Issued without charge; supporting material is requested.',
   true, 0.00, 5, 90, true),

  ('f0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'business-permit-endorsement', 'Business Permit Endorsement (Test)',
   'Synthetic catalog entry with an unconfirmed fee — the amount is deliberately NULL to exercise the "no amount decided yet" path.',
   true, null, null, 365, false),

  -- Withdrawn from service: staff with documents.catalog.read still see it;
  -- residents must not, and no new request may name it.
  ('f0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'retired-community-tax', 'Retired Community Tax Form (Test)',
   'Synthetic INACTIVE catalog entry, retained because historical requests reference it.',
   false, 25.00, 2, 30, false),

  -- Cross-tenant: must never appear in a San Isidro query.
  ('f0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000002',
   'barangay-clearance', 'Barangay Clearance (Test, Malinis)',
   'Synthetic cross-tenant catalog entry for isolation tests.',
   true, 75.00, 4, 180, false)
on conflict (id) do nothing;

-- ── Requirements ────────────────────────────────────────────────────────────

insert into public.document_type_requirements
  (id, barangay_id, document_type_id, key, label, help_text, input_kind,
   is_required, options, sort_order)
values
  -- Barangay Clearance: one required text, one required select, one optional.
  ('f1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'f0000000-0000-4000-8000-000000000001', 'years_of_residency',
   'Years of residency', 'How long the requester has lived at the address on file.',
   'number', true, '[]'::jsonb, 10),
  ('f1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'f0000000-0000-4000-8000-000000000001', 'intended_use',
   'Intended use', null,
   'select', true, '["Employment","School","Loan","Other"]'::jsonb, 20),
  ('f1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'f0000000-0000-4000-8000-000000000001', 'remarks',
   'Additional remarks', 'Optional. Anything the office should know.',
   'textarea', false, '[]'::jsonb, 30),

  -- Indigency: a date requirement, to exercise date validation.
  ('f1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'f0000000-0000-4000-8000-000000000002', 'household_survey_date',
   'Date of last household survey', null,
   'date', true, '[]'::jsonb, 10),

  -- Business endorsement: a boolean.
  ('f1000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001',
   'f0000000-0000-4000-8000-000000000003', 'operates_at_home',
   'Business operates at the home address', null,
   'boolean', true, '[]'::jsonb, 10)
on conflict (id) do nothing;

-- ── Requests ────────────────────────────────────────────────────────────────
-- Inserted directly in their scenario states (owner path; the transition
-- trigger governs UPDATEs). Persons come from the Slice 2 seed:
--   c0…01 Applicant One      — account 00…10
--   c0…07 Resident SanIsidro — account 00…04 (approved, active member)
--   c0…04 Juan Dela Cruz     — walk-in, NO account
--   c0…15 Maria Santos       — Malinis tenant

insert into public.document_requests
  (id, barangay_id, document_type_id, person_id, state, source_channel,
   created_by, creation_reason, purpose, submitted_at, review_started_at, ready_at)
values
  -- Draft, self-service: nothing has reached the queue.
  ('f2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000007',
   'draft', 'self', null, null,
   'Employment requirement (synthetic).', null, null, null),

  -- Submitted, self-service: the queue's oldest actionable item.
  ('f2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'submitted', 'self', null, null,
   'Scholarship application (synthetic).', now(), null, null),

  -- In review, staff-assisted for an ACCOUNT-LESS walk-in person.
  ('f2000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004',
   'in_review', 'staff', '00000000-0000-4000-8000-000000000002',
   'Walk-in request taken at the counter (synthetic).',
   'Loan application (synthetic).', now(), now(), null),

  -- Ready for issue: the Slice 4 hand-off point.
  ('f2000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000007',
   'ready_for_issue', 'self', null, null,
   'Sari-sari store endorsement (synthetic).', now(), now(), now()),

  -- Cross-tenant request: San Isidro staff must never see this.
  ('f2000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000002',
   'f0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000015',
   'submitted', 'staff', '00000000-0000-4000-8000-000000000002',
   'Cross-tenant isolation fixture (synthetic).',
   'Isolation fixture (synthetic).', now(), null, null)
on conflict (id) do nothing;

-- ── Answers ─────────────────────────────────────────────────────────────────
-- Only for requests that left draft, so the submitted ones are genuinely
-- complete. The answer trigger refuses writes once a request is past draft,
-- so these are inserted with the session in owner context (the seed runs as
-- postgres) — the trigger's state check is bypassed only because the seed
-- writes the request rows in their final state first. Values are synthetic.

alter table public.document_request_answers disable trigger document_request_answers_before_write;

insert into public.document_request_answers
  (id, barangay_id, request_id, requirement_id, value)
values
  ('f3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'f2000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000004',
   '2026-01-15'),
  ('f3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'f2000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000001',
   '12'),
  ('f3000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'f2000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000002',
   'Loan'),
  ('f3000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'f2000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000005',
   'true')
on conflict (id) do nothing;

alter table public.document_request_answers enable trigger document_request_answers_before_write;

-- ── Outbox intents matching the seeded states ───────────────────────────────
-- The in_review and ready_for_issue fixtures would each have enqueued one
-- intent had they travelled through the functions; seeding them keeps the
-- outbox consistent with the request states a test will find.

insert into public.outbox_events (barangay_id, event_type, payload)
select 'a0000000-0000-4000-8000-000000000001', 'request.in_review',
       jsonb_build_object('request_id', 'f2000000-0000-4000-8000-000000000003',
                          'person_id',  'c0000000-0000-4000-8000-000000000004')
where not exists (
  select 1 from public.outbox_events where event_type = 'request.in_review'
);

insert into public.outbox_events (barangay_id, event_type, payload)
select 'a0000000-0000-4000-8000-000000000001', 'request.ready_for_issue',
       jsonb_build_object('request_id', 'f2000000-0000-4000-8000-000000000004',
                          'person_id',  'c0000000-0000-4000-8000-000000000007')
where not exists (
  select 1 from public.outbox_events where event_type = 'request.ready_for_issue'
);

do $$
begin
  raise notice 'barangay-hub seed: slice 3A — 5 document types, 5 requirements, 5 requests (all fees/SLAs SYNTHETIC, B-08 unconfirmed)';
end $$;
