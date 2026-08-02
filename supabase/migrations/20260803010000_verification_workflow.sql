-- ============================================================================
-- Slice 2D · Verification workflow: outbox intents for the two resident-
-- facing mid-lifecycle transitions, and reason/note-presence audit metadata
--
-- 2A enqueued notification intents for the terminal decisions only
-- (approved / rejected). The 2D queue makes `info_requested` and
-- `resubmitted` real user-facing moments, so their intents must be enqueued
-- in the SAME transaction as the state change (README non-negotiable;
-- roadmap §13). Delivery remains Slice 8 — these rows are intent only.
--
-- Duplicate-intent protection needs no bookkeeping: both functions gate on
-- the current state (`in_review` / `info_requested`), so a repeated call
-- raises ILLEGAL_TRANSITION before any enqueue is reached. pgTAP proves it.
--
-- The functions are DROPPED and recreated because the new p_correlation_id
-- parameter changes the signature — CREATE OR REPLACE would leave the old
-- overload behind and make the PostgREST call ambiguous.
-- ============================================================================

drop function public.request_information(uuid, text);
drop function public.resubmit_verification(uuid);

create function public.request_information(
  p_application_id uuid,
  p_note text,
  p_correlation_id uuid default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_app public.verification_applications%rowtype;
begin
  select * into v_app from public.verification_applications where id = p_application_id;
  if v_app.id is null
     or not public.auth_has_permission(v_app.barangay_id, 'verification.request_information') then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_app.state <> 'in_review' then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001';
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'NOTE_REQUIRED' using errcode = 'P0001';
  end if;
  update public.verification_applications
  set state = 'info_requested', info_request_note = btrim(p_note)
  where id = p_application_id;

  -- Intent in the same transaction (Slice 2D). IDs only — the note itself
  -- stays on the application row; the Slice 8 template will read it through
  -- an authorized query, not from the payload.
  perform public.enqueue_outbox(
    v_app.barangay_id, 'verification.info_requested',
    jsonb_build_object('application_id', p_application_id,
                       'person_id', v_app.person_id),
    p_correlation_id);
end;
$$;

comment on function public.request_information is
  'in_review → info_requested (verification.request_information; note required). Slice 2D: enqueues the verification.info_requested intent atomically; the note text never enters the payload.';

create function public.resubmit_verification(
  p_application_id uuid,
  p_correlation_id uuid default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_app public.verification_applications%rowtype;
begin
  select * into v_app from public.verification_applications where id = p_application_id;
  if v_app.id is null
     or not (public.caller_owns_application(p_application_id)
             or public.auth_has_permission(v_app.barangay_id, 'verification.review')) then
    raise exception 'AUTHORIZATION_DENIED' using errcode = '42501';
  end if;
  if v_app.state <> 'info_requested' then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001';
  end if;
  update public.verification_applications
  set state = 'resubmitted' where id = p_application_id;

  perform public.enqueue_outbox(
    v_app.barangay_id, 'verification.resubmitted',
    jsonb_build_object('application_id', p_application_id,
                       'person_id', v_app.person_id),
    p_correlation_id);
end;
$$;

comment on function public.resubmit_verification is
  'info_requested → resubmitted (owner or verification.review — the staff-assisted path uses the same function, ADR-0006 point 6). Slice 2D: enqueues the verification.resubmitted intent atomically.';

-- Same deny-then-grant discipline as 2A for the new signatures.
revoke execute on function
  public.request_information(uuid, text, uuid),
  public.resubmit_verification(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.request_information(uuid, text, uuid),
  public.resubmit_verification(uuid, uuid)
to authenticated;

-- ── Audit metadata: record note/reason PRESENCE, never the text ─────────────
-- The roadmap's audit contract asks for a reason-present signal on state
-- changes. The trigger already refuses a rejection without a reason and the
-- function refuses an information request without a note, so on the client
-- path these booleans are always true — recording them keeps the audit row
-- self-describing and covers any future owner-path write that bypasses the
-- functions. The TEXT stays on the application row only (Phase 6 §37.2).

create or replace function public.verification_applications_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.state is distinct from old.state then
    if old.state = 'draft' and new.state = 'submitted' then
      perform public.append_audit_entry(
        'verification.submitted', 'verification_application', new.id::text,
        new.barangay_id, '{}'::jsonb, 'success', 'db');
    else
      perform public.append_audit_entry(
        'verification.state_changed', 'verification_application', new.id::text,
        new.barangay_id,
        jsonb_build_object('from_state', old.state, 'to_state', new.state)
          || case
               when new.state = 'info_requested' then
                 jsonb_build_object('note_present', new.info_request_note is not null)
               when new.state = 'rejected' then
                 jsonb_build_object('reason_present', new.decision_reason is not null)
               else '{}'::jsonb
             end,
        'success', 'db');
    end if;
  end if;
  return new;
end;
$$;
