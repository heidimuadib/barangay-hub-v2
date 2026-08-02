-- ============================================================================
-- Slice 1 · US-DB-002 · Tier 1 reference data: roles, permissions, mappings
--
-- Reference data lives in a MIGRATION, not a seed: it is part of the schema
-- contract and must exist identically in every environment. Development
-- fixtures (Tier 3) live in supabase/seed/ behind the Phase 6 §22.2 guard.
--
-- Role catalog: proposed ADR-0005. Names align with the application shells
-- ((platform)/(staff)/(resident)) and with Phase 4 §16.4's platform/tenant
-- separation. The catalog is deliberately minimal — later slices add
-- capabilities, not ad-hoc roles.
-- ============================================================================

insert into public.roles (key, scope, name, description) values
  ('platform_administrator', 'platform',
   'Platform administrator',
   'Operates the platform console: tenant lifecycle and platform-scope audit. Carries NO implicit access to any barangay''s data (Phase 4 §16.4).'),
  ('barangay_administrator', 'barangay',
   'Barangay administrator',
   'Full administrative authority within one barangay: membership lifecycle, role assignment, audit review.'),
  ('barangay_staff', 'barangay',
   'Barangay staff',
   'Operational staff within one barangay. Reads the member roster; cannot change memberships or roles.'),
  ('resident', 'barangay',
   'Resident',
   'Self-service access to the member''s own records within one barangay.');

insert into public.permissions (key, scope, description) values
  ('membership.read',   'barangay', 'View the barangay''s member roster and member profiles.'),
  ('membership.manage', 'barangay', 'Invite members and change membership status (activate, disable).'),
  ('role.assign',       'barangay', 'Grant and revoke barangay-scoped roles.'),
  ('audit.read',        'barangay', 'Read the barangay''s audit log.'),
  ('platform.barangay.read', 'platform', 'List tenant metadata in the platform console. Not tenant data.'),
  ('platform.audit.read',    'platform', 'Read platform-scope (tenant-less) audit events.');

insert into public.role_permissions (role_key, permission_key, scope) values
  ('barangay_administrator', 'membership.read',   'barangay'),
  ('barangay_administrator', 'membership.manage', 'barangay'),
  ('barangay_administrator', 'role.assign',       'barangay'),
  ('barangay_administrator', 'audit.read',        'barangay'),
  ('barangay_staff',         'membership.read',   'barangay'),
  ('platform_administrator', 'platform.barangay.read', 'platform'),
  ('platform_administrator', 'platform.audit.read',    'platform');

-- 'resident' intentionally maps to no capability: residents act through
-- self-scoped RLS policies (own profile, own memberships), never through
-- grants over other members' data.
