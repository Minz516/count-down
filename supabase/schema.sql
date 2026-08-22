-- Run once in the Supabase SQL editor. See docs/ARCHITECTURE.md for the schema rationale.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  deadline timestamptz not null,
  description text,
  created_at timestamptz not null default now(),
  is_recurring boolean not null default false,
  recurrence_day_of_week smallint check (recurrence_day_of_week between 0 and 6)
);

create index if not exists events_user_id_deadline_idx on public.events (user_id, deadline);

-- Length caps (docs/PRODUCTION_READINESS_CHECKLIST.md §2) so one bad request can't insert a
-- multi-megabyte row - mirrored by matching checks in modules/events/events.service.ts.
alter table public.events
  add constraint events_name_length check (char_length(name) <= 200),
  add constraint events_description_length check (description is null or char_length(description) <= 2000);

alter table public.events enable row level security;

-- Each user may only ever see/create/edit/delete their own events (docs/PRD.md hard requirement).
create policy "Users can view their own events" on public.events
  for select using (auth.uid() = user_id);

create policy "Users can insert their own events" on public.events
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own events" on public.events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own events" on public.events
  for delete using (auth.uid() = user_id);

-- Rate limiting (docs/PRODUCTION_READINESS_CHECKLIST.md §8): a basic sanity cap so one
-- account can't spam event creation, accidentally or otherwise. Fires on every insert
-- regardless of whether it came through the personal or group-scoped path - both always
-- set user_id to the acting user (events.repository.ts), so one trigger covers both. No
-- SECURITY DEFINER needed - the SELECT inside only reads rows the inserting user already
-- has select access to under the policy above.
create or replace function public.check_event_creation_rate_limit()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*) from public.events
    where user_id = new.user_id and created_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'Too many events created recently - please wait a moment and try again';
  end if;
  return new;
end;
$$;

create trigger enforce_event_creation_rate_limit
before insert on public.events
for each row execute function public.check_event_creation_rate_limit();

-- Personal todo checklist attached to an event (docs/ARCHITECTURE.md "Todo Checklist").
-- `user_id` is included even though every event is personal today - forward-compatible
-- with a future shared-event milestone without a schema change later.
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  is_done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  -- Length cap (docs/PRODUCTION_READINESS_CHECKLIST.md §2) - mirrors the matching check in
  -- modules/todos/todos.service.ts.
  constraint todos_content_length check (char_length(content) <= 500)
);

create index if not exists todos_event_id_position_idx on public.todos (event_id, position);
-- todos.repository.ts's listAllForUser filters on user_id alone, not covered by the
-- composite index above (docs/PRODUCTION_READINESS_CHECKLIST.md §2).
create index if not exists todos_user_id_idx on public.todos (user_id);

alter table public.todos enable row level security;

create policy "Users can view their own todos" on public.todos
  for select using (auth.uid() = user_id);

create policy "Users can insert their own todos" on public.todos
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own todos" on public.todos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own todos" on public.todos
  for delete using (auth.uid() = user_id);

-- One row per user: their personal Discord webhook + digest preference
-- (docs/ARCHITECTURE.md "Discord Digest").
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  discord_webhook_url text,
  digest_enabled boolean not null default true
);

alter table public.user_settings enable row level security;

create policy "Users can view their own settings" on public.user_settings
  for select using (auth.uid() = user_id);

create policy "Users can insert their own settings" on public.user_settings
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own settings" on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Milestone 2: Group Countdown (docs/ARCHITECTURE.md "Group Countdown").
-- A shared timeline multiple invited members can view and edit together.

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Length cap (docs/PRODUCTION_READINESS_CHECKLIST.md §2) - mirrors the matching check in
-- modules/groups/groups.service.ts.
alter table public.groups add constraint groups_name_length check (char_length(name) <= 100);

alter table public.groups enable row level security;

-- events.group_id: null = personal event, set = belongs to that group.
alter table public.events add column if not exists group_id uuid references public.groups (id) on delete cascade;
-- events.repository.ts's listByGroupAndRecurrence filters on group_id alone, not covered
-- by the events(user_id, deadline) index above (docs/PRODUCTION_READINESS_CHECKLIST.md §2).
create index if not exists events_group_id_idx on public.events (group_id);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- The primary key above leads with group_id, so it doesn't serve a user_id-only lookup
-- (docs/PRODUCTION_READINESS_CHECKLIST.md §2).
create index if not exists group_members_user_id_idx on public.group_members (user_id);

alter table public.group_members enable row level security;

