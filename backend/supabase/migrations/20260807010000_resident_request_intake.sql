-- ============================================================================
-- Slice 3B · Resident request intake: the verification gate, and own-request
-- catalog visibility
--
-- 3A shipped the domain: `create_own_request` required the caller to BE a
-- person in the barangay. That is the Slice 2 rule that "an account proves
-- nothing", but it is not yet the rule the roadmap states for THIS surface —
-- Slice 3 §3 says a **verified** resident files a request, and ADR-0006
-- point 4 says an account confers nothing until a reviewer approves.
--
-- A person record exists from the moment someone onboards, so 3A's check
-- would have let an applicant whose verification is still `submitted`,
-- `info_requested` or `rejected` file document requests. This migration closes
-- that gap in the DATABASE, where it belongs, rather than only in the server
-- action that happens to call it — the two-place rule the slice is held to.
--
-- Deliberately NOT changed: `create_walk_in_request`. Staff at the counter see
-- the person in front of them and record why they acted; whether an assisted
-- request may be filed for an unverified walk-in is a 3C question about the
-- counter workflow, and answering it here would be a ruling nobody asked for.
-- Raised as DEC-REQ-02 in docs/decisions/blockers.md.
--
-- Forward-only and additive, the Slice 2F pattern: migration 20260805010000
-- tightened `submit_verification` the same way rather than editing history.
-- ============================================================================

-- ── Verification standing ───────────────────────────────────────────────────

create function public.person_is_verified(p_person_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  -- An APPROVED application, ever. `approved` is terminal and re-enterable
  -- only through a NEW application (Slice 2A), so a later application sitting
  -- in review does not un-verify someone who was already approved — it is a
  -- change of details, not a withdrawal of standing.
  select exists (
    select 1
    from public.verification_applications va
    where va.person_id = p_person_id
      and va.state = 'approved'
  );
$$;

comment on function public.person_is_verified is
  'Whether this person has ever been approved (ADR-0006 point 4). Internal: it answers "is this person verified", which is a building block for the request functions and not a client query.';

-- ── The gate ────────────────────────────────────────────────────────────────
-- Replaced rather than altered: CREATE OR REPLACE preserves the existing ACL,
-- so the 3A grant to `authenticated` carries over unchanged.

create or replace function public.create_own_request(
  p_barangay_id uuid,
  p_document_type_id uuid,
  p_purpose text
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare v_person_id uuid; v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  -- The caller must BE a person in this barangay. An account alone is not
  -- enough — that is the Slice 2 rule that an account proves nothing.
  v_person_id := public.caller_person_in(p_barangay_id);
  if v_person_id is null then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;

  -- ...and being a person is not enough either. Onboarding creates the person
  -- record immediately; standing arrives only when a reviewer approves
  -- (roadmap Slice 3 §3, ADR-0006 point 4). Reported distinctly from
  -- AUTHORIZATION_DENIED because it is an actionable state the resident can
  -- fix, not a refusal to acknowledge: the screen sends them to their
  -- registration rather than to a dead end.
  if not public.person_is_verified(v_person_id) then
    raise exception 'RESIDENT_NOT_VERIFIED' using errcode = 'P0001';
  end if;

  -- An inactive or cross-tenant type is not requestable, and both are
  -- reported identically.
  if not exists (
    select 1 from public.document_types dt
    where dt.id = p_document_type_id
      and dt.barangay_id = p_barangay_id
      and dt.is_active
  ) then
    raise exception 'DOCUMENT_TYPE_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.document_requests
    (barangay_id, document_type_id, person_id, source_channel, purpose)
  values
    (p_barangay_id, p_document_type_id, v_person_id, 'self', p_purpose)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

comment on function public.create_own_request is
  'Resident self-service request creation. The caller must be a VERIFIED person in the barangay (RESIDENT_NOT_VERIFIED otherwise) and the type must be active. Creates a DRAFT — nothing reaches the queue until submit_request.';

-- ── A requester can always read the type behind their own request ───────────
--
-- The 3A catalog policy shows residents ACTIVE types only, which is right for
-- browsing: a withdrawn document cannot be requested. But a request already
-- filed references its type forever, and a resident opening their own request
-- detail must still be able to read what they asked for and which questions
-- they answered. Without this, withdrawing a type would silently blank the
-- history of every resident who ever used it.
--
-- SECURITY DEFINER, like caller_owns_request: a policy on document_types that
-- queried document_requests directly would re-enter that table's own RLS.

create function public.caller_has_request_for_type(p_document_type_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.document_requests dr
    join public.person_accounts pa on pa.person_id = dr.person_id
    where dr.document_type_id = p_document_type_id
      and pa.user_id = auth.uid()
  );
$$;

comment on function public.caller_has_request_for_type is
  'Whether the caller owns a request naming this document type. Widens catalog visibility to the requester''s own history only — it grants nothing about types they never used.';

-- The policy's access path: by type, for the ownership join above.
create index document_requests_type_idx
  on public.document_requests (document_type_id);

-- Membership is required on BOTH branches. Owning a request is what widens the
-- visible catalog beyond the active types; it does not by itself make someone
-- an audience for the catalog. Without this conjunct a person with no active
-- membership — an applicant, a former member — would start seeing catalog
-- rows, which is the property 3A's pgTAP pins down ("a user with no ACTIVE
-- membership is not a catalog audience"). Costs nothing in practice: every
-- resident surface resolves an active membership before it renders.

create policy document_types_select_own_request on public.document_types
  for select to authenticated
  using (
    public.auth_is_active_member(barangay_id)
    and public.caller_has_request_for_type(id)
  );

create policy document_type_requirements_select_own_request on public.document_type_requirements
  for select to authenticated
  using (
    public.auth_is_active_member(barangay_id)
    and public.caller_has_request_for_type(document_type_id)
  );

-- ── Grants ──────────────────────────────────────────────────────────────────
-- person_is_verified stays INTERNAL (the caller_person_in precedent): it is a
-- building block for the functions above, not a client query. The policy
-- helper must be executable by `authenticated`, because a policy expression is
-- evaluated as the querying role.

revoke execute on function
  public.person_is_verified(uuid),
  public.caller_has_request_for_type(uuid)
from public, anon, authenticated;

grant execute on function public.caller_has_request_for_type(uuid) to authenticated;
