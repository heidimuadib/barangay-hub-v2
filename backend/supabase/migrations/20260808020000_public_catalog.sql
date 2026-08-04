-- ============================================================================
-- Slice 3D · The public catalog (US-UI-006)
--
-- 3A withheld this deliberately, and said why: "opening a table to `anon` is a
-- decision that belongs with the surface that needs it, not with the domain."
-- This is that surface, so this is that decision — written narrowly enough
-- that what it exposes can be stated in one sentence.
--
-- WHAT ANON MAY SEE: the name, description, code and commercial terms of
-- ACTIVE document types, in barangays that are themselves active.
--
-- WHAT ANON MAY NOT SEE, and cannot reach from here: any request, any answer,
-- any person, any evidence, any inactive type, any audit row, any outbox row.
-- Those tables grant `anon` nothing, and nothing below changes that.
--
-- Read-only by construction: SELECT is the only grant, and the policy is a
-- SELECT policy. There is no anon INSERT/UPDATE/DELETE path to any table in
-- this database.
-- ============================================================================

-- ── Requirements are part of the public answer ──────────────────────────────
-- A catalog that lists a document without saying what it asks for sends people
-- to the barangay hall to find out — which is the trip the portal exists to
-- save. The requirement LABELS are the barangay's own public prose; no answer,
-- and no resident, is reachable through them.

grant select on public.document_types             to anon;
grant select on public.document_type_requirements to anon;

-- ── Is this barangay publicly listed? ───────────────────────────────────────
--
-- SECURITY DEFINER, and necessarily so. A policy expression is evaluated as
-- the QUERYING role, so a policy that selected from `public.barangays`
-- directly would need `anon` to hold a grant on that table — widening the
-- anonymous surface from two tables to three to satisfy an implementation
-- detail of the rule. The helper keeps the grant inventory exactly as narrow
-- as it should be, and is the same technique `caller_owns_request` uses.
--
-- It answers one boolean about one id and discloses nothing else.

create function public.barangay_is_public(p_barangay_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.barangays b
    where b.id = p_barangay_id and b.is_active
  );
$$;

comment on function public.barangay_is_public is
  'Whether this barangay is active and therefore publicly listed. Exists so the US-UI-006 policies need no anon grant on `barangays`.';

revoke execute on function public.barangay_is_public(uuid) from public;
grant execute on function public.barangay_is_public(uuid) to anon, authenticated;

-- ── Policies ────────────────────────────────────────────────────────────────
-- Separate policies for `anon` rather than widening the authenticated ones:
-- the two audiences differ, and a single policy trying to serve both is how a
-- future edit quietly gives anonymous visitors a member's view.

create policy document_types_public_select on public.document_types
  for select to anon
  using (is_active and public.barangay_is_public(barangay_id));

comment on policy document_types_public_select on public.document_types is
  'US-UI-006: anonymous visitors see ACTIVE types in ACTIVE barangays. Withdrawn types stay staff-only — a document the barangay no longer issues must not appear on its public page.';

create policy document_type_requirements_public_select
  on public.document_type_requirements
  for select to anon
  using (
    exists (
      select 1 from public.document_types dt
      where dt.id = document_type_requirements.document_type_id
        and dt.is_active
        and public.barangay_is_public(dt.barangay_id)
    )
  );

comment on policy document_type_requirements_public_select
  on public.document_type_requirements is
  'Visibility follows the parent type exactly. Written as its own EXISTS rather than reusing document_type_is_visible(), which is an AUTHENTICATED-audience helper — calling it here would make the public rule depend on a definition that may change for members.';

-- ── The public barangay directory ───────────────────────────────────────────
-- The portal needs to name the barangay whose catalog it is showing. Slice 2's
-- `list_active_barangays()` is granted to `authenticated` only; rather than
-- widen it (its callers assume a session), the public surface gets its own
-- function returning strictly less: id, name, code, and nothing else.

create function public.list_public_barangays()
returns table (id uuid, name text, code text)
language sql stable security definer set search_path = ''
as $$
  select b.id, b.name, b.code
  from public.barangays b
  where b.is_active
  order by b.name;
$$;

comment on function public.list_public_barangays is
  'US-UI-006 directory. Returns only what a public page needs to name a barangay; deliberately narrower than list_active_barangays(), whose callers assume a session.';

revoke execute on function public.list_public_barangays() from public;
grant execute on function public.list_public_barangays() to anon, authenticated;
