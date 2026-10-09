-- MCP event bridge, slice A, migration 2 of 2: create (or update by external_id) a personal event.
-- Requires 20261006000000_mcp_tokens.sql. Additive: one new function only.
--
-- Callable by anon and authenticated because the Next.js route has no user session: the token is the
-- credential. The acting user always comes from the token (api_token_user), never from an argument.
-- Only personal events are written (group_id stays null), and the events insert trigger that caps
-- creation at 20 per user per minute still fires.

create or replace function public.mcp_create_event(
  p_token text,
  p_name text,
  p_deadline timestamptz,
  p_description text default null,
  p_external_id text default null,
  p_is_recurring boolean default false,
  p_recurrence_day_of_week smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_recurring boolean := coalesce(p_is_recurring, false);
  v_dow smallint;
  v_id uuid;
  v_inserted boolean;
  v_row public.events;
begin
  v_user := public.api_token_user(p_token);

  -- Same limits as the app (modules/events/events.service.ts and the table check constraints).
  if char_length(v_name) < 1 or char_length(v_name) > 200 then
    raise exception 'Invalid input: name';
  end if;
  if p_description is not null and char_length(p_description) > 2000 then
    raise exception 'Invalid input: description';
  end if;
  if p_external_id is not null and (char_length(p_external_id) < 1 or char_length(p_external_id) > 200) then
    raise exception 'Invalid input: external_id';
  end if;
  if p_deadline is null then
    raise exception 'Invalid input: deadline';
  end if;
  if v_recurring then
    if p_recurrence_day_of_week is null or p_recurrence_day_of_week not between 0 and 6 then
      raise exception 'Invalid input: day of week';
    end if;
    v_dow := p_recurrence_day_of_week;
  end if;

  if p_external_id is null then
    insert into public.events (user_id, name, deadline, description, is_recurring, recurrence_day_of_week)
    values (v_user, v_name, p_deadline, p_description, v_recurring, v_dow)
    returning id into v_id;
    v_inserted := true;
  else
    -- The unique index is per user, so another user's identical external_id never collides. A match on
    -- a GROUP event (group_id not null) is left untouched and reported as a clash.
    insert into public.events as e (user_id, name, deadline, description, is_recurring, recurrence_day_of_week, external_id)
    values (v_user, v_name, p_deadline, p_description, v_recurring, v_dow, p_external_id)
    on conflict (user_id, external_id) where external_id is not null
    do update set
      name = excluded.name,
      deadline = excluded.deadline,
      description = excluded.description,
      is_recurring = excluded.is_recurring,
      recurrence_day_of_week = excluded.recurrence_day_of_week
    where e.group_id is null
    returning e.id, (xmax = 0) into v_id, v_inserted;

    if v_id is null then
      raise exception 'Invalid input: external_id';
    end if;
  end if;

  select * into v_row from public.events where id = v_id;

  return jsonb_build_object(
    'action', case when v_inserted then 'created' else 'updated' end,
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

revoke execute on function public.mcp_create_event(text, text, timestamptz, text, text, boolean, smallint) from public;
grant execute on function public.mcp_create_event(text, text, timestamptz, text, text, boolean, smallint) to anon, authenticated;

-- To undo:
--   drop function if exists public.mcp_create_event(text, text, timestamptz, text, text, boolean, smallint);
