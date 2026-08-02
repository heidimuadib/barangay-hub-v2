-- ============================================================================
-- Slice 2E · Duplicate resolution: reason-presence audit metadata
--
-- The supersede-and-link DOMAIN shipped complete in 2A (`supersede_person`,
-- the persons freeze trigger, the account-move rule and its audits); 2E adds
-- the review surface, so the only database change is bringing the
-- `person.superseded` audit row up to the same self-describing standard 2D
-- set for state changes: record THAT a reason was given, never the text.
--
-- The schema CHECK already ties the three supersede fields together, so on
-- every real path the boolean is true — recording it keeps the audit row
-- meaningful on its own and would expose any future owner-path write that
-- somehow bypassed the rule (Phase 6 §37.2).
-- ============================================================================

create or replace function public.persons_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_changed text[];
begin
  if tg_op = 'INSERT' then
    perform public.append_audit_entry(
      'person.created', 'person', new.id::text, new.barangay_id,
      jsonb_build_object('source_channel', new.source_channel), 'success', 'db');
    return new;
  end if;

  if old.superseded_by is null and new.superseded_by is not null then
    perform public.append_audit_entry(
      'person.superseded', 'person', new.id::text, new.barangay_id,
      jsonb_build_object(
        'survivor_id', new.superseded_by,
        'reason_present', new.superseded_reason is not null),
      'success', 'db');
    return new;
  end if;

  -- Field NAMES only — values are personal data (Phase 6 §37.2).
  select coalesce(array_agg(n.key order by n.key), '{}') into v_changed
  from jsonb_each(to_jsonb(new)) n
  join jsonb_each(to_jsonb(old)) o on o.key = n.key
  where n.value is distinct from o.value
    and n.key not in ('updated_at', 'search_text');

  if array_length(v_changed, 1) is not null then
    perform public.append_audit_entry(
      'person.updated', 'person', new.id::text, new.barangay_id,
      jsonb_build_object('fields', to_jsonb(v_changed)), 'success', 'db');
  end if;
  return new;
end;
$$;
