-- ============================================================================
-- Seed — Slice 0a
--
-- Slice 0a has no seed data: no tenant-scoped tables exist yet.
--
-- Tier 1 (platform reference: roles, permissions, role_permissions, retention
-- classes, notification event types, error classes, platform feature flags)
-- arrives in Slice 1 with US-DB-002 → US-DB-005.
--
-- Tier 2 (tenant onboarding catalogs, all flagged `values_are_placeholder`) and
-- Tier 3 (development fixtures, two synthetic tenants) follow in Slices 1–2.
--
-- The production guard that refuses Tier 2/3 seeds against a project containing
-- a tenant not prefixed `test-` (Phase 6 §22.2) is implemented alongside the
-- `barangays` table in US-DB-002 — it cannot exist before the table it inspects.
--
-- This file exists so that `[db.seed].sql_paths` resolves on `supabase db reset`.
-- ============================================================================

do $$
begin
  raise notice 'barangay-hub seed: slice 0a — extensions only, no data';
end $$;
