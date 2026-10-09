-- MCP event bridge, slice C: list the owner's personal events.
-- Spec: SPEC-event-api.md. Requires 20261006000000_mcp_tokens.sql. Additive: one new function only.
--
-- Read-only. Default is upcoming events (deadline from now on), 50 at most; the hard cap is 200.
-- Only personal events (group_id is null) of the token's owner are ever returned. p_query matches the
-- name or description, case-insensitively, as plain text (no wildcards).

create or replace function public.mcp_list_events(
  p_token text,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_query text default null,
  p_limit integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_limit integer := coalesce(p_limit, 50);
  v_from timestamptz := coalesce(p_from, now());
  v_pattern text;
  v_events jsonb;
  v_total integer;
begin
  v_user := public.api_token_user(p_token);

  if v_limit < 1 then
    raise exception 'Invalid input: limit';
  end if;
  v_limit := least(v_limit, 200);

  if p_to is not null and p_to < v_from then
    raise exception 'Invalid input: range';
  end if;

  if p_query is not null and btrim(p_query) <> '' then
    if char_length(p_query) > 100 then
      raise exception 'Invalid input: query';
    end if;
    -- Escape LIKE wildcards so the query is matched literally.
    v_pattern := '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with matched as (
    select e.*
    from public.events e
    where e.user_id = v_user
      and e.group_id is null
      and e.deadline >= v_from
      and (p_to is null or e.deadline <= p_to)
      and (v_pattern is null or e.name ilike v_pattern or coalesce(e.description, '') ilike v_pattern)
  ),
  page as (
    select * from matched order by deadline, created_at, id limit v_limit
  )
  select
    coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'external_id', p.external_id,
          'name', p.name,
          'deadline', p.deadline,
          'description', p.description,
          'is_recurring', p.is_recurring,
          'recurrence_day_of_week', p.recurrence_day_of_week,
          'created_at', p.created_at
        ) order by p.deadline, p.created_at, p.id
      ) from page p),
      '[]'::jsonb
    ),
    (select count(*)::integer from matched)
  into v_events, v_total;

  return jsonb_build_object('events', v_events, 'total', v_total);
end;
$$;

revoke execute on function public.mcp_list_events(text, timestamptz, timestamptz, text, integer) from public;
grant execute on function public.mcp_list_events(text, timestamptz, timestamptz, text, integer) to anon, authenticated;

-- To undo:
--   drop function if exists public.mcp_list_events(text, timestamptz, timestamptz, text, integer);
