-- ============================================================================
-- Slice 2A · Reference data: residency catalog, capabilities, role mapping
--
-- Exactly the vocabulary approved in ADR-0006 (D2-01, D2-04). Reference data
-- lives in migrations, never seeds (Slice 0a convention).
-- ============================================================================

-- ── D2-01: residency bases ──────────────────────────────────────────────────

insert into public.residency_bases (key, name, requires_explanation) values
  ('property_owner',    'Property owner',            false),
  ('renter',            'Renter',                    false),
  ('household_member',  'Household member',          false),
  ('caretaker',         'Caretaker',                 false),
  ('informal_resident', 'Informal resident',         false),
  ('other',             'Other (explain)',           true);

-- ── D2-04: Slice 2 capability keys ──────────────────────────────────────────

insert into public.permissions (key, scope, description) values
  ('registry.read',                    'barangay', 'Search and read the person registry, including duplicate candidates.'),
  ('registry.create_walk_in',          'barangay', 'Create a walk-in person record (staff-assisted channel).'),
  ('registry.match_account',           'barangay', 'Link or unlink an auth account to a person through the audited workflow.'),
  ('registry.resolve_duplicates',      'barangay', 'Resolve duplicate persons by supersede-and-link.'),
  ('verification.read',                'barangay', 'Read verification applications and their states.'),
  ('verification.review',              'barangay', 'Move submitted/resubmitted applications into review; assist evidence handling.'),
  ('verification.request_information', 'barangay', 'Return an in-review application to the resident with a note.'),
  ('verification.approve',             'barangay', 'Approve an in-review application (activates resident membership).'),
  ('verification.reject',              'barangay', 'Reject an in-review application; a reason is mandatory.'),
  ('verification.evidence.read',       'barangay', 'Read evidence metadata and obtain authorized evidence access.');

-- ── D2-04: default role mapping ─────────────────────────────────────────────
-- resident: NO staff capabilities — self-scoped through RLS only.
-- platform_administrator: none of these (ADR-0006 point 18).

insert into public.role_permissions (role_key, permission_key, scope) values
  ('barangay_staff', 'registry.read',                    'barangay'),
  ('barangay_staff', 'verification.read',                'barangay'),
  ('barangay_staff', 'verification.review',              'barangay'),
  ('barangay_staff', 'verification.request_information', 'barangay'),

  ('barangay_administrator', 'registry.read',                    'barangay'),
  ('barangay_administrator', 'registry.create_walk_in',          'barangay'),
  ('barangay_administrator', 'registry.match_account',           'barangay'),
  ('barangay_administrator', 'registry.resolve_duplicates',      'barangay'),
  ('barangay_administrator', 'verification.read',                'barangay'),
  ('barangay_administrator', 'verification.review',              'barangay'),
  ('barangay_administrator', 'verification.request_information', 'barangay'),
  ('barangay_administrator', 'verification.approve',             'barangay'),
  ('barangay_administrator', 'verification.reject',              'barangay'),
  ('barangay_administrator', 'verification.evidence.read',       'barangay');
