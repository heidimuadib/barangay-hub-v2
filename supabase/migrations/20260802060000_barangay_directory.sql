-- ============================================================================
-- Slice 2B · Barangay directory for onboarding
--
-- A newly confirmed account belongs to no barangay yet, so the Slice 1
-- policy (`active member OR platform.barangay.read`) correctly hides every
-- tenant from it — and that would leave onboarding with nothing to choose
-- from.
--
-- This exposes the DIRECTORY only: id, name and code of active barangays,
-- which is the same information a resident reads off the office signage. No
-- resident data, no counts, no membership information. A definer function
-- rather than a policy change keeps the surface to exactly three columns.
-- ============================================================================

create function public.list_active_barangays()
returns table (id uuid, name text, code text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.name, b.code
  from public.barangays b
  where b.is_active
  order by b.name;
$$;

comment on function public.list_active_barangays() is
  'Public tenant directory for onboarding (Slice 2B). Active barangays only, three columns, no tenant data.';

revoke execute on function public.list_active_barangays() from public, anon;
grant execute on function public.list_active_barangays() to authenticated;
