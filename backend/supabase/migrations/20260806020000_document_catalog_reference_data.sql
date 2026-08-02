-- ============================================================================
-- Slice 3A · Reference data: capabilities and role mapping
--
-- Reference data lives in migrations, never seeds (Slice 0a convention).
--
-- Granularity follows Slice 2's precedent (D2-04): ONE capability per
-- meaningful transition rather than a single blanket `requests.transition`.
-- That is what lets a barangay give front-desk staff the ability to start a
-- review without also granting them the authority to declare a document ready
-- to issue — the same reason `verification.approve` is separate from
-- `verification.review`.
-- ============================================================================

insert into public.permissions (key, scope, description) values
  ('documents.catalog.read',   'barangay', 'Read the full document catalog, including inactive types.'),
  ('documents.catalog.manage', 'barangay', 'Create and amend document types, their requirements, and their fee/SLA/validity values.'),
  ('requests.read',            'barangay', 'Read document requests in this barangay and their intake queue.'),
  ('requests.create_walk_in',  'barangay', 'Create a document request on behalf of a resident (staff-assisted channel).'),
  ('requests.review',          'barangay', 'Take a submitted request into review.'),
  ('requests.mark_ready',      'barangay', 'Declare a reviewed request ready for issue (hand-off to Slice 4).');

-- ── Default role mapping ────────────────────────────────────────────────────
-- resident: NO capability. Residents reach their own catalog and their own
-- requests through self-scoped RLS, exactly as in Slice 2.
-- platform_administrator: none of these — no tenant request data, ever
-- (ADR-0006 point 18, Phase 4 §16.4).

insert into public.role_permissions (role_key, permission_key, scope) values
  -- Front-desk staff: see the catalog, work the queue, start reviews.
  -- Deliberately NOT create_walk_in or mark_ready — those carry commitment
  -- (a record created for someone else; a promise the document is ready).
  ('barangay_staff', 'documents.catalog.read', 'barangay'),
  ('barangay_staff', 'requests.read',          'barangay'),
  ('barangay_staff', 'requests.review',        'barangay'),

  ('barangay_administrator', 'documents.catalog.read',   'barangay'),
  ('barangay_administrator', 'documents.catalog.manage', 'barangay'),
  ('barangay_administrator', 'requests.read',            'barangay'),
  ('barangay_administrator', 'requests.create_walk_in',  'barangay'),
  ('barangay_administrator', 'requests.review',          'barangay'),
  ('barangay_administrator', 'requests.mark_ready',      'barangay');
