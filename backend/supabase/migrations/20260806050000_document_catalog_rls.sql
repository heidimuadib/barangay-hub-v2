-- ============================================================================
-- Slice 3A · Catalog and request RLS: forced, deny-by-default, read-only
-- clients
--
-- Identical discipline to Slice 2A: writes NEVER flow through table grants.
-- Every mutation is a SECURITY DEFINER function that re-checks capability or
-- ownership itself, so the grant surface for `authenticated` is SELECT-only
-- and `anon` holds nothing at all.
--
-- Note on the public catalog: the roadmap's US-UI-006 public portal (Slice 3
-- UI work) would need an anon-readable catalog. That grant is deliberately
-- NOT made here — 3A ships the domain, and opening a table to anon is a
-- decision that deserves its own reviewed change alongside the surface that
-- needs it.
-- ============================================================================

alter table public.document_types             enable row level security;
alter table public.document_types             force  row level security;
alter table public.document_type_requirements enable row level security;
alter table public.document_type_requirements force  row level security;
alter table public.document_requests          enable row level security;
alter table public.document_requests          force  row level security;
alter table public.document_request_answers   enable row level security;
alter table public.document_request_answers   force  row level security;

revoke all on public.document_types,
              public.document_type_requirements,
              public.document_requests,
              public.document_request_answers
  from public, anon, authenticated;

grant select on public.document_types             to authenticated;
grant select on public.document_type_requirements to authenticated;
grant select on public.document_requests          to authenticated;
grant select on public.document_request_answers   to authenticated;

-- ── System policies (forced RLS re-opened explicitly for owner paths) ───────

create policy document_types_system_all on public.document_types
  as permissive for all to postgres, service_role using (true) with check (true);
create policy document_type_requirements_system_all on public.document_type_requirements
  as permissive for all to postgres, service_role using (true) with check (true);
create policy document_requests_system_all on public.document_requests
  as permissive for all to postgres, service_role using (true) with check (true);
create policy document_request_answers_system_all on public.document_request_answers
  as permissive for all to postgres, service_role using (true) with check (true);

-- ── document_types ──────────────────────────────────────────────────────────
-- A member of the barangay sees its ACTIVE catalog. Seeing inactive types —
-- the ones withdrawn from service — requires documents.catalog.read.
-- Platform administrators match neither branch: no tenant data (Phase 4 §16.4).

create policy document_types_select on public.document_types
  for select to authenticated
  using (
    (is_active and public.auth_is_active_member(barangay_id))
    or public.auth_has_permission(barangay_id, 'documents.catalog.read')
  );

-- ── document_type_requirements ──────────────────────────────────────────────
-- Visibility follows the parent type exactly; a requirement is meaningless
-- without it, and duplicating the rule here would let the two drift.

create policy document_type_requirements_select on public.document_type_requirements
  for select to authenticated
  using (public.document_type_is_visible(document_type_id));

-- ── document_requests ───────────────────────────────────────────────────────
-- The requester (through the account↔person link) or requests.read. A walk-in
-- request for a person with no account is reachable only by capability —
-- there is nobody to own it.

create policy document_requests_select on public.document_requests
  for select to authenticated
  using (
    public.caller_owns_request(id)
    or public.auth_has_permission(barangay_id, 'requests.read')
  );

-- ── document_request_answers ────────────────────────────────────────────────
-- Answers are resident-supplied personal data, so they inherit the request's
-- rule rather than being readable by anyone who can see a request exists.

create policy document_request_answers_select on public.document_request_answers
  for select to authenticated
  using (
    public.caller_owns_request(request_id)
    or public.auth_has_permission(barangay_id, 'requests.read')
  );
