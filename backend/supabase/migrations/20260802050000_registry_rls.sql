-- ============================================================================
-- Slice 2A · Registry RLS: forced, deny-by-default, read-only clients
--
-- Writes NEVER flow through table grants: every mutation is a SECURITY
-- DEFINER function that re-checks capability or ownership itself. The grant
-- surface for authenticated is therefore SELECT-only, and anon holds nothing
-- (public registration enters through Supabase Auth, not these tables —
-- roadmap Slice 2 §10).
-- ============================================================================

alter table public.residency_bases          enable row level security;
alter table public.residency_bases          force row level security;
alter table public.persons                  enable row level security;
alter table public.persons                  force row level security;
alter table public.person_accounts          enable row level security;
alter table public.person_accounts          force row level security;
alter table public.verification_applications enable row level security;
alter table public.verification_applications force row level security;
alter table public.verification_evidence    enable row level security;
alter table public.verification_evidence    force row level security;
alter table public.outbox_events            enable row level security;
alter table public.outbox_events            force row level security;

revoke all on public.residency_bases,
              public.persons,
              public.person_accounts,
              public.verification_applications,
              public.verification_evidence,
              public.outbox_events
  from public, anon, authenticated;

grant select on public.residency_bases           to authenticated;
grant select on public.persons                   to authenticated;
grant select on public.person_accounts           to authenticated;
grant select on public.verification_applications to authenticated;
grant select on public.verification_evidence     to authenticated;
-- outbox_events: NO client privilege of any kind. The Slice 8 dispatcher is
-- a service-role operation.

-- ── System policies (forced RLS re-opened explicitly for owner paths) ───────

create policy residency_bases_system_all on public.residency_bases
  as permissive for all to postgres, service_role using (true) with check (true);
create policy persons_system_all on public.persons
  as permissive for all to postgres, service_role using (true) with check (true);
create policy person_accounts_system_all on public.person_accounts
  as permissive for all to postgres, service_role using (true) with check (true);
create policy verification_applications_system_all on public.verification_applications
  as permissive for all to postgres, service_role using (true) with check (true);
create policy verification_evidence_system_all on public.verification_evidence
  as permissive for all to postgres, service_role using (true) with check (true);
create policy outbox_events_system_all on public.outbox_events
  as permissive for all to postgres, service_role using (true) with check (true);

-- ── residency_bases: catalog, readable by any authenticated user ────────────

create policy residency_bases_authenticated_select on public.residency_bases
  for select to authenticated using (true);

-- ── persons ─────────────────────────────────────────────────────────────────
-- Self (via the account link — verification does not require membership) or
-- registry.read. Platform administrators match neither branch: no tenant
-- resident data (ADR-0006 point 18).

create policy persons_select on public.persons
  for select to authenticated
  using (
    public.caller_owns_person(id)
    or public.auth_has_permission(barangay_id, 'registry.read')
  );

-- ── person_accounts ─────────────────────────────────────────────────────────

create policy person_accounts_select on public.person_accounts
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.auth_has_permission(barangay_id, 'registry.read')
  );

-- ── verification_applications ───────────────────────────────────────────────

create policy verification_applications_select on public.verification_applications
  for select to authenticated
  using (
    public.caller_owns_application(id)
    or public.auth_has_permission(barangay_id, 'verification.read')
  );

-- ── verification_evidence ───────────────────────────────────────────────────
-- Deliberately NOT verification.read: evidence metadata is the most sensitive
-- surface and carries its own capability (D2-04: verification.evidence.read).

create policy verification_evidence_select on public.verification_evidence
  for select to authenticated
  using (
    public.caller_owns_application(application_id)
    or public.auth_has_permission(barangay_id, 'verification.evidence.read')
  );
