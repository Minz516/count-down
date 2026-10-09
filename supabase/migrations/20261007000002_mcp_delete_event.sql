-- MCP event bridge, slice D: delete one of the owner's personal events.
-- Requires 20261006000000_mcp_tokens.sql. Additive: one new function only.
--
-- Deletion is permanent, so it refuses unless p_confirm is exactly true. The target is named by id OR
-- external_id (exactly one). Only personal events (group_id is null) of the token's owner can be found;
-- anything else is "Event not found". Returns what was deleted so the caller can report it.

create or replace function public.mcp_delete_event(
  p_token text,
  p_id uuid default null,
  p_external_id text default null,
  p_confirm boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_row public.events;
begin
  v_user := public.api_token_user(p_token);

  if (p_id is null) = (p_external_id is null) then
    raise exception 'Invalid input: target';
  end if;
  if p_confirm is distinct from true then
    raise exception 'Confirmation required';
  end if;

  delete from public.events e
  where e.user_id = v_user
    and e.group_id is null
    and ((p_id is not null and e.id = p_id) or (p_external_id is not null and e.external_id = p_external_id))
  returning * into v_row;

  if not found then
    raise exception 'Event not found';
  end if;

  return jsonb_build_object(
    'action', 'deleted',
    'event', jsonb_build_object(
      'id', v_row.id,
      'external_id', v_row.external_id,
      'name', v_row.name,
      'deadline', v_row.deadline,
      'description', v_row.description,
      'is_recurring', v_row.is_recurring,
      'recurrence_day_of_week', v_row.recurrence_day_of_week,
      'created_at', v_row.created_at
    )
  );
end;
$$;

revoke execute on function public.mcp_delete_event(text, uuid, text, boolean) from public;
grant execute on function public.mcp_delete_event(text, uuid, text, boolean) to anon, authenticated;

-- To undo:
--   drop function if exists public.mcp_delete_event(text, uuid, text, boolean);
