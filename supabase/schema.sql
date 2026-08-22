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
  created_at timestamptz not null default now()
);

create index if not exists todos_event_id_position_idx on public.todos (event_id, position);

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
