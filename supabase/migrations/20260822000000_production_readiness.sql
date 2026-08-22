-- Production readiness pass (docs/PRODUCTION_READINESS_CHECKLIST.md sections 2 and 8).
-- Run this once in the SQL Editor against a database that already has supabase/schema.sql
-- applied. This is the first file in supabase/migrations/ - going forward, schema changes
-- should be added as new timestamped files here (docs/PRODUCTION_READINESS_CHECKLIST.md
-- §6) rather than only edited into schema.sql; schema.sql has also been updated in place
-- so a brand-new project setup (docs/SETUP.md) gets all of this from one file, with no
-- need to separately apply this migration.

-- 2. Database & Storage: length caps on free-form text so one bad request can't insert a
-- multi-megabyte row. Limits mirror the matching client/service-side checks in
-- modules/events/events.service.ts, modules/todos/todos.service.ts, and
-- modules/groups/groups.service.ts - those exist for a friendly error message; these
-- constraints are the hard backstop that holds even if a caller bypasses the app entirely.
alter table public.events
  add constraint events_name_length check (char_length(name) <= 200),
  add constraint events_description_length check (description is null or char_length(description) <= 2000);

alter table public.todos
  add constraint todos_content_length check (char_length(content) <= 500);

alter table public.groups
  add constraint groups_name_length check (char_length(name) <= 100);

-- 2. Database & Storage: indexes for columns this codebase actually filters/sorts on that
-- weren't covered by the existing events(user_id, deadline) / todos(event_id, position)
-- indexes - events.repository.ts's listByGroupAndRecurrence filters on group_id,
-- todos.repository.ts's listAllForUser filters on user_id, and group_members has no index
-- usable for a user_id-only lookup (its primary key leads with group_id).
create index if not exists events_group_id_idx on public.events (group_id);
create index if not exists todos_user_id_idx on public.todos (user_id);
create index if not exists group_members_user_id_idx on public.group_members (user_id);

-- 8. Rate Limiting: invite-code join attempts. groups.invite_code is only 8 characters
-- (supabase/schema.sql's create_group()) - without a cap, it's brute-forceable by repeated
-- guesses through join_group_by_code() directly (RLS/policies don't limit call frequency).
-- Logs every attempt regardless of outcome, since the thing being capped is request volume,
-- not just failures.
create table if not exists public.group_join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists group_join_attempts_user_id_attempted_at_idx
  on public.group_join_attempts (user_id, attempted_at);

alter table public.group_join_attempts enable row level security;

-- No client-facing policies at all - written to only by join_group_by_code() below
-- (security definer), the same "controlled write path" pattern as groups/group_members
-- themselves. Nothing needs to read this table from the client either.

-- Replaces the join_group_by_code() from supabase/schema.sql with the same body plus a
-- rate-limit check at the top - `create or replace function` keeps the same signature and
-- grants, so nothing else needs to change.
create or replace function public.join_group_by_code(p_invite_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.groups;
  v_recent_attempts int;
begin
  select count(*) into v_recent_attempts
  from public.group_join_attempts
  where user_id = auth.uid() and attempted_at > now() - interval '10 minutes';

  if v_recent_attempts >= 10 then
    raise exception 'Too many join attempts - please wait a few minutes and try again';
  end if;

  insert into public.group_join_attempts (user_id) values (auth.uid());

  select * into v_group from public.groups where invite_code = p_invite_code;

  if not found then
    raise exception 'Invalid invite code';
  end if;

  -- The member cap trigger (check_group_member_cap, supabase/schema.sql) still fires here
  -- regardless of this function's elevated privileges - unchanged from before.
  insert into public.group_members (group_id, user_id) values (v_group.id, auth.uid())
  on conflict (group_id, user_id) do nothing;

  return v_group;
end;
$$;