-- Every group-scoped policy below needs "is the current user a member of
-- this group_id?" - including group_members' own policy, which needs to
-- check that *about itself* (a member can see every row for a group they
-- belong to, not just their own row, for the "7/10 members" count UI). A
-- naive `group_id in (select group_id from group_members where ...)` directly
-- inside group_members' own policy makes Postgres raise "infinite recursion
-- detected in policy for relation group_members" - evaluating the subquery
-- re-triggers the same policy on its own scan of the table, forever. A
-- `security definer` function breaks the cycle: its internal query runs as
-- the function's owner (bypasses RLS the same way create_group()/
-- join_group_by_code() below do), not as the querying user, so it never
-- re-enters the policy that's calling it.
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

-- No insert/update/delete policy - joining only happens via
-- join_group_by_code() below (docs/ARCHITECTURE.md "avoids exposing group_id
-- values or letting the RLS policy be the only gate on joining").
create policy "Members can view fellow members" on public.group_members
  for select using (public.is_group_member(group_id));

-- No insert/update/delete policy here on purpose - the only write path is the
-- security-definer create_group() function below, so an invite-code guess or
-- a raw client insert can never create/alter a group row directly.
create policy "Members can view their groups" on public.groups
  for select using (public.is_group_member(id));

-- The 10-member cap is enforced here, at the database level, not just in the
-- UI - it fires on every insert into group_members regardless of whether that
-- insert came from join_group_by_code() or (hypothetically) anywhere else.
create or replace function public.check_group_member_cap()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.group_members where group_id = new.group_id) >= 10 then
    raise exception 'Group has reached the 10-member limit';
  end if;
  return new;
end;
$$;

create trigger enforce_group_member_cap
before insert on public.group_members
for each row execute function public.check_group_member_cap();

create table if not exists public.group_settings (
  group_id uuid primary key references public.groups (id) on delete cascade,
  discord_webhook_url text,
  digest_enabled boolean not null default true
);

alter table public.group_settings enable row level security;

create policy "Members can view their group settings" on public.group_settings
  for select using (public.is_group_member(group_id));

create policy "Members can insert their group settings" on public.group_settings
  for insert with check (public.is_group_member(group_id));

create policy "Members can update their group settings" on public.group_settings
  for update using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

-- Replace the events SELECT/UPDATE/DELETE policies so a member of an event's
-- group can act on it too, not just the row's own user_id. INSERT is
-- deliberately left untouched - every insert this app issues (personal or
-- group) sets user_id to the acting user, so its existing check already
-- covers group event creation with no change.
drop policy "Users can view their own events" on public.events;
drop policy "Users can update their own events" on public.events;
drop policy "Users can delete their own events" on public.events;

create policy "Users can view their own or group events" on public.events
  for select using (user_id = auth.uid() or public.is_group_member(group_id));

create policy "Users can update their own or group events" on public.events
  for update using (user_id = auth.uid() or public.is_group_member(group_id))
  with check (user_id = auth.uid() or public.is_group_member(group_id));

create policy "Users can delete their own or group events" on public.events
  for delete using (user_id = auth.uid() or public.is_group_member(group_id));

