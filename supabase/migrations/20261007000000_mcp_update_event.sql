-- MCP event bridge, slice B: change fields of one of the owner's personal events.
-- Spec: SPEC-event-api.md. Requires 20261006000000_mcp_tokens.sql. Additive: one new function only.
--
-- The target is named by id OR external_id (exactly one). Only personal events (group_id is null) of the
-- token's owner can be found; anything else is reported as "Event not found" so nothing leaks.
-- p_patch keys: name, deadline, description, is_recurring, recurrence_day_of_week. A key that is present
-- is applied (description: null clears it); a key that is absent is left alone. Unknown keys are refused.

create or replace function public.mcp_update_event(
  p_token text,
  p_id uuid default null,
  p_external_id text default null,
  p_patch jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_key text;
  v_row public.events;
  v_name text;
  v_deadline timestamptz;
  v_description text;
  v_recurring boolean;
  v_dow smallint;
begin
  v_user := public.api_token_user(p_token);

  if (p_id is null) = (p_external_id is null) then
    raise exception 'Invalid input: target';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception 'Invalid input: patch';
  end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in ('name', 'deadline', 'description', 'is_recurring', 'recurrence_day_of_week') then
      raise exception 'Invalid input: %', v_key;
    end if;
  end loop;

  select * into v_row
  from public.events e
  where e.user_id = v_user
    and e.group_id is null
    and ((p_id is not null and e.id = p_id) or (p_external_id is not null and e.external_id = p_external_id))
  for update;

  if not found then
    raise exception 'Event not found';
  end if;

  v_name := v_row.name;
  v_deadline := v_row.deadline;
  v_description := v_row.description;
  v_recurring := v_row.is_recurring;
  v_dow := v_row.recurrence_day_of_week;

  if p_patch ? 'name' then
    if jsonb_typeof(p_patch -> 'name') <> 'string' then raise exception 'Invalid input: name'; end if;
    v_name := btrim(p_patch ->> 'name');
    if char_length(v_name) < 1 or char_length(v_name) > 200 then raise exception 'Invalid input: name'; end if;
  end if;
  if p_patch ? 'deadline' then
    if jsonb_typeof(p_patch -> 'deadline') <> 'string' then raise exception 'Invalid input: deadline'; end if;
    begin
      v_deadline := (p_patch ->> 'deadline')::timestamptz;
    exception when others then
      raise exception 'Invalid input: deadline';
    end;
  end if;
  if p_patch ? 'description' then
    if jsonb_typeof(p_patch -> 'description') not in ('string', 'null') then raise exception 'Invalid input: description'; end if;
    v_description := p_patch ->> 'description';
    if v_description is not null and char_length(v_description) > 2000 then raise exception 'Invalid input: description'; end if;
  end if;
  if p_patch ? 'is_recurring' then
    if jsonb_typeof(p_patch -> 'is_recurring') <> 'boolean' then raise exception 'Invalid input: is_recurring'; end if;
    v_recurring := (p_patch ->> 'is_recurring')::boolean;
  end if;
  if p_patch ? 'recurrence_day_of_week' then
    if jsonb_typeof(p_patch -> 'recurrence_day_of_week') not in ('number', 'null') then raise exception 'Invalid input: day of week'; end if;
    begin
      v_dow := (p_patch ->> 'recurrence_day_of_week')::smallint;
    exception when others then
      raise exception 'Invalid input: day of week';
    end;
  end if;

  -- A weekly event needs a weekday; a one-off event keeps none.
  if v_recurring then
    if v_dow is null or v_dow not between 0 and 6 then raise exception 'Invalid input: day of week'; end if;
  else
    v_dow := null;
  end if;

  update public.events
  set name = v_name,
      deadline = v_deadline,
      description = v_description,
      is_recurring = v_recurring,
      recurrence_day_of_week = v_dow
  where id = v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'action', 'updated',
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

revoke execute on function public.mcp_update_event(text, uuid, text, jsonb) from public;
grant execute on function public.mcp_update_event(text, uuid, text, jsonb) to anon, authenticated;

-- To undo:
--   drop function if exists public.mcp_update_event(text, uuid, text, jsonb);