-- security definer: bypasses RLS on groups/group_members so these two
-- functions can be the *only* way either table is ever written to from the
-- client (see the "no insert policy" comments above).
create or replace function public.create_group(p_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_group public.groups;
begin
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.groups (name, invite_code, created_by)
      values (p_name, v_code, auth.uid())
      returning * into v_group;
      exit;
    exception when unique_violation then
      -- invite_code collision - loop and try a freshly generated code.
    end;
  end loop;

  insert into public.group_members (group_id, user_id) values (v_group.id, auth.uid());

  return v_group;
end;
$$;

-- Rate limiting for invite-code join attempts (docs/PRODUCTION_READINESS_CHECKLIST.md §8):
-- groups.invite_code is only 8 characters, so without a cap it's brute-forceable through
-- repeated calls to join_group_by_code() directly - RLS/policies don't limit call
-- frequency. Logs every attempt regardless of outcome, since what's being capped is
-- request volume, not just failures. No client-facing policies at all - only
-- join_group_by_code() (security definer) below ever writes to or reads this table, the
-- same "controlled write path" pattern as groups/group_members themselves.
create table if not exists public.group_join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists group_join_attempts_user_id_attempted_at_idx
  on public.group_join_attempts (user_id, attempted_at);

alter table public.group_join_attempts enable row level security;

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

  -- The cap trigger above still fires here regardless of this function's
  -- elevated privileges - it's a table-level guarantee, not bypassable.
  insert into public.group_members (group_id, user_id) values (v_group.id, auth.uid())
  on conflict (group_id, user_id) do nothing;

  return v_group;
end;
$$;

-- Username support (docs/ARCHITECTURE.md "Auth Flow"). auth.users can't be extended with
-- custom columns, so username lives in its own table, populated automatically at signup -
-- not via a client insert - by the trigger below.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Select-only: no insert/update/delete policy, since a profile is only ever created by
-- handle_new_user() below, not a client insert.
create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

-- Fires once per new auth.users row and copies the username passed at signup
-- (`supabase.auth.signUp({ options: { data: { username } } })`) into profiles.
-- security definer so it can write to profiles despite that table having no
-- insert policy of its own.
-- OAuth sign-in (Google/Facebook/Discord/GitHub, docs/PRODUCTION_READINESS_CHECKLIST.md-era
-- addition) doesn't collect a username the way AuthForm.tsx's signup form does, so this
-- derives one automatically for that path while leaving the username/password path (which
-- always sets raw_user_meta_data->>'username') untouched.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_base text;
  v_suffix int := 0;
begin
  v_username := new.raw_user_meta_data ->> 'username';

  if v_username is not null then
    -- A real, user-chosen username - a collision here is a genuine conflict, not
    -- something to paper over.
    begin
      insert into public.profiles (id, username) values (new.id, v_username);
    exception when unique_violation then
      raise exception 'Username already taken';
    end;
    return new;
  end if;

  -- OAuth path: sanitize *each* candidate before coalescing (not after) - split_part()/->>
  -- can return '' rather than null, which coalesce() would not skip, silently
  -- short-circuiting the fallback chain to an empty string.
  v_base := coalesce(
    nullif(regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g'), ''),
    nullif(regexp_replace(lower(new.raw_user_meta_data ->> 'user_name'), '[^a-z0-9_]', '', 'g'), ''),
    nullif(regexp_replace(lower(new.raw_user_meta_data ->> 'preferred_username'), '[^a-z0-9_]', '', 'g'), ''),
    nullif(regexp_replace(lower(new.raw_user_meta_data ->> 'name'), '[^a-z0-9_]', '', 'g'), ''),
    'user'
  );

  v_username := v_base;
  loop
    begin
      insert into public.profiles (id, username) values (new.id, v_username);
      exit;
    exception when unique_violation then
      -- Auto-generated collision is expected/harmless - retry with a numeric suffix,
      -- same loop-and-retry shape as create_group()'s invite_code collision handling.
      v_suffix := v_suffix + 1;
      if v_suffix > 1000 then
        raise exception 'Could not generate a unique username';
      end if;
      v_username := v_base || v_suffix::text;
    end;
  end loop;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Resolves a username to its email so "sign in with username or email" can call
-- Supabase's email-only signInWithPassword either way. Must be callable while
-- unauthenticated (that's the whole point - this runs before sign-in), hence the
-- explicit grant below rather than relying on default privileges.
create or replace function public.get_email_for_username(p_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email from auth.users where id = (
    select id from public.profiles where username = p_username
  );
$$;

grant execute on function public.get_email_for_username(text) to anon, authenticated;

-- Profile editing (avatar + username) and cross-member visibility
-- (docs/ARCHITECTURE.md "Group Countdown" - member list, group card avatar previews).

alter table public.profiles add column if not exists avatar_url text;

-- New - a user may now edit their own profile (username/avatar), not just have it
-- populated by handle_new_user() at signup.
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- New, added alongside (not replacing) the self-only select policy above - Postgres
-- OR-combines multiple permissive policies for the same command, so a profile is now
-- visible either to its own owner or to a fellow member of any group they share, which
-- is what lets the group member list / group card avatar previews below actually work.
create policy "Users can view fellow group members' profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid() and gm2.user_id = profiles.id
    )
  );

-- Avatar images live in Storage, not a table - public read (avatars aren't sensitive),
-- writes restricted to each user's own folder (docs/ARCHITECTURE.md "Auth Flow").
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "Users can upload their own avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can replace their own avatar" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatar" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- In-app notification bell (event passed, due today/tomorrow). No client-facing insert
-- policy - only the daily-digest Edge Function (service role) ever creates rows, the
-- same "controlled write path" pattern as groups/group_members.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  type text not null check (type in ('event_passed', 'due_soon')),
  message text not null,
  is_read boolean not null default false,
  -- Set when is_read flips to true (not just a boolean) so a read notification can be
  -- auto-deleted 1 day after *that*, not 1 day after created_at - see
  -- cleanup_and_roll_events() in supabase/cleanup_and_rollover.sql.
  read_at timestamptz,
  created_at timestamptz not null default now(),
  -- Dedup: each event produces at most one notification of a given type per
  -- recipient, ever - the Edge Function upserts against this constraint
  -- (ignoreDuplicates) instead of tracking "already notified" state separately.
  unique (user_id, event_id, type)
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Users can update their own notifications" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own notifications" on public.notifications
  for delete using (auth.uid() = user_id);
